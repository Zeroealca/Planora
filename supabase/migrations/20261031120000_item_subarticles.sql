-- Optional purchase breakdowns for items in savings-plan projects.
create table public.item_subarticles (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  name text not null,
  estimated_cost numeric(12, 2),
  status text not null default 'pending',
  actual_cost numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_subarticles_name_not_blank check (char_length(trim(name)) > 0),
  constraint item_subarticles_status_check check (status in ('pending', 'purchased')),
  constraint item_subarticles_estimated_cost_non_negative check (
    estimated_cost is null or estimated_cost >= 0
  ),
  constraint item_subarticles_actual_cost_non_negative check (
    actual_cost is null or actual_cost >= 0
  )
);

create index item_subarticles_item_id_idx on public.item_subarticles (item_id);

create trigger item_subarticles_set_updated_at
  before update on public.item_subarticles
  for each row execute function public.set_updated_at();

create function public.assert_item_subarticle_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.items i
    join public.projects p on p.id = i.project_id
    where i.id = new.item_id and p.savings_mode = 'plan'
  ) then
    raise exception 'Subarticles are only available for items in savings-plan projects';
  end if;
  return new;
end;
$$;

create trigger item_subarticles_require_savings_plan
  before insert or update of item_id on public.item_subarticles
  for each row execute function public.assert_item_subarticle_plan();

create function public.prevent_savings_plan_removal_with_subarticles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.savings_mode <> 'plan' and exists (
    select 1
    from public.items i
    join public.item_subarticles s on s.item_id = i.id
    where i.project_id = new.id
  ) then
    raise exception 'Remove item subarticles before disabling this savings plan';
  end if;
  return new;
end;
$$;

create trigger projects_keep_plan_for_item_subarticles
  before update of savings_mode on public.projects
  for each row execute function public.prevent_savings_plan_removal_with_subarticles();

alter table public.item_subarticles enable row level security;

create policy item_subarticles_select_own on public.item_subarticles
  for select using (
    exists (
      select 1 from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_subarticles.item_id and p.user_id = auth.uid() and p.savings_mode = 'plan'
    )
  );

create policy item_subarticles_insert_own on public.item_subarticles
  for insert with check (
    exists (
      select 1 from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_subarticles.item_id and p.user_id = auth.uid() and p.savings_mode = 'plan'
    )
  );

create policy item_subarticles_update_own on public.item_subarticles
  for update using (
    exists (
      select 1 from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_subarticles.item_id and p.user_id = auth.uid() and p.savings_mode = 'plan'
    )
  ) with check (
    exists (
      select 1 from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_subarticles.item_id and p.user_id = auth.uid() and p.savings_mode = 'plan'
    )
  );

create policy item_subarticles_delete_own on public.item_subarticles
  for delete using (
    exists (
      select 1 from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_subarticles.item_id and p.user_id = auth.uid() and p.savings_mode = 'plan'
    )
  );
