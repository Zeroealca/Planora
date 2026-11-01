-- A manually selected transaction is the single completion marker for an
-- allocation, regardless of whether that allocation normally accepts one or
-- multiple payments. A scheduled-payment link remains automatic and exclusive.

alter table public.monthly_budget_allocations
  drop constraint monthly_budget_allocations_single_payment_only_check;

alter table public.monthly_budget_allocations
  add constraint monthly_budget_allocations_scheduled_payment_single_mode_check
    check (payment_mode = 'single' or scheduled_payment_id is null);

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
  from public.monthly_budgets where id = new.monthly_budget_id;
  select user_id, archived_at into v_category_user_id, v_category_archived_at
  from public.financial_categories where id = new.financial_category_id;

  if v_budget_user_id is null or v_category_user_id is null then
    raise exception 'Monthly budget or financial category not found';
  end if;
  if v_budget_user_id <> v_category_user_id then
    raise exception 'Monthly budget and financial category must belong to the same user';
  end if;
  if tg_op = 'INSERT' and v_category_archived_at is not null then
    raise exception 'Archived financial categories cannot be assigned to a new budget allocation';
  end if;
  if tg_op = 'UPDATE' and new.financial_category_id is distinct from old.financial_category_id
    and v_category_archived_at is not null then
    raise exception 'Archived financial categories cannot be assigned to a new budget allocation';
  end if;

  if new.scheduled_payment_id is not null then
    if new.payment_mode <> 'single' then
      raise exception 'Only a single-payment allocation can link a scheduled payment';
    end if;
    select user_id, financial_category_id into v_scheduled_payment_user_id, v_scheduled_payment_category_id
    from public.scheduled_payments where id = new.scheduled_payment_id;
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
    from public.transactions where id = new.manual_completion_transaction_id;
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
    new.manual_completed_at := case when tg_op = 'UPDATE' then coalesce(old.manual_completed_at, now()) else now() end;
  else
    new.manual_completed_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_monthly_budget_manual_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or (
    new.financial_category_id is distinct from old.financial_category_id
    or new.occurred_on is distinct from old.occurred_on
    or new.transaction_type is distinct from old.transaction_type
  ) then
    update public.monthly_budget_allocations
    set manual_completion_transaction_id = null
    where manual_completion_transaction_id = old.id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger transactions_invalidate_monthly_budget_manual_completion
  before update or delete on public.transactions
  for each row execute function public.invalidate_monthly_budget_manual_completion();
