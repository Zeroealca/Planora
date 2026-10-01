-- Fase 6D: one_time frequency for scheduled payments.

alter table public.scheduled_payments
  drop constraint scheduled_payments_frequency_check;

alter table public.scheduled_payments
  add constraint scheduled_payments_frequency_check
    check (frequency in ('monthly', 'annual', 'one_time'));

alter table public.scheduled_payments
  drop constraint scheduled_payments_dates_valid;

alter table public.scheduled_payments
  add constraint scheduled_payments_dates_valid check (
    (
      frequency = 'one_time'
      and end_date is null
    )
    or (
      frequency <> 'one_time'
      and (end_date is null or end_date >= start_date)
    )
  );

comment on column public.scheduled_payments.frequency is
  'monthly | annual | one_time. For one_time, start_date is the sole due date and end_date must be null.';

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

  if v_payment.frequency = 'one_time' then
    if extract(year from v_payment.start_date)::integer <> v_year
      or extract(month from v_payment.start_date)::integer <> v_month then
      return null;
    end if;
    v_due_date := v_payment.start_date;
  else
    if v_payment.frequency = 'annual'
      and v_month <> extract(month from v_payment.start_date) then
      return null;
    end if;
    v_last_day := extract(day from (make_date(v_year, v_month, 1) + interval '1 month - 1 day'));
    v_due_date := make_date(
      v_year,
      v_month,
      least(extract(day from v_payment.start_date)::integer, v_last_day)
    );
    if v_due_date < v_payment.start_date
      or (v_payment.end_date is not null and v_due_date > v_payment.end_date) then
      return null;
    end if;
  end if;

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
