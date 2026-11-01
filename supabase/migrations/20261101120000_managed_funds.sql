-- Funds administered for third parties are deliberately independent from
-- personal transactions, budgets, projects, and savings.

create table public.managed_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_funds_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index managed_funds_user_normalized_name_idx
  on public.managed_funds (user_id, lower(btrim(name)));

create index managed_funds_user_active_idx
  on public.managed_funds (user_id)
  where archived_at is null;

create table public.managed_fund_movements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.managed_funds (id) on delete cascade,
  occurred_on date not null,
  amount numeric(12, 2) not null,
  movement_type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_fund_movements_amount_positive check (amount > 0),
  constraint managed_fund_movements_type_check check (movement_type in ('income', 'expense')),
  constraint managed_fund_movements_expense_description_required check (
    movement_type <> 'expense' or char_length(trim(coalesce(description, ''))) > 0
  )
);

-- Covers chronological history and all prefix sums used to derive balances.
create index managed_fund_movements_fund_occurred_on_idx
  on public.managed_fund_movements (fund_id, occurred_on, created_at);

create or replace function public.validate_managed_fund_movement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_archived_at timestamptz;
begin
  select user_id, archived_at into v_owner_id, v_archived_at
  from public.managed_funds
  where id = new.fund_id;

  if v_owner_id is null then
    raise exception 'Managed fund not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Managed fund must belong to the authenticated user';
  end if;

  if tg_op = 'INSERT' and v_archived_at is not null then
    raise exception 'Archived managed funds cannot receive new movements';
  end if;

  if tg_op = 'UPDATE' and new.fund_id is distinct from old.fund_id then
    raise exception 'Managed fund cannot be changed for an existing movement';
  end if;

  return new;
end;
$$;

create trigger managed_funds_set_updated_at
  before update on public.managed_funds
  for each row execute function public.set_updated_at();

create trigger managed_fund_movements_set_updated_at
  before update on public.managed_fund_movements
  for each row execute function public.set_updated_at();

create trigger managed_fund_movements_validate_fund
  before insert or update on public.managed_fund_movements
  for each row execute function public.validate_managed_fund_movement();

alter table public.managed_funds enable row level security;
alter table public.managed_fund_movements enable row level security;

create policy managed_funds_select_own on public.managed_funds
  for select using (user_id = auth.uid());
create policy managed_funds_insert_own on public.managed_funds
  for insert with check (user_id = auth.uid());
create policy managed_funds_update_own on public.managed_funds
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy managed_fund_movements_select_own on public.managed_fund_movements
  for select using (exists (
    select 1 from public.managed_funds fund
    where fund.id = managed_fund_movements.fund_id and fund.user_id = auth.uid()
  ));
create policy managed_fund_movements_insert_own on public.managed_fund_movements
  for insert with check (exists (
    select 1 from public.managed_funds fund
    where fund.id = managed_fund_movements.fund_id and fund.user_id = auth.uid()
  ));
create policy managed_fund_movements_update_own on public.managed_fund_movements
  for update using (exists (
    select 1 from public.managed_funds fund
    where fund.id = managed_fund_movements.fund_id and fund.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.managed_funds fund
    where fund.id = managed_fund_movements.fund_id and fund.user_id = auth.uid()
  ));
create policy managed_fund_movements_delete_own on public.managed_fund_movements
  for delete using (exists (
    select 1 from public.managed_funds fund
    where fund.id = managed_fund_movements.fund_id and fund.user_id = auth.uid()
  ));
