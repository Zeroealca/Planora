-- Least-privilege hardening for RPCs invoked from the browser.
-- These functions already validate ownership/RLS; this removes the default
-- PUBLIC execute grant without altering schema or application data.

revoke all on function public.select_item_option(uuid) from public;
grant execute on function public.select_item_option(uuid) to authenticated;

revoke all on function public.create_monthly_budget_snapshot(text, numeric, uuid, uuid) from public;
grant execute on function public.create_monthly_budget_snapshot(text, numeric, uuid, uuid) to authenticated;

revoke all on function public.create_budget_template_from_monthly_budget(uuid, text) from public;
grant execute on function public.create_budget_template_from_monthly_budget(uuid, text) to authenticated;
