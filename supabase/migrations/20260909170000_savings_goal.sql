-- Savings goal: independent from projects.budget.
-- Persist config + movements only; viable month / projections are derived in the client.

alter table public.projects
  add column if not exists savings_goal_enabled boolean not null default false,
  add column if not exists savings_initial_balance numeric(12, 2),
  add column if not exists savings_target_amount numeric(12, 2),
  add column if not exists savings_minimum_reserve numeric(12, 2);

alter table public.projects
  drop constraint if exists projects_savings_initial_balance_non_negative,
  drop constraint if exists projects_savings_target_amount_non_negative,
  drop constraint if exists projects_savings_minimum_reserve_non_negative;

alter table public.projects
  add constraint projects_savings_initial_balance_non_negative check (
    savings_initial_balance is null or savings_initial_balance >= 0
  ),
  add constraint projects_savings_target_amount_non_negative check (
    savings_target_amount is null or savings_target_amount >= 0
  ),
  add constraint projects_savings_minimum_reserve_non_negative check (
    savings_minimum_reserve is null or savings_minimum_reserve >= 0
  );

create table if not exists public.project_savings_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  movement_date date not null,
  amount numeric(12, 2) not null,
  movement_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_savings_movements_name_not_blank check (char_length(trim(name)) > 0),
  constraint project_savings_movements_amount_positive check (amount > 0),
  constraint project_savings_movements_type_check check (
    movement_type in ('inflow', 'outflow')
  )
);

create index if not exists project_savings_movements_project_id_idx
  on public.project_savings_movements (project_id);

create index if not exists project_savings_movements_project_date_idx
  on public.project_savings_movements (project_id, movement_date);

drop trigger if exists project_savings_movements_set_updated_at on public.project_savings_movements;
create trigger project_savings_movements_set_updated_at
  before update on public.project_savings_movements
  for each row execute function public.set_updated_at();

alter table public.project_savings_movements enable row level security;

drop policy if exists project_savings_movements_select_own on public.project_savings_movements;
drop policy if exists project_savings_movements_insert_own on public.project_savings_movements;
drop policy if exists project_savings_movements_update_own on public.project_savings_movements;
drop policy if exists project_savings_movements_delete_own on public.project_savings_movements;

create policy project_savings_movements_select_own on public.project_savings_movements
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_savings_movements.project_id and p.user_id = auth.uid()
    )
  );

create policy project_savings_movements_insert_own on public.project_savings_movements
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_savings_movements.project_id and p.user_id = auth.uid()
    )
  );

create policy project_savings_movements_update_own on public.project_savings_movements
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = project_savings_movements.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_savings_movements.project_id and p.user_id = auth.uid()
    )
  );

create policy project_savings_movements_delete_own on public.project_savings_movements
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = project_savings_movements.project_id and p.user_id = auth.uid()
    )
  );
