-- User-controlled inclusion in the purchase PDF. Existing items remain excluded
-- until the owner explicitly marks them.
alter table public.items
  add column include_in_purchase_report boolean not null default false;
