-- Initial schema: profiles, projects, categories, items, item_options.
-- RLS, storage bucket, and select_item_option live in the same delivery.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  budget numeric(12, 2),
  icon text,
  label_preset text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (char_length(trim(name)) > 0),
  constraint projects_budget_non_negative check (budget is null or budget >= 0),
  constraint projects_label_preset_check check (label_preset in ('default', 'move_in'))
);

create index projects_user_id_idx on public.projects (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (char_length(trim(name)) > 0)
);

create index categories_project_id_idx on public.categories (project_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'Pending',
  priority text not null default 'Medium',
  estimated_cost numeric(12, 2),
  actual_cost numeric(12, 2),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_name_not_blank check (char_length(trim(name)) > 0),
  constraint items_status_check check (status in ('Pending', 'Purchased', 'AlreadyOwned')),
  constraint items_priority_check check (priority in ('Critical', 'High', 'Medium', 'Optional')),
  constraint items_estimated_cost_non_negative check (estimated_cost is null or estimated_cost >= 0),
  constraint items_actual_cost_non_negative check (actual_cost is null or actual_cost >= 0)
);

create index items_project_id_idx on public.items (project_id);
create index items_category_id_idx on public.items (category_id);
create index items_project_status_idx on public.items (project_id, status);
create index items_project_priority_idx on public.items (project_id, priority);

create table public.item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  name text not null,
  brand text,
  model text,
  price numeric(12, 2),
  store text,
  product_url text,
  image_url text,
  description text,
  specifications text,
  notes text,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_options_name_not_blank check (char_length(trim(name)) > 0),
  constraint item_options_price_non_negative check (price is null or price >= 0)
);

create index item_options_item_id_idx on public.item_options (item_id);

create unique index item_options_one_selected_idx
  on public.item_options (item_id)
  where selected = true;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create trigger item_options_set_updated_at
  before update on public.item_options
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic "exactly one selected option per item". RLS still applies (invoker).
create or replace function public.select_item_option(p_option_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  select item_id into v_item_id
  from public.item_options
  where id = p_option_id;

  if v_item_id is null then
    raise exception 'option not found';
  end if;

  update public.item_options
  set selected = (id = p_option_id)
  where item_id = v_item_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.item_options enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy projects_select_own on public.projects
  for select using (user_id = auth.uid());

create policy projects_insert_own on public.projects
  for insert with check (user_id = auth.uid());

create policy projects_update_own on public.projects
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy projects_delete_own on public.projects
  for delete using (user_id = auth.uid());

create policy categories_select_own on public.categories
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = categories.project_id and p.user_id = auth.uid()
    )
  );

create policy categories_insert_own on public.categories
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = categories.project_id and p.user_id = auth.uid()
    )
  );

create policy categories_update_own on public.categories
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = categories.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = categories.project_id and p.user_id = auth.uid()
    )
  );

create policy categories_delete_own on public.categories
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = categories.project_id and p.user_id = auth.uid()
    )
  );

create policy items_select_own on public.items
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = items.project_id and p.user_id = auth.uid()
    )
  );

create policy items_insert_own on public.items
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = items.project_id and p.user_id = auth.uid()
    )
  );

create policy items_update_own on public.items
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = items.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = items.project_id and p.user_id = auth.uid()
    )
  );

create policy items_delete_own on public.items
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = items.project_id and p.user_id = auth.uid()
    )
  );

create policy item_options_select_own on public.item_options
  for select using (
    exists (
      select 1
      from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_options.item_id and p.user_id = auth.uid()
    )
  );

create policy item_options_insert_own on public.item_options
  for insert with check (
    exists (
      select 1
      from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_options.item_id and p.user_id = auth.uid()
    )
  );

create policy item_options_update_own on public.item_options
  for update using (
    exists (
      select 1
      from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_options.item_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_options.item_id and p.user_id = auth.uid()
    )
  );

create policy item_options_delete_own on public.item_options
  for delete using (
    exists (
      select 1
      from public.items i
      join public.projects p on p.id = i.project_id
      where i.id = item_options.item_id and p.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('item-option-images', 'item-option-images', false)
on conflict (id) do nothing;

-- Path: {user_id}/{project_id}/{item_id}/{filename}
create policy option_images_select_own
  on storage.objects for select
  using (
    bucket_id = 'item-option-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy option_images_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'item-option-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy option_images_update_own
  on storage.objects for update
  using (
    bucket_id = 'item-option-images'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'item-option-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy option_images_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'item-option-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );
