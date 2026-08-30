-- Per-account currency preference (default USD).

alter table public.profiles
  add column currency_code text not null default 'USD';

alter table public.profiles
  add constraint profiles_currency_code_check check (
    currency_code in ('USD', 'EUR', 'MXN', 'COP', 'CLP', 'PEN', 'ARS', 'GBP', 'BRL')
  );
