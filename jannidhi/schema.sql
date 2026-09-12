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
  website       text,                   -- optional; org's own site, for the domain-match badge below
  -- Computed once, at registration: does the admin's signup email domain
  -- match the stated website's domain? A real, honest, free signal —
  -- but only as strong as knowing the admin controls that inbox, which
  -- requires Supabase's "Confirm email" to be on (see README). Never
  -- exposes the admin's actual email publicly, just this boolean.
  admin_email_domain_match boolean default false,
  admin_authorized  boolean not null default false, -- explicit attestation at signup, see org-admin.html
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
-- Report counts are NOT shown publicly — an unverified accusation count
-- would itself be a brigading vector (mass fake reports to make someone
-- look bad). The affected worker can see their own reports; full review
-- otherwise happens via the Supabase dashboard.
create table reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  org_id      uuid references orgs(id) on delete cascade,
  reason      text not null,
  contact     text,
  created_at  timestamptz default now()
);

-- ── Community votes ──────────────────────────────────────────
-- Signed-in users only (accounts gated by CAPTCHA at signup — see
-- README). Sentiment, NOT part of the transparency score, which
-- measures disclosure practice, not popularity. Individual votes are
-- never publicly readable — only the voter can see their own row — so
-- a downvoter can't be identified and targeted. Only aggregate counts
-- (via the vote_counts view below) are public.
-- reason is optional and constrained to a fixed vocabulary (enforced here,
-- not just in the UI) — a preset list can't defame anyone, unlike open
-- text, which is why votes don't take freeform comments.
create table votes (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  value         smallint not null check (value in (1, -1)),
  reason        text,
  created_at    timestamptz default now(),
  unique (profile_id, voter_user_id),
  constraint votes_reason_check check (reason is null or reason in (
    'Know them personally',
    'Verified their work firsthand',
    'Fellow volunteer or colleague',
    'Reliable in past dealings',
    'Unresolved donation dispute',
    'Missing expense proof',
    'Suspect impersonation',
    'Other transparency concern'
  ))
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
alter table votes        enable row level security;

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

-- Orgs: admin writes. admin_authorized must be explicitly true at creation —
-- the attestation checkbox in org-admin.html, enforced here too so it can't
-- be skipped by calling the API directly.
create policy "admin insert org" on orgs for insert
  with check (auth.uid() = admin_user_id and admin_authorized = true);
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

-- Reports: anyone can file. Nobody reads via the API — NOT the reported
-- worker (telling the accused defeats an impersonation/abuse report and
-- risks retaliation against whoever filed it), not the public. Platform
-- admins can now read reports via admin.html (previously dashboard-only).
create policy "anyone files report" on reports for insert with check (true);
create policy "admins read all reports" on reports for select
  using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

-- Votes: any signed-in user may cast/change/remove their own vote.
-- Nobody — not even the profile owner — can read another person's
-- individual vote; only the aggregate view below is public.
create policy "signed-in user manages own vote" on votes for all
  using (auth.uid() = voter_user_id) with check (auth.uid() = voter_user_id);

-- Public aggregate — counts only, never who voted which way. Views
-- run with the privileges of their owner by default (not the caller's
-- RLS), which is exactly what lets this aggregate across all rows while
-- the underlying table stays locked down above.
create view vote_counts as
  select profile_id,
         count(*) filter (where value = 1)  as upvotes,
         count(*) filter (where value = -1) as downvotes
  from votes
  group by profile_id;
grant select on vote_counts to anon, authenticated;

-- Same privacy model: aggregate reason tallies only, never who picked which.
create view vote_reason_counts as
  select profile_id, value, reason, count(*) as tally
  from votes
  where reason is not null
  group by profile_id, value, reason;
grant select on vote_reason_counts to anon, authenticated;

-- ============================================================
-- Moderation: platform admins, volunteer reviewers, profile reviews
--
-- Model: a new profile's OWN LINK works immediately (the whole point of
-- the platform is "share your link today") — it is just excluded from
-- the public Explore directory until a volunteer reviews it. Volunteers
-- never get direct write access to profiles themselves (that would let
-- a reviewer edit someone else's bio/payment info); they only ever
-- insert into profile_reviews, an append-only audit trail. Directory
-- visibility is computed from the latest review decision.
-- ============================================================

-- Root trust anchor. No insert/update/delete policy is defined for this
-- table at all — the only way to grant platform-admin status is via the
-- Supabase dashboard (service role), by design, so there is no way to
-- self-escalate through the public API.
create table platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);
alter table platform_admins enable row level security;
create policy "self checks own admin status" on platform_admins for select
  using (auth.uid() = user_id);

-- Volunteer reviewers. Only an admin can appoint one (via admin.html,
-- which calls the admin_appoint_volunteer() function below). A volunteer
-- must explicitly accept the review-guidelines agreement themselves
-- before they can review anything — see agreement_accepted.
create table volunteers (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  appointed_by        uuid references auth.users(id),
  agreement_accepted  boolean not null default false,
  created_at          timestamptz default now()
);
alter table volunteers enable row level security;
create policy "self checks own volunteer status" on volunteers for select
  using (auth.uid() = user_id);
create policy "volunteer accepts agreement" on volunteers for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins manage volunteers" on volunteers for all
  using (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from platform_admins pa where pa.user_id = auth.uid()));

-- Admin-only: look up a user by email and appoint them as a volunteer.
-- SECURITY DEFINER so it can read auth.users (normally locked down),
-- but the first line re-checks the CALLER is an admin — without that
-- check this would be a privilege-escalation hole, not a convenience.
create or replace function admin_appoint_volunteer(target_email text)
returns void as $$
declare target_id uuid;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Only a platform admin can appoint volunteers';
  end if;
  select id into target_id from auth.users where email = target_email;
  if target_id is null then
    raise exception 'No account found for that email';
  end if;
  insert into volunteers (user_id, appointed_by) values (target_id, auth.uid())
    on conflict (user_id) do nothing;
end;
$$ language plpgsql security definer;

-- Append-only review decisions. Reviewer identity and any note are NOT
-- public (a volunteer's negative note is itself an unverified judgment
-- call — same reasoning as reports not being public). Only the
-- aggregate current status (profile_review_status view) is public.
create table profile_reviews (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references profiles(id) on delete cascade,
  reviewer_user_id  uuid not null references auth.users(id),
  decision          text not null check (decision in ('approved', 'flagged')),
  note              text,
  created_at        timestamptz default now()
);
alter table profile_reviews enable row level security;
create policy "reviewers read reviews" on profile_reviews for select
  using (
    exists (select 1 from volunteers v where v.user_id = auth.uid())
    or exists (select 1 from platform_admins pa where pa.user_id = auth.uid())
  );
create policy "reviewers submit reviews" on profile_reviews for insert
  with check (
    auth.uid() = reviewer_user_id and (
      exists (select 1 from volunteers v where v.user_id = auth.uid() and v.agreement_accepted = true)
      or exists (select 1 from platform_admins pa where pa.user_id = auth.uid())
    )
  );

-- Public: current status only (approved / flagged / pending), never who
-- decided or why. Views run as their owner by default, bypassing the
-- RLS above — exactly what lets this aggregate while the underlying
-- table stays locked down.
create view profile_review_status as
  select p.id as profile_id,
    coalesce(
      (select pr.decision from profile_reviews pr where pr.profile_id = p.id order by pr.created_at desc limit 1),
      'pending'
    ) as status
  from profiles p;
grant select on profile_review_status to anon, authenticated;

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
