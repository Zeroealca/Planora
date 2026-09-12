-- Price tracking foundation for item_options.
-- Observations are historical facts. item_options.price remains Planora's
-- current operational price for budget calculations.

alter table public.item_options
  add column tracking_enabled boolean not null default false,
  add column tracked_price_type text not null default 'primary',
  add column target_price numeric(12, 2),
  add column alert_on_drop boolean not null default false,
  add column alert_on_increase boolean not null default false,
  add column alert_drop_percentage numeric(5, 2),
  add column last_checked_at timestamptz,
  add column tracking_status text not null default 'inactive',
  add constraint item_options_tracked_price_type_check
    check (tracked_price_type in ('primary', 'regular', 'promotional', 'cash', 'card')),
  add constraint item_options_target_price_positive
    check (target_price is null or target_price > 0),
  add constraint item_options_alert_drop_percentage_check
    check (alert_drop_percentage is null or (alert_drop_percentage > 0 and alert_drop_percentage <= 100)),
  add constraint item_options_tracking_status_check
    check (tracking_status in (
      'inactive',
      'active',
      'success',
      'price_not_found',
      'unavailable',
      'error',
      'needs_review'
    ));

create index item_options_tracking_enabled_idx
  on public.item_options (tracking_enabled)
  where tracking_enabled = true;

create index item_options_tracking_status_idx
  on public.item_options (tracking_status);

create table public.item_option_price_observations (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.item_options (id) on delete cascade,
  price numeric(12, 2),
  checked_at timestamptz not null default now(),
  status text not null,
  availability text not null default 'unknown',
  source text not null,
  price_type text,
  origin text not null default 'automatic',
  currency text,
  detected_prices jsonb not null default '[]'::jsonb,
  message text,
  created_at timestamptz not null default now(),
  constraint item_option_price_observations_price_positive
    check (price is null or price > 0),
  constraint item_option_price_observations_status_check
    check (status in ('success', 'price_not_found', 'unavailable', 'error', 'needs_review')),
  constraint item_option_price_observations_availability_check
    check (availability in ('available', 'unavailable', 'unknown')),
  constraint item_option_price_observations_price_type_check
    check (price_type is null or price_type in ('primary', 'regular', 'promotional', 'cash', 'card')),
  constraint item_option_price_observations_origin_check
    check (origin in ('automatic', 'manual')),
  constraint item_option_price_observations_source_not_blank
    check (char_length(trim(source)) > 0),
  constraint item_option_price_observations_detected_prices_array
    check (jsonb_typeof(detected_prices) = 'array')
);

create index item_option_price_observations_option_checked_idx
  on public.item_option_price_observations (option_id, checked_at desc);

create index item_option_price_observations_status_idx
  on public.item_option_price_observations (status);

alter table public.item_option_price_observations enable row level security;

create policy item_option_price_observations_select_own
  on public.item_option_price_observations
  for select using (
    exists (
      select 1
      from public.item_options o
      join public.items i on i.id = o.item_id
      join public.projects p on p.id = i.project_id
      where o.id = item_option_price_observations.option_id
        and p.user_id = auth.uid()
    )
  );

create policy item_option_price_observations_insert_own
  on public.item_option_price_observations
  for insert with check (
    exists (
      select 1
      from public.item_options o
      join public.items i on i.id = o.item_id
      join public.projects p on p.id = i.project_id
      where o.id = item_option_price_observations.option_id
        and p.user_id = auth.uid()
    )
  );

create policy item_option_price_observations_update_own
  on public.item_option_price_observations
  for update using (
    exists (
      select 1
      from public.item_options o
      join public.items i on i.id = o.item_id
      join public.projects p on p.id = i.project_id
      where o.id = item_option_price_observations.option_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.item_options o
      join public.items i on i.id = o.item_id
      join public.projects p on p.id = i.project_id
      where o.id = item_option_price_observations.option_id
        and p.user_id = auth.uid()
    )
  );

create policy item_option_price_observations_delete_own
  on public.item_option_price_observations
  for delete using (
    exists (
      select 1
      from public.item_options o
      join public.items i on i.id = o.item_id
      join public.projects p on p.id = i.project_id
      where o.id = item_option_price_observations.option_id
        and p.user_id = auth.uid()
    )
  );
