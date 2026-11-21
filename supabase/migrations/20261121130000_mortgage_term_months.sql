-- Preserve an exact loan term when it is entered in months.
alter table public.mortgages
  add column term_months integer;

update public.mortgages
set term_months = term_years * 12
where term_months is null;

alter table public.mortgages
  alter column term_months set not null,
  add constraint mortgages_term_months_range_check check (term_months > 0 and term_months <= 600);
