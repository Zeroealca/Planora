-- Fase 6C: email reminders for scheduled payment occurrences.
-- Configuration lives on the rule; delivery is tracked per occurrence.

alter table public.scheduled_payments
  add column reminder_enabled boolean not null default false,
  add column reminder_days_before integer not null default 7,
  add constraint scheduled_payments_reminder_days_before_check
    check (reminder_days_before >= 0);

comment on column public.scheduled_payments.reminder_enabled is
  'When false, no reminder emails are sent for this rule. Default off (explicit consent).';
comment on column public.scheduled_payments.reminder_days_before is
  'Civil days before due_date for the single reminder. 0 = due date itself.';

create table public.scheduled_payment_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_payment_id uuid not null references public.scheduled_payments (id) on delete restrict,
  occurrence_id uuid not null references public.scheduled_payment_occurrences (id) on delete restrict,
  reminder_date date not null,
  days_before_due integer not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_payment_reminder_deliveries_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint scheduled_payment_reminder_deliveries_days_before_check
    check (days_before_due >= 0),
  constraint scheduled_payment_reminder_deliveries_attempt_count_check
    check (attempt_count >= 0),
  -- V1: at most one reminder delivery row per occurrence (dedupe + concurrency).
  constraint scheduled_payment_reminder_deliveries_occurrence_unique unique (occurrence_id)
);

create index scheduled_payment_reminder_deliveries_user_status_idx
  on public.scheduled_payment_reminder_deliveries (user_id, status);
create index scheduled_payment_reminder_deliveries_status_updated_idx
  on public.scheduled_payment_reminder_deliveries (status, updated_at);

create trigger scheduled_payment_reminder_deliveries_set_updated_at
  before update on public.scheduled_payment_reminder_deliveries
  for each row execute function public.set_updated_at();

alter table public.scheduled_payment_reminder_deliveries enable row level security;

-- Owners may read their delivery history (e.g. "Recordatorio enviado").
-- Inserts/updates happen only via service_role / claim RPCs from the job.
create policy scheduled_payment_reminder_deliveries_select_own
  on public.scheduled_payment_reminder_deliveries
  for select using (user_id = auth.uid());

-- Claim a reminder for sending. Concurrent workers cannot both obtain a claim
-- for the same occurrence thanks to the unique constraint + conditional upsert.
create or replace function public.claim_scheduled_payment_reminder(
  p_occurrence_id uuid,
  p_reminder_date date,
  p_days_before_due integer
) returns public.scheduled_payment_reminder_deliveries
language plpgsql security definer set search_path = public as $$
declare
  v_occurrence public.scheduled_payment_occurrences%rowtype;
  v_payment public.scheduled_payments%rowtype;
  v_delivery public.scheduled_payment_reminder_deliveries%rowtype;
  v_stale_before timestamptz := now() - interval '15 minutes';
begin
  if p_days_before_due is null or p_days_before_due < 0 then
    raise exception 'days_before_due must be >= 0';
  end if;

  select * into v_occurrence
  from public.scheduled_payment_occurrences
  where id = p_occurrence_id
  for update;
  if not found then raise exception 'Occurrence not found'; end if;
  if v_occurrence.status <> 'pending' then
    return null;
  end if;

  select * into v_payment
  from public.scheduled_payments
  where id = v_occurrence.scheduled_payment_id
  for update;
  if not found or not v_payment.active or not v_payment.reminder_enabled then
    return null;
  end if;

  if not exists (
    select 1 from public.financial_categories c
    where c.id = v_payment.financial_category_id
      and c.user_id = v_payment.user_id
      and c.archived_at is null
  ) then
    return null;
  end if;

  insert into public.scheduled_payment_reminder_deliveries (
    user_id,
    scheduled_payment_id,
    occurrence_id,
    reminder_date,
    days_before_due,
    status,
    attempt_count,
    last_error,
    sent_at
  ) values (
    v_occurrence.user_id,
    v_occurrence.scheduled_payment_id,
    v_occurrence.id,
    p_reminder_date,
    p_days_before_due,
    'processing',
    1,
    null,
    null
  )
  on conflict (occurrence_id) do update
  set
    reminder_date = excluded.reminder_date,
    days_before_due = excluded.days_before_due,
    status = 'processing',
    attempt_count = public.scheduled_payment_reminder_deliveries.attempt_count + 1,
    last_error = null,
    sent_at = null,
    updated_at = now()
  where public.scheduled_payment_reminder_deliveries.status in ('pending', 'failed')
     or (
       public.scheduled_payment_reminder_deliveries.status = 'processing'
       and public.scheduled_payment_reminder_deliveries.updated_at < v_stale_before
     )
  returning * into v_delivery;

  return v_delivery;
end; $$;

create or replace function public.complete_scheduled_payment_reminder(
  p_delivery_id uuid,
  p_status text,
  p_error text default null
) returns public.scheduled_payment_reminder_deliveries
language plpgsql security definer set search_path = public as $$
declare
  v_delivery public.scheduled_payment_reminder_deliveries%rowtype;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'status must be sent or failed';
  end if;

  update public.scheduled_payment_reminder_deliveries
  set
    status = p_status,
    last_error = case when p_status = 'failed' then left(coalesce(p_error, 'unknown error'), 500) else null end,
    sent_at = case when p_status = 'sent' then now() else sent_at end,
    updated_at = now()
  where id = p_delivery_id
    and status = 'processing'
  returning * into v_delivery;

  if not found then
    raise exception 'Delivery not found or not processing';
  end if;

  return v_delivery;
end; $$;

revoke all on function public.claim_scheduled_payment_reminder(uuid, date, integer) from public;
revoke all on function public.complete_scheduled_payment_reminder(uuid, text, text) from public;
grant execute on function public.claim_scheduled_payment_reminder(uuid, date, integer) to service_role;
grant execute on function public.complete_scheduled_payment_reminder(uuid, text, text) to service_role;
