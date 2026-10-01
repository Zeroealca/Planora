-- Scheduled payments describe a recurring obligation. Occurrences are immutable
-- snapshots of individual due dates; neither is a financial transaction.

create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  financial_category_id uuid not null references public.financial_categories (id) on delete restrict,
  frequency text not null,
  amount_type text not null,
  expected_amount numeric(12, 2),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_payments_name_not_blank check (char_length(trim(name)) > 0),
  constraint scheduled_payments_frequency_check check (frequency in ('monthly', 'annual')),
  constraint scheduled_payments_amount_type_check check (amount_type in ('fixed', 'variable')),
  constraint scheduled_payments_expected_amount_positive check (expected_amount is null or expected_amount > 0),
  constraint scheduled_payments_fixed_amount_required check (
    amount_type <> 'fixed' or expected_amount is not null
  ),
  constraint scheduled_payments_dates_valid check (end_date is null or end_date >= start_date)
);

create index scheduled_payments_user_active_idx on public.scheduled_payments (user_id) where active;
create index scheduled_payments_category_id_idx on public.scheduled_payments (financial_category_id);

create table public.scheduled_payment_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_payment_id uuid not null references public.scheduled_payments (id) on delete restrict,
  due_date date not null,
  expected_amount numeric(12, 2),
  status text not null default 'pending',
  transaction_id uuid references public.transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_payment_occurrences_status_check check (status in ('pending', 'paid', 'skipped')),
  constraint scheduled_payment_occurrences_expected_amount_positive check (expected_amount is null or expected_amount > 0),
  -- Fase 6B will set paid and create its transaction atomically.
  constraint scheduled_payment_occurrences_paid_transaction_required check (
    status <> 'paid' or transaction_id is not null
  ),
  constraint scheduled_payment_occurrences_payment_due_unique unique (scheduled_payment_id, due_date)
);

create index scheduled_payment_occurrences_user_due_date_idx on public.scheduled_payment_occurrences (user_id, due_date);

create or replace function public.validate_scheduled_payment_category()
returns trigger language plpgsql set search_path = public as $$
declare v_category_user_id uuid; v_archived_at timestamptz;
begin
  select user_id, archived_at into v_category_user_id, v_archived_at
  from public.financial_categories where id = new.financial_category_id;
  if v_category_user_id is null or v_category_user_id <> new.user_id then
    raise exception 'Scheduled payment and financial category must belong to the same user';
  end if;
  if v_archived_at is not null and (tg_op = 'INSERT' or new.financial_category_id is distinct from old.financial_category_id) then
    raise exception 'Archived financial categories cannot be assigned to a scheduled payment';
  end if;
  return new;
end; $$;

create or replace function public.validate_scheduled_payment_occurrence()
returns trigger language plpgsql set search_path = public as $$
declare v_payment_user_id uuid;
begin
  select user_id into v_payment_user_id from public.scheduled_payments where id = new.scheduled_payment_id;
  if v_payment_user_id is null or v_payment_user_id <> new.user_id then
    raise exception 'Occurrence and scheduled payment must belong to the same user';
  end if;
  return new;
end; $$;

create trigger scheduled_payments_set_updated_at before update on public.scheduled_payments
  for each row execute function public.set_updated_at();
create trigger scheduled_payment_occurrences_set_updated_at before update on public.scheduled_payment_occurrences
  for each row execute function public.set_updated_at();
create trigger scheduled_payments_validate_category before insert or update on public.scheduled_payments
  for each row execute function public.validate_scheduled_payment_category();
create trigger scheduled_payment_occurrences_validate_ownership before insert or update on public.scheduled_payment_occurrences
  for each row execute function public.validate_scheduled_payment_occurrence();

-- Idempotent materialization: a client may request the same period repeatedly.
-- The database computes the civil due date and snapshots the current expected amount.
create or replace function public.materialize_scheduled_payment_occurrence(
  p_scheduled_payment_id uuid,
  p_period text
) returns public.scheduled_payment_occurrences
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.scheduled_payments%rowtype;
  v_due_date date;
  v_year integer;
  v_month integer;
  v_last_day integer;
  v_result public.scheduled_payment_occurrences%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Period must use YYYY-MM'; end if;
  select * into v_payment from public.scheduled_payments
  where id = p_scheduled_payment_id and user_id = auth.uid();
  if not found or not v_payment.active then return null; end if;
  if not exists (
    select 1 from public.financial_categories c
    where c.id = v_payment.financial_category_id and c.user_id = auth.uid() and c.archived_at is null
  ) then return null; end if;

  v_year := substring(p_period, 1, 4)::integer;
  v_month := substring(p_period, 6, 2)::integer;
  if v_payment.frequency = 'annual' and v_month <> extract(month from v_payment.start_date) then return null; end if;
  v_last_day := extract(day from (make_date(v_year, v_month, 1) + interval '1 month - 1 day'));
  v_due_date := make_date(v_year, v_month, least(extract(day from v_payment.start_date)::integer, v_last_day));
  if v_due_date < v_payment.start_date or (v_payment.end_date is not null and v_due_date > v_payment.end_date) then return null; end if;

  insert into public.scheduled_payment_occurrences (
    user_id, scheduled_payment_id, due_date, expected_amount, status
  ) values (v_payment.user_id, v_payment.id, v_due_date, v_payment.expected_amount, 'pending')
  on conflict (scheduled_payment_id, due_date) do nothing
  returning * into v_result;
  if not found then
    select * into v_result from public.scheduled_payment_occurrences
    where scheduled_payment_id = v_payment.id and due_date = v_due_date;
  end if;
  return v_result;
end; $$;

revoke all on function public.materialize_scheduled_payment_occurrence(uuid, text) from public;
grant execute on function public.materialize_scheduled_payment_occurrence(uuid, text) to authenticated;

alter table public.scheduled_payments enable row level security;
alter table public.scheduled_payment_occurrences enable row level security;

create policy scheduled_payments_select_own on public.scheduled_payments for select using (user_id = auth.uid());
create policy scheduled_payments_insert_own on public.scheduled_payments for insert with check (user_id = auth.uid());
create policy scheduled_payments_update_own on public.scheduled_payments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No delete policy: deactivate rules and preserve their occurrence history.

create policy scheduled_payment_occurrences_select_own on public.scheduled_payment_occurrences
  for select using (user_id = auth.uid());
-- No direct insert, update, or delete policies. Fase 6B will add an atomic
-- paid/skipped operation instead of exposing mutable historical records.
