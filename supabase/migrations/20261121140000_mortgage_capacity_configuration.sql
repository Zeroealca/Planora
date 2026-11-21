alter table public.mortgages
  add column capacity_monthly_income numeric(12, 2) not null default 0 check (capacity_monthly_income >= 0),
  add column capacity_monthly_debts numeric(12, 2) not null default 0 check (capacity_monthly_debts >= 0),
  add column capacity_max_income_percentage numeric(5, 2) not null default 30 check (capacity_max_income_percentage between 0 and 100),
  add column capacity_max_financing_percentage numeric(5, 2) not null default 80 check (capacity_max_financing_percentage between 0 and 100),
  add column capacity_calculation_method text not null default 'after_debts' check (capacity_calculation_method in ('after_debts', 'total_obligations'));
