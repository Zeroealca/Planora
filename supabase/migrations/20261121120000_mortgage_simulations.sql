-- Mortgage planning is deliberately isolated from budgets, transactions, projects and funds.
create table public.mortgages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  property_price numeric(12, 2) not null check (property_price > 0),
  down_payment numeric(12, 2) not null default 0 check (down_payment >= 0),
  requested_credit numeric(12, 2) not null check (requested_credit >= 0),
  term_years integer not null check (term_years > 0 and term_years <= 50),
  annual_rate numeric(8, 5) not null check (annual_rate >= 0),
  rate_type text not null default 'nominal' check (rate_type in ('nominal', 'effective')),
  compounding_frequency text not null default 'monthly' check (compounding_frequency in ('monthly', 'quarterly', 'semiannual', 'annual')),
  start_date date not null,
  monthly_insurance numeric(12, 2) not null default 0 check (monthly_insurance >= 0),
  monthly_fees numeric(12, 2) not null default 0 check (monthly_fees >= 0),
  initial_costs numeric(12, 2) not null default 0 check (initial_costs >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mortgages_name_not_blank check (char_length(btrim(name)) > 0)
);
create index mortgages_user_updated_idx on public.mortgages (user_id, updated_at desc);
create table public.mortgage_scenarios (
  id uuid primary key default gen_random_uuid(), mortgage_id uuid not null references public.mortgages (id) on delete cascade,
  name text not null, repayment_strategy text not null default 'reduce_term' check (repayment_strategy in ('reduce_term', 'reduce_payment')),
  periodic_extra_amount numeric(12, 2) check (periodic_extra_amount is null or periodic_extra_amount > 0),
  periodic_extra_frequency text not null default 'annual' check (periodic_extra_frequency in ('monthly', 'quarterly', 'semiannual', 'annual')),
  periodic_extra_start_month integer not null default 1 check (periodic_extra_start_month > 0), one_time_extras jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mortgage_scenarios_name_not_blank check (char_length(btrim(name)) > 0)
);
create index mortgage_scenarios_mortgage_idx on public.mortgage_scenarios (mortgage_id, created_at);
create trigger mortgages_set_updated_at before update on public.mortgages for each row execute function public.set_updated_at();
create trigger mortgage_scenarios_set_updated_at before update on public.mortgage_scenarios for each row execute function public.set_updated_at();
alter table public.mortgages enable row level security; alter table public.mortgage_scenarios enable row level security;
create policy mortgages_own on public.mortgages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mortgage_scenarios_own on public.mortgage_scenarios for all using (exists (select 1 from public.mortgages m where m.id = mortgage_scenarios.mortgage_id and m.user_id = auth.uid())) with check (exists (select 1 from public.mortgages m where m.id = mortgage_scenarios.mortgage_id and m.user_id = auth.uid()));
