-- Replace transaction-specific completion with one manual, per-allocation flag.
alter table public.monthly_budget_allocations
  add column payments_completed_at timestamptz;

update public.monthly_budget_allocations
set payments_completed_at = manual_completed_at
where manual_completion_transaction_id is not null;

drop trigger if exists transactions_invalidate_monthly_budget_manual_completion on public.transactions;
drop function if exists public.invalidate_monthly_budget_manual_completion();
drop index if exists public.monthly_budget_allocations_manual_completion_transaction_unique;

alter table public.monthly_budget_allocations
  drop constraint if exists monthly_budget_allocations_manual_completion_pair_check,
  drop constraint if exists monthly_budget_allocations_single_completion_source_check,
  drop constraint if exists monthly_budget_allocations_scheduled_payment_single_mode_check,
  drop constraint if exists monthly_budget_allocations_payment_mode_check,
  drop column scheduled_payment_id,
  drop column manual_completion_transaction_id,
  drop column manual_completed_at,
  drop column payment_mode;

create or replace function public.validate_monthly_budget_allocation()
returns trigger language plpgsql set search_path = public as $$
declare v_budget_user_id uuid; v_period text; v_category_user_id uuid; v_archived_at timestamptz;
begin
  select user_id, period into v_budget_user_id, v_period from public.monthly_budgets where id = new.monthly_budget_id;
  select user_id, archived_at into v_category_user_id, v_archived_at from public.financial_categories where id = new.financial_category_id;
  if v_budget_user_id is null or v_category_user_id is null or v_budget_user_id <> v_category_user_id then
    raise exception 'Monthly budget and financial category must belong to the same user';
  end if;
  if (tg_op = 'INSERT' or new.financial_category_id is distinct from old.financial_category_id) and v_archived_at is not null then
    raise exception 'Archived financial categories cannot be assigned to a new budget allocation';
  end if;
  if new.payments_completed_at is not null and not exists (
    select 1 from public.transactions t
    where t.user_id = v_budget_user_id and t.financial_category_id = new.financial_category_id
      and t.transaction_type = 'expense'
      and t.occurred_on >= (v_period || '-01')::date
      and t.occurred_on < ((v_period || '-01')::date + interval '1 month')::date
  ) then
    raise exception 'Payments can only be completed when the allocation has an expense in its period';
  end if;
  return new;
end; $$;

create or replace function public.clear_empty_monthly_budget_completions()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.monthly_budget_allocations a
  set payments_completed_at = null
  from public.monthly_budgets b
  where a.monthly_budget_id = b.id and b.user_id = coalesce(new.user_id, old.user_id)
    and a.payments_completed_at is not null
    and not exists (
      select 1 from public.transactions t
      where t.user_id = b.user_id and t.financial_category_id = a.financial_category_id
        and t.transaction_type = 'expense'
        and t.occurred_on >= (b.period || '-01')::date
        and t.occurred_on < ((b.period || '-01')::date + interval '1 month')::date
    );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger transactions_clear_empty_monthly_budget_completions
  after update or delete on public.transactions
  for each row execute function public.clear_empty_monthly_budget_completions();
