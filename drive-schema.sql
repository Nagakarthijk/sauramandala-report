-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVE — Doorstep Incubation for Thriving Enterprises
-- Supabase database schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ────────────────────────────────────────────────────────────────────

-- One row per subscribing organisation
create table if not exists organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  config     jsonb default '{}',
  created_at timestamptz default now()
);

-- One row per user. Extends Supabase's built-in auth.users table.
-- role: 'agent' | 'provider' | 'programme_officer' | 'admin'
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  org_id     uuid references organisations,
  role       text not null default 'agent' check (role in ('agent','provider','programme_officer','admin')),
  name       text,
  phone      text,
  created_at timestamptz default now()
);

-- Each entrepreneur/micro-enterprise the programme supports
create table if not exists entrepreneurs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid references organisations not null,
  name           text not null,
  phone          text,
  business       text,
  sector         text,
  entity_type    text,
  location       text,
  kyc_done       boolean default false,
  consent_status text default 'verbal',
  status         text default 'active',
  created_by     uuid references profiles,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- One row per entrepreneur × need (e.g. kavitha + fssai)
-- stage: observed | explored | decided | in_progress | resolved | deferred
create table if not exists need_journeys (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations not null,
  entrepreneur_id uuid references entrepreneurs not null,
  need            text not null,
  stage           text not null default 'observed',
  aspiration      text,
  confidence      text,
  payment         text,
  deferred_reason text,
  referral_id     uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (entrepreneur_id, need)
);

-- Timestamped observation notes attached to a specific need
create table if not exists need_observations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations not null,
  entrepreneur_id uuid references entrepreneurs not null,
  need            text not null,
  text            text not null,
  created_by      uuid references profiles,
  created_at      timestamptz default now()
);

-- Service providers (FSSAI consultants, solar vendors, banks, etc.)
create table if not exists providers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organisations not null,
  name       text not null,
  service    text not null,
  phone      text,
  email      text,
  location   text,
  active     boolean default true,
  created_at timestamptz default now()
);

-- Referral from an entrepreneur to a provider for a specific service
create table if not exists referrals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations not null,
  entrepreneur_id uuid references entrepreneurs not null,
  provider_id     uuid references providers,
  service         text not null,
  status          text not null default 'PENDING',
  commission      numeric(10,2),
  deadline        date,
  notes           text,
  intake_notes    text,
  escalated       boolean default false,
  created_by      uuid references profiles,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Link need_journeys → referrals (added after both tables exist)
alter table need_journeys
  add column if not exists referral_id_fk uuid references referrals;

-- Field visit / call / WhatsApp notes on an entrepreneur
create table if not exists conversation_notes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations not null,
  entrepreneur_id uuid references entrepreneurs not null,
  body            text not null,
  type            text default 'visit',
  created_by      uuid references profiles,
  created_at      timestamptz default now()
);

-- Agent commission earnings per referral
create table if not exists earnings (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organisations not null,
  referral_id  uuid references referrals not null,
  agent_id     uuid references profiles,
  amount       numeric(10,2) not null default 0,
  status       text default 'PENDING',
  confirmed_at timestamptz,
  created_at   timestamptz default now()
);


-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Each user can only see data from their own organisation.

alter table organisations      enable row level security;
alter table profiles           enable row level security;
alter table entrepreneurs      enable row level security;
alter table need_journeys      enable row level security;
alter table need_observations  enable row level security;
alter table providers          enable row level security;
alter table referrals          enable row level security;
alter table conversation_notes enable row level security;
alter table earnings           enable row level security;

-- Helper: get the org_id of the currently logged-in user
create or replace function current_org_id()
returns uuid language sql security definer stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- profiles
create policy "Read own org profiles"   on profiles for select using (org_id = current_org_id() or id = auth.uid());
create policy "Update own profile"      on profiles for update using (id = auth.uid());

-- entrepreneurs
create policy "Org read entrepreneurs"  on entrepreneurs for select using (org_id = current_org_id());
create policy "Org add entrepreneurs"   on entrepreneurs for insert with check (org_id = current_org_id());
create policy "Org update entrepreneurs"on entrepreneurs for update using (org_id = current_org_id());

-- need_journeys
create policy "Org read need_journeys"  on need_journeys for select using (org_id = current_org_id());
create policy "Org write need_journeys" on need_journeys for insert with check (org_id = current_org_id());
create policy "Org update need_journeys"on need_journeys for update using (org_id = current_org_id());

-- need_observations
create policy "Org read need_obs"  on need_observations for select using (org_id = current_org_id());
create policy "Org write need_obs" on need_observations for insert with check (org_id = current_org_id());

-- providers
create policy "Org read providers"  on providers for select using (org_id = current_org_id());
create policy "Org write providers" on providers for insert with check (org_id = current_org_id());
create policy "Org update providers"on providers for update using (org_id = current_org_id());

-- referrals
create policy "Org read referrals"  on referrals for select using (org_id = current_org_id());
create policy "Org write referrals" on referrals for insert with check (org_id = current_org_id());
create policy "Org update referrals"on referrals for update using (org_id = current_org_id());

-- conversation_notes
create policy "Org read notes"  on conversation_notes for select using (org_id = current_org_id());
create policy "Org write notes" on conversation_notes for insert with check (org_id = current_org_id());

-- earnings
create policy "Org read earnings"  on earnings for select using (org_id = current_org_id());
create policy "Org write earnings" on earnings for insert with check (org_id = current_org_id());
create policy "Org update earnings"on earnings for update using (org_id = current_org_id());


-- ── Triggers ──────────────────────────────────────────────────────────────────

-- Auto-update updated_at on writes
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger entrepreneurs_updated_at
  before update on entrepreneurs for each row execute function set_updated_at();
create trigger need_journeys_updated_at
  before update on need_journeys for each row execute function set_updated_at();
create trigger referrals_updated_at
  before update on referrals for each row execute function set_updated_at();

-- Auto-create a profile row when a new user signs up
-- (org_id and role come from the metadata set during invitation)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, org_id, role, name)
  values (
    new.id,
    (new.raw_user_meta_data->>'org_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
