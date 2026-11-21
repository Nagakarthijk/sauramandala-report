// supabase-connect — the ONE small server-side piece in all of JanNidhi
// Light. Everything else is a static site talking straight to Supabase or
// a Google Sheet. This exists only because exchanging an OAuth code for an
// access token needs a client secret, which can never be exposed in a
// browser — so that one step, and the few Management API calls right after
// it, have to happen somewhere server-side. It never touches anyone's
// profile, ledger, or donations — it only ever talks to Supabase's own
// account/project-management API, on the new user's behalf, for the one
// minute it takes to spin up their project. Nothing it handles is stored
// anywhere after it returns; there is no database behind this function.
//
// Deploy: supabase functions deploy supabase-connect --project-ref <your-central-project-ref>
// Secrets (supabase secrets set --project-ref <ref> NAME=value):
//   SUPABASE_OAUTH_CLIENT_ID      — from your registered OAuth App
//   SUPABASE_OAUTH_CLIENT_SECRET  — from your registered OAuth App
//   SUPABASE_OAUTH_REDIRECT_URI   — must exactly match what you registered,
//                                   e.g. https://your-site.netlify.app/create.html
//
// NOTE ON TESTING: this is written against Supabase's documented OAuth Apps
// and Management API (api.supabase.com/v1/...), but it has not been run
// against a live registered OAuth app from this session — there was no way
// to do that here. Treat the exact Management API request/response shapes
// below as a solid best-effort starting point, not a guarantee; watch the
// function's logs the first few times someone actually connects, and adjust
// field names if Supabase's API responds differently than expected.

const MANAGEMENT_API = 'https://api.supabase.com/v1';

// Kept in sync with ../../../schema-tenant.sql by hand — if you change one,
// change the other. Run as a single Management API query, so this needs to
// be valid as one multi-statement string.
const TENANT_SCHEMA_SQL = `
create table profiles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  headline        text default '',
  bio             text default '',
  location        text default '',
  photo_url       text,
  cover_url       text,
  links           jsonb default '[]'::jsonb,
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
  status          text not null default 'declared',
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
alter table profiles     enable row level security;
alter table work_updates enable row level security;
alter table expenses     enable row level security;
alter table donations    enable row level security;
alter table reports      enable row level security;
create policy "public read profiles"  on profiles     for select using (true);
create policy "public read updates"   on work_updates  for select using (true);
create policy "public read expenses"  on expenses      for select using (true);
create policy "public read donations" on donations     for select using (true);
create policy "anon writes profile"  on profiles     for all using (true) with check (true);
create policy "anon writes updates"  on work_updates  for all using (true) with check (true);
create policy "anon writes expenses" on expenses      for all using (true) with check (true);
create policy "anon files donation"  on donations     for insert with check (status = 'declared' and citizen_declared = true);
create policy "anon resolves donation" on donations   for update using (true);
create policy "anon files report"    on reports       for insert with check (true);
`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const { code, projectName } = await req.json();
    if (!code) return json({ error: 'Missing OAuth code' }, 400);

    const clientId = Deno.env.get('SUPABASE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('SUPABASE_OAUTH_CLIENT_SECRET');
    const redirectUri = Deno.env.get('SUPABASE_OAUTH_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      return json({ error: 'This function is missing its SUPABASE_OAUTH_* secrets — see the comment at the top of index.ts.' }, 500);
    }

    // 1. Exchange the one-time code for an access token. Basic auth with
    // client_id:client_secret is how Supabase's token endpoint expects
    // this, per their OAuth Apps docs.
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(`${MANAGEMENT_API}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
    });
    if (!tokenRes.ok) return json({ error: 'Could not complete Supabase sign-in: ' + (await tokenRes.text()) }, 502);
    const { access_token } = await tokenRes.json();
    const auth = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

    // 2. Pick an organization to create the project in — the account's
    // first one. (A person with several orgs can't choose here in v1;
    // worth adding an org-picker step later if that turns out to matter.)
    const orgsRes = await fetch(`${MANAGEMENT_API}/organizations`, { headers: auth });
    if (!orgsRes.ok) return json({ error: "Couldn't list your Supabase organizations: " + (await orgsRes.text()) }, 502);
    const orgs = await orgsRes.json();
    if (!Array.isArray(orgs) || !orgs.length) return json({ error: 'Your Supabase account has no organization to create a project in.' }, 400);
    const organizationId = orgs[0].id;

    // 3. Create the project. db_pass is generated here and then thrown
    // away — nothing after this function ever needs it, since all reads
    // and writes go through the anon key and RLS, never a direct DB
    // connection.
    const dbPass = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const createRes = await fetch(`${MANAGEMENT_API}/projects`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ organization_id: organizationId, name: projectName || 'jannidhi-light-page', db_pass: dbPass, region: 'ap-south-1', plan: 'free' })
    });
    if (!createRes.ok) return json({ error: "Couldn't create a Supabase project — your account may already be at its free-project limit: " + (await createRes.text()) }, 502);
    const project = await createRes.json();
    const ref = project.id || project.ref;

    // 4. Provisioning a fresh project takes roughly a minute — poll until
    // it's ready, or give up after ~3 minutes so this doesn't hang forever.
    let status = project.status;
    for (let i = 0; i < 60 && status !== 'ACTIVE_HEALTHY'; i++) {
      await sleep(3000);
      const s = await fetch(`${MANAGEMENT_API}/projects/${ref}`, { headers: auth });
      if (s.ok) status = (await s.json()).status;
    }
    if (status !== 'ACTIVE_HEALTHY') return json({ error: 'Your project is taking longer than expected to come online — try reconnecting in a minute.' }, 504);

    // 5. Run the tenant schema.
    const schemaRes = await fetch(`${MANAGEMENT_API}/projects/${ref}/database/query`, {
      method: 'POST', headers: auth, body: JSON.stringify({ query: TENANT_SCHEMA_SQL })
    });
    if (!schemaRes.ok) return json({ error: "Project was created but setting up its tables failed — you may need to run schema-tenant.sql yourself: " + (await schemaRes.text()) }, 502);

    // 6. Fetch the anon key to hand back — the only credential this page
    // (or anyone else) ever needs for this project going forward.
    const keysRes = await fetch(`${MANAGEMENT_API}/projects/${ref}/api-keys`, { headers: auth });
    if (!keysRes.ok) return json({ error: "Project was created but couldn't read back its API key: " + (await keysRes.text()) }, 502);
    const keys = await keysRes.json();
    const anonKey = Array.isArray(keys) ? keys.find((k: { name?: string }) => k.name === 'anon')?.api_key : undefined;
    if (!anonKey) return json({ error: 'Could not find the anon key on your new project.' }, 502);

    return json({ backend_url: `https://${ref}.supabase.co`, backend_anon_key: anonKey });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
