-- Monthly budgets are independent from projects and contain planning only.
-- Actual financial movements are intentionally not part of this migration.

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_categories_name_not_blank check (char_length(trim(name)) > 0)
);

-- Case- and surrounding-whitespace-insensitive per-user duplicate protection.
create unique index financial_categories_user_normalized_name_idx
  on public.financial_categories (user_id, lower(btrim(name)));

create index financial_categories_user_active_idx
  on public.financial_categories (user_id)
  where archived_at is null;

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null,
  available_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budgets_period_format_check check (
    period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  constraint monthly_budgets_available_amount_non_negative check (available_amount >= 0),
  constraint monthly_budgets_user_period_unique unique (user_id, period)
);

create index monthly_budgets_user_period_idx
  on public.monthly_budgets (user_id, period);

create table public.monthly_budget_allocations (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets (id) on delete cascade,
  financial_category_id uuid not null references public.financial_categories (id) on delete restrict,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budget_allocations_amount_non_negative check (amount >= 0),
  constraint monthly_budget_allocations_budget_category_unique unique (
    monthly_budget_id,
    financial_category_id
  )
);

create index monthly_budget_allocations_category_id_idx
  on public.monthly_budget_allocations (financial_category_id);

create or replace function public.validate_monthly_budget_allocation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_budget_user_id uuid;
  v_category_user_id uuid;
  v_category_archived_at timestamptz;
begin
  select user_id into v_budget_user_id
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

  return new;
end;
$$;

create trigger financial_categories_set_updated_at
  before update on public.financial_categories
  for each row execute function public.set_updated_at();

create trigger monthly_budgets_set_updated_at
  before update on public.monthly_budgets
  for each row execute function public.set_updated_at();

create trigger monthly_budget_allocations_set_updated_at
  before update on public.monthly_budget_allocations
  for each row execute function public.set_updated_at();

create trigger monthly_budget_allocations_validate_ownership
  before insert or update on public.monthly_budget_allocations
  for each row execute function public.validate_monthly_budget_allocation();

alter table public.financial_categories enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.monthly_budget_allocations enable row level security;

create policy financial_categories_select_own on public.financial_categories
  for select using (user_id = auth.uid());

create policy financial_categories_insert_own on public.financial_categories
  for insert with check (user_id = auth.uid());

create policy financial_categories_update_own on public.financial_categories
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Categories preserve history through archival; no delete policy is provided.

create policy monthly_budgets_select_own on public.monthly_budgets
  for select using (user_id = auth.uid());

create policy monthly_budgets_insert_own on public.monthly_budgets
  for insert with check (user_id = auth.uid());

create policy monthly_budgets_update_own on public.monthly_budgets
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy monthly_budgets_delete_own on public.monthly_budgets
  for delete using (user_id = auth.uid());

create policy monthly_budget_allocations_select_own on public.monthly_budget_allocations
  for select using (
    exists (
      select 1 from public.monthly_budgets budget
      where budget.id = monthly_budget_allocations.monthly_budget_id
        and budget.user_id = auth.uid()
    )
    and exists (
      select 1 from public.financial_categories category
      where category.id = monthly_budget_allocations.financial_category_id
        and category.user_id = auth.uid()
    )
  );

create policy monthly_budget_allocations_insert_own on public.monthly_budget_allocations
  for insert with check (
    exists (
      select 1 from public.monthly_budgets budget
      where budget.id = monthly_budget_allocations.monthly_budget_id
        and budget.user_id = auth.uid()
    )
    and exists (
      select 1 from public.financial_categories category
      where category.id = monthly_budget_allocations.financial_category_id
        and category.user_id = auth.uid()
    )
  );

create policy monthly_budget_allocations_update_own on public.monthly_budget_allocations
  for update using (
    exists (
      select 1 from public.monthly_budgets budget
      where budget.id = monthly_budget_allocations.monthly_budget_id
        and budget.user_id = auth.uid()
    )
    and exists (
      select 1 from public.financial_categories category
      where category.id = monthly_budget_allocations.financial_category_id
        and category.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.monthly_budgets budget
      where budget.id = monthly_budget_allocations.monthly_budget_id
        and budget.user_id = auth.uid()
    )
    and exists (
      select 1 from public.financial_categories category
      where category.id = monthly_budget_allocations.financial_category_id
        and category.user_id = auth.uid()
    )
  );

create policy monthly_budget_allocations_delete_own on public.monthly_budget_allocations
  for delete using (
    exists (
      select 1 from public.monthly_budgets budget
      where budget.id = monthly_budget_allocations.monthly_budget_id
        and budget.user_id = auth.uid()
    )
    and exists (
      select 1 from public.financial_categories category
      where category.id = monthly_budget_allocations.financial_category_id
        and category.user_id = auth.uid()
    )
  );
