-- Allow owners to delete a scheduled payment rule entirely.
-- Occurrences and reminder deliveries are removed; linked Transactions remain.

create or replace function public.delete_scheduled_payment(p_scheduled_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.scheduled_payments
    where id = p_scheduled_payment_id
      and user_id = auth.uid()
  ) then
    raise exception 'Scheduled payment not found';
  end if;

  -- Deliveries reference occurrences with ON DELETE RESTRICT.
  delete from public.scheduled_payment_reminder_deliveries
  where scheduled_payment_id = p_scheduled_payment_id
    and user_id = auth.uid();

  -- Occurrences may reference Transactions; deleting the occurrence keeps the
  -- Transaction (the FK lives on the occurrence side).
  delete from public.scheduled_payment_occurrences
  where scheduled_payment_id = p_scheduled_payment_id
    and user_id = auth.uid();

  delete from public.scheduled_payments
  where id = p_scheduled_payment_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.delete_scheduled_payment(uuid) from public;
grant execute on function public.delete_scheduled_payment(uuid) to authenticated;
