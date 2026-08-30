-- Per-project customizable status and priority option lists.

alter table public.projects
  add column status_options jsonb not null default '[
    {"id":"Pending","label":"Pendiente","behavior":"pending","display_order":0},
    {"id":"Purchased","label":"Comprado","behavior":"purchased","display_order":1},
    {"id":"AlreadyOwned","label":"Ya lo tengo","behavior":"owned","display_order":2}
  ]'::jsonb,
  add column priority_options jsonb not null default '[
    {"id":"Critical","label":"Crítica","display_order":0},
    {"id":"High","label":"Alta","display_order":1},
    {"id":"Medium","label":"Media","display_order":2},
    {"id":"Optional","label":"Opcional","display_order":3}
  ]'::jsonb;

alter table public.items drop constraint items_status_check;
alter table public.items drop constraint items_priority_check;

alter table public.projects
  add constraint projects_status_options_is_array check (jsonb_typeof(status_options) = 'array'),
  add constraint projects_priority_options_is_array check (jsonb_typeof(priority_options) = 'array');
