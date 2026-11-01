-- Configurable estimated account yield and separately recorded credited interest.
-- TEA is the default. Annual rates are limited to 100% to reject likely input mistakes.

alter table public.projects
  add column if not exists savings_interest_rate_type text not null default 'tea',
  add column if not exists savings_interest_compounding_frequency text not null default 'monthly';

alter table public.projects
  drop constraint if exists projects_savings_interest_rate_reasonable,
  drop constraint if exists projects_savings_interest_rate_type_check,
  drop constraint if exists projects_savings_interest_compounding_frequency_check;

alter table public.projects
  add constraint projects_savings_interest_rate_reasonable check (
    savings_interest_rate_annual is null
    or (savings_interest_rate_annual >= 0 and savings_interest_rate_annual <= 100)
  ),
  add constraint projects_savings_interest_rate_type_check check (
    savings_interest_rate_type in ('tea', 'tna')
  ),
  add constraint projects_savings_interest_compounding_frequency_check check (
    savings_interest_compounding_frequency in ('monthly', 'quarterly', 'semiannual', 'annual')
  );

alter table public.project_savings_movements
  add column if not exists movement_kind text not null default 'contribution',
  add column if not exists description text;

alter table public.project_savings_movements
  drop constraint if exists project_savings_movements_kind_check,
  drop constraint if exists project_savings_movements_interest_is_inflow;

alter table public.project_savings_movements
  add constraint project_savings_movements_kind_check check (
    movement_kind in ('contribution', 'interest')
  ),
  add constraint project_savings_movements_interest_is_inflow check (
    movement_kind <> 'interest' or movement_type = 'inflow'
  );

-- Existing policies already protect this table through project ownership; no new table or policy is needed.
