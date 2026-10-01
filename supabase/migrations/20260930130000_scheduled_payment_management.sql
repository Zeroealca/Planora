-- Fase 6B: controlled occurrence transitions. Transactions remain the sole
-- source of actual spending; no due date can create one automatically.

create or replace function public.mark_scheduled_payment_occurrence_paid(
  p_occurrence_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_notes text default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_occurrence public.scheduled_payment_occurrences%rowtype;
  v_payment public.scheduled_payments%rowtype;
  v_transaction public.transactions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select * into v_occurrence from public.scheduled_payment_occurrences
  where id = p_occurrence_id and user_id = auth.uid() for update;
  if not found then raise exception 'Occurrence not found'; end if;
  if v_occurrence.status <> 'pending' then raise exception 'Only pending occurrences can be paid'; end if;
  select * into v_payment from public.scheduled_payments
  where id = v_occurrence.scheduled_payment_id and user_id = auth.uid();
  if not found then raise exception 'Scheduled payment not found'; end if;

  insert into public.transactions (
    user_id, name, occurred_on, amount, transaction_type, financial_category_id, notes
  ) values (
    auth.uid(), v_payment.name, p_occurred_on, p_amount, 'expense', v_payment.financial_category_id, p_notes
  ) returning * into v_transaction;
  update public.scheduled_payment_occurrences
  set status = 'paid', transaction_id = v_transaction.id
  where id = v_occurrence.id;
  return v_transaction;
end; $$;

create or replace function public.skip_scheduled_payment_occurrence(p_occurrence_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.scheduled_payment_occurrences set status = 'skipped'
  where id = p_occurrence_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Only pending occurrences can be skipped'; end if;
end; $$;

-- Used by the existing transaction delete action. A linked occurrence returns
-- to pending in the same transaction; manual transactions retain normal delete behavior.
create or replace function public.delete_transaction_consistently(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_occurrence_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.transactions where id = p_transaction_id and user_id = auth.uid()) then
    raise exception 'Transaction not found';
  end if;
  select id into v_occurrence_id from public.scheduled_payment_occurrences
  where transaction_id = p_transaction_id and user_id = auth.uid() for update;
  if v_occurrence_id is not null then
    update public.scheduled_payment_occurrences
    set status = 'pending', transaction_id = null
    where id = v_occurrence_id;
  end if;
  delete from public.transactions where id = p_transaction_id and user_id = auth.uid();
end; $$;

revoke all on function public.mark_scheduled_payment_occurrence_paid(uuid, numeric, date, text) from public;
revoke all on function public.skip_scheduled_payment_occurrence(uuid) from public;
revoke all on function public.delete_transaction_consistently(uuid) from public;
grant execute on function public.mark_scheduled_payment_occurrence_paid(uuid, numeric, date, text) to authenticated;
grant execute on function public.skip_scheduled_payment_occurrence(uuid) to authenticated;
grant execute on function public.delete_transaction_consistently(uuid) to authenticated;
