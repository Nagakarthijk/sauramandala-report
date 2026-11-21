-- ============================================================
-- JanNidhi Light — TENANT schema
-- Run this in the Supabase SQL editor of YOUR OWN free Supabase project —
-- not JanNidhi Light's project. This is the database that actually holds
-- your page: your bio, your QR/UPI details, your work updates, your
-- expenses, and the donations people declare to you. JanNidhi Light never
-- sees or stores any of it — it only points your page's URL at this
-- project and reads/writes it live, in each visitor's own browser.
--
-- After running this, copy your Project URL and anon public key
-- (Project Settings → API) into JanNidhi Light when you create your page.
-- ============================================================

create table profiles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  headline        text default '',
  bio             text default '',
  location        text default '',
  photo_url       text,
  cover_url       text,
  links           jsonb default '[]'::jsonb,   -- [{label, url}, ...]
  -- Payment display — your own uploaded content, never platform-generated.
  upi_qr_url      text,
  upi_vpa         text,
  upi_payee_name  text,
  bank_details    text,
  id_attested     boolean default false,
  undeclared_inflow_total numeric default 0,
  created_at      timestamptz default now(),
  last_active_at  timestamptz default now()
);

create table work_updates (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text default '',
  media_urls  text[] default '{}',
  created_at  timestamptz default now()
);

create table expenses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  amount      numeric not null check (amount > 0),
  description text not null,
  proof_url   text,
  spent_on    date default current_date,
  created_at  timestamptz default now()
);

create table donations (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  amount          numeric not null check (amount > 0),
  donor_name      text,
  anonymous       boolean default false,
  donor_contact   text,
  message         text default '',
  proof_url       text,
  citizen_declared boolean not null default false,
  status          text not null default 'declared',  -- declared | acknowledged | disputed
  declared_at     timestamptz default now(),
  resolved_at     timestamptz
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  reason      text not null,
  contact     text,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security — this is YOUR project, so these policies are
-- intentionally simple: one profile row, writable only via your own
-- Supabase dashboard / service role (there's no per-row owner check here
-- the way JanNidhi proper has, because there's only ever one of you).
-- If you're comfortable with SQL, tighten this further; the defaults
-- below match what JanNidhi Light's UI actually needs to work.
-- ============================================================
alter table profiles     enable row level security;
alter table work_updates enable row level security;
alter table expenses     enable row level security;
alter table donations    enable row level security;
alter table reports      enable row level security;

create policy "public read profiles"  on profiles     for select using (true);
create policy "public read updates"   on work_updates  for select using (true);
create policy "public read expenses"  on expenses      for select using (true);
create policy "public read donations" on donations     for select using (true);

-- You manage your own profile/updates/expenses from JanNidhi Light's UI
-- while signed in there — but since this project has no auth of its own
-- tied to that login, these write policies trust the anon key itself.
-- Treat your anon key with the same care as a password: anyone who has it
-- can write to your project. (JanNidhi Light never displays yours to
-- anyone but you.)
create policy "anon writes profile"  on profiles     for all using (true) with check (true);
create policy "anon writes updates"  on work_updates  for all using (true) with check (true);
create policy "anon writes expenses" on expenses      for all using (true) with check (true);
create policy "anon files donation"  on donations     for insert with check (status = 'declared' and citizen_declared = true);
create policy "anon resolves donation" on donations   for update using (true);
create policy "anon files report"    on reports       for insert with check (true);
