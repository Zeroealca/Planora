-- Transactions are financial facts. They are intentionally independent from
-- monthly budgets, projects, project items, and savings goals.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  occurred_on date not null,
  amount numeric(12, 2) not null,
  transaction_type text not null,
  financial_category_id uuid references public.financial_categories (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_name_not_blank check (char_length(trim(name)) > 0),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_type_check check (transaction_type in ('expense', 'income')),
  constraint transactions_expense_category_required check (
    transaction_type <> 'expense' or financial_category_id is not null
  )
);

-- Supports the monthly range query, ordered by the civil date of the movement.
create index transactions_user_occurred_on_idx
  on public.transactions (user_id, occurred_on);

-- Supports category drilldowns inside a monthly date range without indexing
-- income rows that normally have no financial category.
create index transactions_user_category_occurred_on_idx
  on public.transactions (user_id, financial_category_id, occurred_on)
  where financial_category_id is not null;

create or replace function public.validate_transaction_financial_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_user_id uuid;
  v_category_archived_at timestamptz;
begin
  if new.financial_category_id is null then
    return new;
  end if;

  select user_id, archived_at into v_category_user_id, v_category_archived_at
  from public.financial_categories
  where id = new.financial_category_id;

  if v_category_user_id is null then
    raise exception 'Financial category not found';
  end if;

  if v_category_user_id <> new.user_id then
    raise exception 'Transaction and financial category must belong to the same user';
  end if;

  if tg_op = 'INSERT'
    and new.transaction_type = 'expense'
    and v_category_archived_at is not null then
    raise exception 'Archived financial categories cannot be used for a new expense';
  end if;

  if tg_op = 'UPDATE'
    and new.transaction_type = 'expense'
    and v_category_archived_at is not null
    and (
      new.financial_category_id is distinct from old.financial_category_id
      or new.transaction_type is distinct from old.transaction_type
    ) then
    raise exception 'Archived financial categories cannot be used for a new expense';
  end if;

  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger transactions_validate_financial_category
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_financial_category();

alter table public.transactions enable row level security;

create policy transactions_select_own on public.transactions
  for select using (user_id = auth.uid());

create policy transactions_insert_own on public.transactions
  for insert with check (user_id = auth.uid());

create policy transactions_update_own on public.transactions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy transactions_delete_own on public.transactions
  for delete using (user_id = auth.uid());
