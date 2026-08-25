# DRIVE App — Tech Setup Guide

This is everything your tech person needs to install the DRIVE field-agent
system on top of the existing SMF ERPNext server.

**Time required:** ~30 minutes  
**Requires:** SSH access to the AWS server running ERPNext

---

## What this installs

A custom ERPNext app called `drive` that adds four new DocTypes:

| DocType | What it stores |
|---|---|
| Entrepreneur | Micro-entrepreneur profiles |
| Need Journey | Each entrepreneur's progress per service need |
| Referral | Service referrals and their status |
| Provider | Empanelled service providers |

It also adds REST API endpoints at `/api/method/drive.drive.drive.api.*`
that the DRIVE field-agent PWA calls.

Three roles are created: **DRIVE Agent**, **DRIVE Programme Officer**, **DRIVE Provider**.

---

## Step 1 — SSH into the server

```bash
ssh ubuntu@<aws-server-ip>
```

Switch to the frappe user (or whichever user owns the bench):

```bash
sudo su - frappe
# or: sudo su - ubuntu   (if bench is owned by ubuntu)
```

---

## Step 2 — Find your bench directory

```bash
ls ~/frappe-bench/    # typical location
# or
ls ~/bench/
```

The bench directory is the one that contains `apps/`, `sites/`, `env/`.  
Note the full path — you'll need it.

---

## Step 3 — Find your site name

```bash
ls ~/frappe-bench/sites/
```

It will look like `erp.sauramandala.org` or `smf.localhost`.  
Note it — used in every `bench --site` command below.

---

## Step 4 — Copy the DRIVE app files

Clone or copy the `frappe-app/drive` folder from this repository
onto the server, then run the installer from **inside the bench directory**:

**Option A — if you can git clone on the server:**

```bash
cd ~/frappe-bench
git clone https://github.com/nagakarthijk/sauramandala-report.git /tmp/drive-repo
bash /tmp/drive-repo/frappe-app/install.sh <your-site-name>
```

**Option B — SCP from your laptop:**

```bash
# on your laptop:
scp -r frappe-app/drive ubuntu@<server-ip>:/tmp/drive-app

# on the server:
cd ~/frappe-bench
cp -r /tmp/drive-app apps/drive
~/frappe-bench/env/bin/pip install -e ~/frappe-bench/apps/drive --quiet
bench --site <your-site-name> install-app drive
bench --site <your-site-name> migrate
bench restart
```

---

## Step 5 — Enable AI voice extraction (optional but recommended)

The field agent SmartNote button uses Claude AI to turn spoken notes
into structured form fields. To enable it:

1. Get an Anthropic API key from https://console.anthropic.com
2. Run:

```bash
bench --site <your-site-name> set-config anthropic_api_key sk-ant-api03-XXXX...
bench restart
```

Cost: ~$0.001 per voice note (Claude Haiku). Very cheap.

---

## Step 6 — Create field agent user accounts

In the ERPNext browser UI (log in as Administrator):

1. **Create a User** for each field agent:
   - Setup → Users → New
   - Fill: Full Name, Email, Mobile No
   - Roles tab → Add: **DRIVE Agent**
   - Default Settings tab → Default Company: select the SMF company

2. **Generate API credentials** for each user:
   - Open the user record
   - API Access section → click **Generate API Key**
   - Copy the **API Key** and **API Secret** — you'll need to share these

3. **Repeat** for programme officers (role: **DRIVE Programme Officer**)
   and service providers (role: **DRIVE Provider**)

---

## Step 7 — Configure the PWA to use ERPNext

The field-agent PWA currently connects to Supabase (the online database).
To switch it to call ERPNext directly, update `drive-config.js`
in the sauramandala-report repo:

```js
// drive-config.js  — change this section:
const DRIVE_CONFIG = {
  mode: "erp",                                    // was: "supabase"
  erp_base_url: "https://erp.sauramandala.org",  // your ERPNext URL
};
```

Each field agent then logs in with their ERPNext API Key + Secret
instead of a Supabase email/password.

> **Note:** This config change is a separate step — the PWA works fine
> with Supabase while you test ERPNext. Both can run in parallel.

---

## Step 8 — Share login credentials with field agents

For each field agent, share (via WhatsApp or email):

```
DRIVE App Login
Site: https://drive.sauramandala.org  (or wherever the PWA is hosted)
API Key: <copy from ERPNext user record>
API Secret: <copy from ERPNext user record>
```

They enter these in the PWA login screen under "ERPNext login".

---

## Verification checklist

After install, verify by logging into ERPNext as Administrator:

- [ ] `DocType List` shows: Entrepreneur, Need Journey, Referral, Provider
- [ ] `Role List` shows: DRIVE Agent, DRIVE Programme Officer, DRIVE Provider
- [ ] Open browser: `https://<site>/api/method/drive.drive.drive.api.get_session_info`
      while logged in → should return JSON with `user`, `drive_role`, `company`

---

## Troubleshooting

**`App 'drive' not in bench`**
: Check that `apps/drive/setup.py` exists and you ran pip install.

**`migrate` fails with "Table already exists"**
: Run `bench --site <site> migrate --skip-failing` to skip and continue.

**`ModuleNotFoundError: drive`**
: Run `~/frappe-bench/env/bin/pip install -e ~/frappe-bench/apps/drive`

**AI extraction returns "AI not configured"**
: Run the `set-config anthropic_api_key` command in Step 5.

**Permission denied errors in API calls**
: Ensure the user has the correct DRIVE role AND a Default Company set.

---

## File structure (for reference)

```
frappe-app/
└── drive/                   ← the ERPNext app
    ├── setup.py             ← pip installable package
    └── drive/
        ├── hooks.py         ← app registration
        ├── modules.txt
        └── drive/
            ├── api.py       ← REST endpoints for the PWA
            ├── setup.py     ← role creation helper
            └── doctype/
                ├── entrepreneur/
                ├── need_journey/
                ├── referral/
                └── provider/
```

---

## API endpoints (for developers)

Base URL: `https://<site>/api/method/drive.drive.drive.api.`

| Method | Endpoint | Description |
|---|---|---|
| GET | `get_entrepreneurs` | List all entrepreneurs (company-scoped) |
| GET | `get_entrepreneur?name=ENT-001` | Single entrepreneur detail |
| POST | `add_entrepreneur` | Create new entrepreneur |
| GET | `get_need_journeys?entrepreneur=ENT-001` | Need journeys for entrepreneur |
| POST | `upsert_need_journey` | Create or update a need journey |
| POST | `add_need_observation` | Append timestamped observation |
| GET | `get_referrals` | List referrals (filterable) |
| POST | `add_referral` | Create referral |
| POST | `update_referral` | Update referral status/notes |
| GET | `get_providers` | List active service providers |
| GET | `get_conversation_notes?entrepreneur=ENT-001` | Conversation history |
| POST | `add_conversation_note` | Add visit/call note |
| POST | `ai_extract` | AI extraction from voice/text note |
| GET | `get_session_info` | Current user role + company |

All endpoints require `Authorization: token <api_key>:<api_secret>` header.
