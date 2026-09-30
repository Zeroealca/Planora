-- Reusable planning templates. Budgets created from these rows are snapshots.
create table public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  suggested_available_amount numeric(12, 2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint budget_templates_name_not_blank check (char_length(trim(name)) > 0),
  constraint budget_templates_available_non_negative check (suggested_available_amount is null or suggested_available_amount >= 0)
);
create unique index budget_templates_user_normalized_name_idx on public.budget_templates (user_id, lower(btrim(name)));

create table public.budget_template_allocations (
  id uuid primary key default gen_random_uuid(),
  budget_template_id uuid not null references public.budget_templates (id) on delete cascade,
  financial_category_id uuid not null references public.financial_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (budget_template_id, financial_category_id)
);

create or replace function public.validate_budget_template_allocation()
returns trigger language plpgsql set search_path = public as $$
declare v_template_user_id uuid; v_category_user_id uuid; v_archived_at timestamptz;
begin
  select user_id into v_template_user_id from public.budget_templates where id = new.budget_template_id;
  select user_id, archived_at into v_category_user_id, v_archived_at from public.financial_categories where id = new.financial_category_id;
  if v_template_user_id is null or v_category_user_id is null or v_template_user_id <> v_category_user_id then
    raise exception 'Template and financial category must belong to the same user';
  end if;
  if v_archived_at is not null and (tg_op = 'INSERT' or new.financial_category_id is distinct from old.financial_category_id) then
    raise exception 'Archived financial categories cannot be assigned to a template';
  end if;
  return new;
end; $$;
create trigger budget_templates_set_updated_at before update on public.budget_templates for each row execute function public.set_updated_at();
create trigger budget_template_allocations_set_updated_at before update on public.budget_template_allocations for each row execute function public.set_updated_at();
create trigger budget_template_allocations_validate_ownership before insert or update on public.budget_template_allocations for each row execute function public.validate_budget_template_allocation();

alter table public.budget_templates enable row level security;
alter table public.budget_template_allocations enable row level security;
create policy budget_templates_own on public.budget_templates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy budget_template_allocations_own on public.budget_template_allocations for all using (
  exists (select 1 from public.budget_templates t where t.id = budget_template_id and t.user_id = auth.uid())
  and exists (select 1 from public.financial_categories c where c.id = financial_category_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.budget_templates t where t.id = budget_template_id and t.user_id = auth.uid())
  and exists (select 1 from public.financial_categories c where c.id = financial_category_id and c.user_id = auth.uid())
);

-- A single PostgreSQL transaction creates the target budget and all active allocations.
create or replace function public.create_monthly_budget_snapshot(
  p_period text, p_available_amount numeric, p_source_budget_id uuid default null, p_source_template_id uuid default null
) returns uuid language plpgsql set search_path = public as $$
declare v_budget_id uuid; v_source_available numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if (p_source_budget_id is null) = (p_source_template_id is null) then raise exception 'Choose exactly one source'; end if;
  if exists (select 1 from public.monthly_budgets where user_id = auth.uid() and period = p_period) then raise exception 'A budget already exists for this period'; end if;
  if p_source_budget_id is not null then
    select available_amount into v_source_available from public.monthly_budgets where id = p_source_budget_id and user_id = auth.uid();
    if v_source_available is null then raise exception 'Source budget not found'; end if;
  else
    select suggested_available_amount into v_source_available from public.budget_templates where id = p_source_template_id and user_id = auth.uid();
    if not found then raise exception 'Template not found'; end if;
  end if;
  insert into public.monthly_budgets (user_id, period, available_amount) values (auth.uid(), p_period, coalesce(p_available_amount, v_source_available)) returning id into v_budget_id;
  insert into public.monthly_budget_allocations (monthly_budget_id, financial_category_id, amount)
    select v_budget_id, a.financial_category_id, a.amount
    from (select financial_category_id, amount from public.monthly_budget_allocations where monthly_budget_id = p_source_budget_id
          union all select financial_category_id, amount from public.budget_template_allocations where budget_template_id = p_source_template_id) a
    join public.financial_categories c on c.id = a.financial_category_id
    where c.user_id = auth.uid() and c.archived_at is null;
  return v_budget_id;
end; $$;

create or replace function public.create_budget_template_from_monthly_budget(p_source_budget_id uuid, p_name text)
returns uuid language plpgsql set search_path = public as $$
declare v_template_id uuid; v_available numeric;
begin
  select available_amount into v_available from public.monthly_budgets where id = p_source_budget_id and user_id = auth.uid();
  if v_available is null then raise exception 'Source budget not found'; end if;
  insert into public.budget_templates (user_id, name, suggested_available_amount) values (auth.uid(), p_name, v_available) returning id into v_template_id;
  insert into public.budget_template_allocations (budget_template_id, financial_category_id, amount)
    select v_template_id, a.financial_category_id, a.amount from public.monthly_budget_allocations a
    join public.financial_categories c on c.id = a.financial_category_id
    where a.monthly_budget_id = p_source_budget_id and c.user_id = auth.uid() and c.archived_at is null;
  return v_template_id;
end; $$;
