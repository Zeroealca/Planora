-- Quantity per item. Unit prices stay in estimated_cost and item_options.price;
-- actual_cost stores the total paid amount.

alter table public.items
  add column quantity numeric(12, 2) not null default 1,
  add constraint items_quantity_positive check (quantity > 0);
