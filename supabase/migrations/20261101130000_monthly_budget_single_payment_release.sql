-- A monthly allocation remains a category plan by default. A single-payment
-- allocation may instead be explicitly tied to one scheduled payment or to one
-- manually selected, in-period expense. This prevents category aggregates from
-- being mistaken for proof that an obligation was paid.

alter table public.monthly_budget_allocations
  add column payment_mode text not null default 'multiple',
  add column scheduled_payment_id uuid references public.scheduled_payments (id) on delete set null,
  add column manual_completion_transaction_id uuid references public.transactions (id) on delete set null,
  add column manual_completed_at timestamptz;

alter table public.monthly_budget_allocations
  add constraint monthly_budget_allocations_payment_mode_check
    check (payment_mode in ('multiple', 'single')),
  add constraint monthly_budget_allocations_manual_completion_pair_check
    check (
      (manual_completion_transaction_id is null and manual_completed_at is null)
      or (manual_completion_transaction_id is not null and manual_completed_at is not null)
    ),
  add constraint monthly_budget_allocations_single_payment_only_check
    check (
      payment_mode = 'single'
      or (
        scheduled_payment_id is null
        and manual_completion_transaction_id is null
        and manual_completed_at is null
      )
    ),
  add constraint monthly_budget_allocations_single_completion_source_check
    check (
      scheduled_payment_id is null
      or manual_completion_transaction_id is null
    );

-- A manually confirmed transaction is an explicit attribution, so it cannot
-- release funds in more than one allocation. Scheduled-payment transactions
-- use their occurrence link instead and cannot be selected manually.
create unique index monthly_budget_allocations_manual_completion_transaction_unique
  on public.monthly_budget_allocations (manual_completion_transaction_id)
  where manual_completion_transaction_id is not null;

create or replace function public.validate_monthly_budget_allocation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_budget_user_id uuid;
  v_budget_period text;
  v_category_user_id uuid;
  v_category_archived_at timestamptz;
  v_scheduled_payment_user_id uuid;
  v_scheduled_payment_category_id uuid;
  v_transaction_user_id uuid;
  v_transaction_category_id uuid;
  v_transaction_type text;
  v_transaction_occurred_on date;
  v_period_start date;
  v_period_end date;
begin
  select user_id, period into v_budget_user_id, v_budget_period
  from public.monthly_budgets
  where id = new.monthly_budget_id;

  select user_id, archived_at into v_category_user_id, v_category_archived_at
  from public.financial_categories
  where id = new.financial_category_id;

  if v_budget_user_id is null or v_category_user_id is null then
    raise exception 'Monthly budget or financial category not found';
  end if;

  if v_budget_user_id <> v_category_user_id then
    raise exception 'Monthly budget and financial category must belong to the same user';
  end if;

  if tg_op = 'INSERT' and v_category_archived_at is not null then
    raise exception 'Archived financial categories cannot be assigned to a new budget allocation';
  end if;

  if tg_op = 'UPDATE'
    and new.financial_category_id is distinct from old.financial_category_id
    and v_category_archived_at is not null then
    raise exception 'Archived financial categories cannot be assigned to a new budget allocation';
  end if;

  if new.payment_mode = 'multiple' and (
    new.scheduled_payment_id is not null
    or new.manual_completion_transaction_id is not null
  ) then
    raise exception 'Only a single-payment allocation can have a completion source';
  end if;

  if new.scheduled_payment_id is not null then
    select user_id, financial_category_id
      into v_scheduled_payment_user_id, v_scheduled_payment_category_id
    from public.scheduled_payments
    where id = new.scheduled_payment_id;

    if v_scheduled_payment_user_id is null
      or v_scheduled_payment_user_id <> v_budget_user_id
      or v_scheduled_payment_category_id <> new.financial_category_id then
      raise exception 'Scheduled payment must belong to the allocation owner and category';
    end if;
  end if;

  if new.manual_completion_transaction_id is not null then
    if new.scheduled_payment_id is not null then
      raise exception 'A scheduled payment allocation cannot use manual completion';
    end if;

    select user_id, financial_category_id, transaction_type, occurred_on
      into v_transaction_user_id, v_transaction_category_id, v_transaction_type, v_transaction_occurred_on
    from public.transactions
    where id = new.manual_completion_transaction_id;

    v_period_start := (v_budget_period || '-01')::date;
    v_period_end := (v_period_start + interval '1 month')::date;

    if v_transaction_user_id is null
      or v_transaction_user_id <> v_budget_user_id
      or v_transaction_category_id <> new.financial_category_id
      or v_transaction_type <> 'expense'
      or v_transaction_occurred_on < v_period_start
      or v_transaction_occurred_on >= v_period_end then
      raise exception 'Manual completion requires an expense in the allocation category and period';
    end if;

    if exists (
      select 1 from public.scheduled_payment_occurrences occurrence
      where occurrence.transaction_id = new.manual_completion_transaction_id
    ) then
      raise exception 'A scheduled-payment transaction must be linked through its scheduled payment';
    end if;

    new.manual_completed_at := case
      when tg_op = 'UPDATE' then coalesce(old.manual_completed_at, now())
      else now()
    end;
  else
    new.manual_completed_at := null;
  end if;

  return new;
end;
$$;
