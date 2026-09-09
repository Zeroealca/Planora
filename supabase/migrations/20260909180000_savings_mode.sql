-- Exclusive savings mode per project: none | plan | goal.
-- Separates goal monthly/start from legacy plan fields so they do not overwrite each other.

alter table public.projects
  add column if not exists savings_mode text not null default 'none',
  add column if not exists savings_goal_monthly_amount numeric(12, 2),
  add column if not exists savings_goal_start_date date;

alter table public.projects
  drop constraint if exists projects_savings_mode_check,
  drop constraint if exists projects_savings_goal_monthly_amount_non_negative;

alter table public.projects
  add constraint projects_savings_mode_check check (
    savings_mode in ('none', 'plan', 'goal')
  ),
  add constraint projects_savings_goal_monthly_amount_non_negative check (
    savings_goal_monthly_amount is null or savings_goal_monthly_amount >= 0
  );

-- Backfill mode + dedicated goal columns from previous shape.
update public.projects
set
  savings_mode = 'goal',
  savings_goal_monthly_amount = coalesce(savings_goal_monthly_amount, savings_amount),
  savings_goal_start_date = coalesce(savings_goal_start_date, savings_start_date),
  savings_goal_enabled = true
where savings_goal_enabled = true
   or (
     savings_target_amount is not null
     and savings_initial_balance is not null
   );

update public.projects
set
  savings_mode = 'plan',
  savings_goal_enabled = false
where savings_mode = 'none'
  and savings_amount is not null
  and savings_start_date is not null
  and savings_end_date is not null;

-- Keep boolean mirror for older clients / queries.
update public.projects
set savings_goal_enabled = (savings_mode = 'goal');
