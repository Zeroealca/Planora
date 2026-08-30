-- Purchase link per item.

alter table public.items
  add column purchase_url text;
