-- A partial unique index checks each updated row. Changing the selected option
-- in one multi-row UPDATE can therefore attempt to set the new row to true
-- before PostgreSQL visits the old selected row. Clear the old selection first.
create or replace function public.select_item_option(p_option_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  -- Lock the parent item so concurrent selection requests for its options are
  -- serialized while preserving the caller's RLS permissions.
  select option.item_id into v_item_id
  from public.item_options as option
  join public.items as item on item.id = option.item_id
  where option.id = p_option_id
  for update of item;

  if v_item_id is null then
    raise exception 'option not found';
  end if;

  update public.item_options
  set selected = false
  where item_id = v_item_id
    and id <> p_option_id
    and selected = true;

  update public.item_options
  set selected = true
  where id = p_option_id
    and selected = false;
end;
$$;
