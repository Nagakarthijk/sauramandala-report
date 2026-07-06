-- ============================================================
-- JanNidhi — grassroots political worker fundraising directory
-- Supabase schema v1
--
-- Run this in the Supabase SQL editor of a fresh project.
-- The platform NEVER touches money: it stores worker-uploaded
-- UPI QR images, self-declared ledgers, and donor declarations.
-- ============================================================

-- ── Profiles (grassroots workers) ───────────────────────────
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) unique,
  slug          text not null unique,
  name          text not null,
  bio           text default '',
  location      text default '',
  photo_url     text,
  cover_url     text,
  links         jsonb default '[]'::jsonb,   -- [{label, url}, ...] — social/custom links, like a link-in-bio
  -- Payment display (worker-uploaded content, never platform-generated)
  upi_qr_url    text,           -- worker's own QR image
  upi_vpa       text,           -- displayed as text only, never linked
  upi_payee_name text,          -- name registered on the VPA (anti-impersonation)
  bank_details  text,           -- free text: acct no / IFSC / name
  -- Self-attestation (platform never judges authenticity)
  id_attested   boolean default false,  -- "an ID document is on file"
  id_doc_path   text,                   -- path in PRIVATE bucket, owner-only
  -- Self-declared aggregate of inflows the donor chose not to declare
  undeclared_inflow_total numeric default 0,
  discoverable  boolean default true,
  created_at    timestamptz default now(),
  last_active_at timestamptz default now()
);

-- ── Organisations (parties, resident groups, any collective) ─
create table orgs (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  slug          text not null unique,
  name          text not null,
  org_type      text default 'group',   -- party | residents | union | group
  description   text default '',
  logo_url      text,
  created_at    timestamptz default now()
);

-- ── Org membership / vouching ────────────────────────────────
-- A worker requests to join; the org admin vouches (or revokes).
-- "Vouched by [Org]" is the org's statement, not the platform's.
create table org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  status      text not null default 'pending',  -- pending | vouched | revoked
  role_label  text default 'Worker',            -- e.g. "Booth-level worker"
  created_at  timestamptz default now(),
  unique (org_id, profile_id)
);

-- ── Work updates (the portfolio) ─────────────────────────────
create table work_updates (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text default '',
  media_urls  text[] default '{}',
  created_at  timestamptz default now()
);

-- ── Expenses (self-declared, with optional bill/proof photo) ─
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  amount      numeric not null check (amount > 0),
  description text not null,
  proof_url   text,             -- bill / receipt photo
  spent_on    date default current_date,
  created_at  timestamptz default now()
);

-- ── Donation declarations ────────────────────────────────────
-- Filed by the DONOR (may be anonymous to the public). The worker
-- must acknowledge or dispute — that two-party handshake is the
-- strongest signal in the transparency score.
create table donations (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  amount        numeric not null check (amount > 0),
  donor_name    text,            -- null / hidden when anonymous
  anonymous     boolean default false,
  donor_contact text,            -- optional, visible to worker only via ack flow
  message       text default '',
  proof_url     text,            -- screenshot of UPI/bank transfer
  citizen_declared boolean not null default false, -- FCRA guardrail checkbox
  status        text not null default 'declared',  -- declared | acknowledged | disputed
  declared_at   timestamptz default now(),
  resolved_at   timestamptz
);

-- ── Reports (impersonation / abuse flags) ────────────────────
create table reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  org_id      uuid references orgs(id) on delete cascade,
  reason      text not null,
  contact     text,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles     enable row level security;
alter table orgs         enable row level security;
alter table org_members  enable row level security;
alter table work_updates enable row level security;
alter table expenses     enable row level security;
alter table donations    enable row level security;
alter table reports      enable row level security;

-- Public read (this is a transparency platform)
create policy "public read profiles"     on profiles     for select using (true);
create policy "public read orgs"         on orgs         for select using (true);
create policy "public read org_members"  on org_members  for select using (true);
create policy "public read updates"      on work_updates for select using (true);
create policy "public read expenses"     on expenses     for select using (true);
create policy "public read donations"    on donations    for select using (true);

-- Profiles: owner writes
create policy "owner insert profile" on profiles for insert
  with check (auth.uid() = user_id);
create policy "owner update profile" on profiles for update
  using (auth.uid() = user_id);
create policy "owner delete profile" on profiles for delete
  using (auth.uid() = user_id);

-- Orgs: admin writes
create policy "admin insert org" on orgs for insert
  with check (auth.uid() = admin_user_id);
create policy "admin update org" on orgs for update
  using (auth.uid() = admin_user_id);
create policy "admin delete org" on orgs for delete
  using (auth.uid() = admin_user_id);

-- Org members: the worker asks to join; only the org admin
-- can change status (vouch / revoke); either side can remove.
create policy "worker requests membership" on org_members for insert
  with check (
    status = 'pending' and
    exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid())
  );
create policy "org admin updates membership" on org_members for update
  using (exists (select 1 from orgs o where o.id = org_id and o.admin_user_id = auth.uid()));
create policy "either side removes membership" on org_members for delete
  using (
    exists (select 1 from orgs o where o.id = org_id and o.admin_user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- Updates & expenses: profile owner writes
create policy "owner writes updates" on work_updates for insert
  with check (exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "owner deletes updates" on work_updates for delete
  using (exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "owner writes expenses" on expenses for insert
  with check (exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "owner deletes expenses" on expenses for delete
  using (exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- Donations: ANYONE (even signed-out donors) may file a declaration,
-- but only in 'declared' state and only with the citizenship box ticked.
-- Only the receiving worker may resolve it (acknowledge / dispute).
create policy "anyone declares donation" on donations for insert
  with check (status = 'declared' and citizen_declared = true);
create policy "worker resolves donation" on donations for update
  using (exists (select 1 from profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- Reports: anyone can file; nobody reads via the API (admin reads in dashboard)
create policy "anyone files report" on reports for insert with check (true);

-- ============================================================
-- Storage buckets
--   jn-public  : QR images, photos, work media, bills, transfer proofs
--   jn-private : ID documents (owner-only)
-- ============================================================
insert into storage.buckets (id, name, public) values ('jn-public', 'jn-public', true);
insert into storage.buckets (id, name, public) values ('jn-private', 'jn-private', false);

create policy "public read jn-public" on storage.objects for select
  using (bucket_id = 'jn-public');
create policy "anyone uploads jn-public" on storage.objects for insert
  with check (bucket_id = 'jn-public');  -- donors upload transfer proofs while signed out

create policy "owner reads own id docs" on storage.objects for select
  using (bucket_id = 'jn-private' and owner = auth.uid());
create policy "authed uploads jn-private" on storage.objects for insert
  with check (bucket_id = 'jn-private' and auth.role() = 'authenticated');
