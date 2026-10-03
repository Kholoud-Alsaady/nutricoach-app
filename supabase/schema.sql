-- =============================================================================
-- NutriCoach — Supabase schema
-- Run this once in the Supabase SQL editor (or `npm run db:setup` if you set
-- SUPABASE_DB_URL). It is idempotent: safe to run again.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Gyms: one row per gym, holds the business assumptions used by the ROI view.
-- All money values are EGP. These are DEMO / MODELED assumptions.
-- -----------------------------------------------------------------------------
create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subscription_price numeric not null default 500,            -- EGP / member / month
  traditional_nutrition_price numeric not null default 300,   -- EGP / member / month
  estimated_coach_hourly_value numeric not null default 200,  -- EGP / hour
  estimated_manual_minutes_per_member numeric not null default 120, -- per month
  estimated_agent_minutes_per_member numeric not null default 30,   -- per month
  ai_cost numeric not null default 10,                        -- modeled EGP / member / month
  infrastructure_cost numeric not null default 1500,          -- EGP / month
  modeled_member_count int not null default 50,
  usd_to_egp numeric not null default 48,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profiles: one row per auth user. role decides which interface they get.
-- coach_id assigns a member to a coach.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  role text not null check (role in ('admin', 'coach', 'member')),
  coach_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  age int,
  sex text,
  height numeric,          -- cm
  weight numeric,          -- kg
  goal text,
  activity_level text,
  dietary_preferences text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  allergies text[] not null default '{}',
  medical_notes text,
  subscription_status text not null default 'active',
  demo_scenario text,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.profiles(id) on delete cascade,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  water numeric not null default 2.5,   -- litres
  meals_per_day int not null default 4,
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_name text not null,
  calories numeric not null check (calories >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0),
  ingredients text[] not null default '{}',
  tags text[] not null default '{}',
  source text not null default 'coach',  -- coach | agent
  updated_at timestamptz not null default now(),
  unique (plan_id, date, meal_type)
);
create index if not exists planned_meals_member_date on public.planned_meals (member_id, date);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_name text not null,
  calories numeric not null check (calories >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0),
  notes text,
  matched_plan boolean not null default false,
  estimated boolean not null default false,  -- true when macros were estimated, not from the catalog
  created_at timestamptz not null default now()
);
create index if not exists meal_logs_member_date on public.meal_logs (member_id, date);

-- -----------------------------------------------------------------------------
-- Agent actions: every agent decision is recorded here. This table is the
-- source of truth for "time saved" and the coach review queue.
-- execution_status:
--   proposed      -> waiting for the member to confirm
--   pending_coach -> waiting for coach approval
--   executed      -> change applied (or informational action completed)
--   rejected      -> declined by member/coach
-- -----------------------------------------------------------------------------
create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  initiated_by uuid references public.profiles(id) on delete set null,
  action_type text not null,
  user_request text,
  summary text,
  tools_used jsonb not null default '[]',
  proposed_change jsonb,
  requires_coach_approval boolean not null default false,
  approved boolean,
  execution_status text not null default 'executed'
    check (execution_status in ('proposed', 'pending_coach', 'executed', 'rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  estimated_manual_minutes numeric not null default 0,
  estimated_agent_minutes numeric not null default 0,
  estimated_minutes_saved numeric not null default 0,
  estimated_cost_value numeric not null default 0,   -- EGP labor value of minutes saved
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_member on public.agent_actions (member_id, created_at desc);

create table if not exists public.coach_followups (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  agent_action_id uuid references public.agent_actions(id) on delete set null,
  reason text,
  message text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- -----------------------------------------------------------------------------
-- AI cost tracking. Pricing is configurable (no hard-coded prices in code).
-- -----------------------------------------------------------------------------
create table if not exists public.ai_model_pricing (
  model text primary key,
  input_usd_per_million numeric not null default 0,
  output_usd_per_million numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  request_count int not null default 1,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Helper functions for RLS (security definer avoids recursive policy checks)
-- =============================================================================
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_gym_id() returns uuid
language sql stable security definer set search_path = public as $$
  select gym_id from public.profiles where id = auth.uid()
$$;

-- True when the signed-in user may see/act on the given member's data:
-- the member themself, their assigned coach, or an admin of the same gym.
create or replace function public.can_access_member(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles m on m.id = target
    where me.id = auth.uid()
      and (
        me.id = m.id
        or (me.role = 'coach' and m.coach_id = me.id)
        or (me.role = 'admin' and me.gym_id = m.gym_id)
      )
  )
$$;

-- =============================================================================
-- Row-level security
-- =============================================================================
alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.planned_meals enable row level security;
alter table public.meal_logs enable row level security;
alter table public.agent_actions enable row level security;
alter table public.coach_followups enable row level security;
alter table public.ai_model_pricing enable row level security;
alter table public.ai_usage enable row level security;

-- gyms ----------------------------------------------------------------------
drop policy if exists gyms_select on public.gyms;
create policy gyms_select on public.gyms for select to authenticated
  using (id = public.current_gym_id());
drop policy if exists gyms_update on public.gyms;
create policy gyms_update on public.gyms for update to authenticated
  using (id = public.current_gym_id() and public.current_role_name() = 'admin')
  with check (id = public.current_gym_id() and public.current_role_name() = 'admin');

-- profiles ------------------------------------------------------------------
-- Users see themselves, the members they may access, and staff in their gym.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    public.can_access_member(id)
    or (role in ('coach', 'admin') and gym_id = public.current_gym_id())
  );
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.can_access_member(id))
  with check (public.can_access_member(id));

-- Only preference-style columns are writable from the app. Role, gym and
-- coach assignment can only be changed with the service role.
revoke update on public.profiles from authenticated;
grant update (dietary_preferences, disliked_foods, allergies, weight, goal, activity_level)
  on public.profiles to authenticated;

-- member-owned tables: same rule everywhere ---------------------------------
do $$
declare t text;
begin
  foreach t in array array['nutrition_targets', 'nutrition_plans', 'planned_meals',
                           'meal_logs', 'agent_actions', 'coach_followups']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.can_access_member(member_id))
         with check (public.can_access_member(member_id))',
      t || '_all', t);
  end loop;
end $$;

-- pricing: readable by everyone signed in, editable by admins ---------------
drop policy if exists pricing_select on public.ai_model_pricing;
create policy pricing_select on public.ai_model_pricing for select to authenticated using (true);
drop policy if exists pricing_write on public.ai_model_pricing;
create policy pricing_write on public.ai_model_pricing for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- ai usage ------------------------------------------------------------------
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (
    (member_id is not null and public.can_access_member(member_id))
    or (public.current_role_name() = 'admin' and gym_id = public.current_gym_id())
  );
drop policy if exists ai_usage_insert on public.ai_usage;
create policy ai_usage_insert on public.ai_usage for insert to authenticated
  with check (actor_id = auth.uid());

-- =============================================================================
-- Guard: members cannot approve/reject actions that need a coach decision,
-- even if they call the database directly.
-- =============================================================================
create or replace function public.guard_coach_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.requires_coach_approval
     and new.execution_status is distinct from old.execution_status
     and public.current_role_name() = 'member' then
    raise exception 'This change requires coach approval';
  end if;
  return new;
end $$;

drop trigger if exists agent_actions_guard on public.agent_actions;
create trigger agent_actions_guard before update on public.agent_actions
  for each row execute function public.guard_coach_approval();
