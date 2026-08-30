-- Savings plan per project (budget derived from contributions + optional interest).

alter table public.projects
  add column savings_amount numeric(12, 2),
  add column savings_accrues_interest boolean not null default false,
  add column savings_interest_rate_annual numeric(5, 2),
  add column savings_start_date date,
  add column savings_end_date date;

alter table public.projects
  add constraint projects_savings_amount_non_negative check (
    savings_amount is null or savings_amount >= 0
  ),
  add constraint projects_savings_interest_rate_non_negative check (
    savings_interest_rate_annual is null or savings_interest_rate_annual >= 0
  ),
  add constraint projects_savings_date_order check (
    savings_start_date is null
    or savings_end_date is null
    or savings_end_date >= savings_start_date
  );
