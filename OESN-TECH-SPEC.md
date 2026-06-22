# OESN Technical Specification — Developer Build Guide

**System:** Open Entrepreneurship Support Network  
**Version:** 0.1 (aligned to UC1 v0.5 and Operating Model Journeys v0.4)  
**Scope:** Agent app · Backend API · Provider dashboard · Programme dashboard · AI tools · Plugin architecture  
**Status:** Draft for developer handoff

---

## 1. What Is Being Built

OESN is a three-sided network protocol for field-operated entrepreneur support. It is **not** a simple form-collection app. It is a full operating system for a field agent who:

- Finds entrepreneurs at their doorstep (no prior contact)
- Builds a trusted relationship across multiple visits
- Runs a diagnostic conversation that maps needs to a capability layer
- Delivers some services directly (unit costing, FSSAI filing, WhatsApp catalogue)
- Refers others to registered providers (market linkage, loans, branding, solar)
- Tracks every referral from creation to verified outcome across three parties
- Earns at each step, with settlement tracked to the rupee

The three sides of the network:

```
┌─────────────────────┐   ┌──────────────────────┐   ┌───────────────────────┐
│   AGENT SIDE        │   │   PROVIDER SIDE       │   │   PROGRAMME SIDE      │
│                     │   │                       │   │  (when present)       │
│  Field agent app    │   │  Provider dashboard   │   │  Programme dashboard  │
│  CRM + diagnostics  │◄──►  Referral management  │◄──►  Agent oversight      │
│  Service delivery   │   │  Evidence upload      │   │  Credit management    │
│  Earning tracker    │   │  Commission tracking  │   │  Aggregate reporting  │
└─────────────────────┘   └──────────────────────┘   └───────────────────────┘
             │                       │                          │
             └───────────────────────┴──────────────────────────┘
                              OESN Backend API
                         PostgreSQL · Redis · S3
```

Everything connects through one backend. Every referral status change is immediately visible on all three dashboards.

---

## 2. System Components

| Component | What it is | Who uses it | Platform |
|---|---|---|---|
| **Agent App** | Primary field tool — CRM, diagnostics, service delivery, referrals, earnings | Field agents | Mobile-first PWA (Android priority) or React Native |
| **Backend API** | REST + WebSocket API serving all three sides | All | Node.js (Express/Fastify) or Python (FastAPI) |
| **Database** | Single source of truth — all entities, state, audit trail | Backend | PostgreSQL |
| **Provider Dashboard** | Web UI for service providers — referral management, status updates, evidence upload | Service providers | React web app |
| **Programme Dashboard** | Web UI for deploying orgs — portfolio view, agent activity, credit management | NGOs, govt programmes | React web app |
| **AI/LLM Layer** | Diagnostic assistance, parameter extraction, plugin services | Agent app (via backend) | Claude API + Google Translate |
| **Offline Store** | Local data store for field use without connectivity | Agent app | IndexedDB (PWA) or SQLite (React Native) |
| **File Storage** | Product photos, evidence documents, voice notes | Backend | S3-compatible (AWS S3 or Cloudflare R2) |
| **WhatsApp Layer** | Entrepreneur-facing communication (see WHATSAPP-PLATFORM-SPEC.md) | Glific + Gupshup | Separate service, connects via API |

---

## 3. Data Model

### 3.1 Core Entities

#### `agents`
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
phone               TEXT UNIQUE NOT NULL
language            TEXT NOT NULL          -- 'kannada' | 'khasi' | 'marathi' | 'english' etc
geography_district  TEXT
geography_state     TEXT
operating_model     TEXT NOT NULL          -- 'independent' | 'csr' | 'govt'
deploying_org_id    UUID REFERENCES organisations(id)  -- nullable for independent
oesn_registration   TEXT UNIQUE           -- OESN registration number
kyc_verified        BOOLEAN DEFAULT false
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `entrepreneurs`
```sql
id                  UUID PRIMARY KEY
phone               TEXT UNIQUE NOT NULL
name                TEXT
entity_type         TEXT DEFAULT 'individual'  -- 'individual' | 'group' | 'family' | 'producer_group'
group_member_count  INTEGER
group_representative TEXT                 -- name + role for group entities
sector              TEXT
geography_village   TEXT
geography_block     TEXT
geography_district  TEXT
geography_state     TEXT
kyc_level           INTEGER DEFAULT 0     -- 0, 1, 2, 3 — NEVER store raw KYC docs
entry_pattern       TEXT                  -- 'agent_doorstep' | 'self_initiated' | 'word_of_mouth' | 'programme_enrolled'
assigned_agent_id   UUID REFERENCES agents(id)
consent_status      TEXT DEFAULT 'none'   -- 'none' | 'active' | 'revoked'
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `consent_artifacts`
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
agent_id            UUID                  -- or 'self' for self-registration
scope               JSONB NOT NULL        -- {diagnostic: true, referral: true, programme_share: false}
method              TEXT NOT NULL         -- 'verbal_agent_attested' | 'otp_confirmed'
consenting_party    TEXT                  -- name of person who consented
consenting_role     TEXT                  -- 'individual' | 'group_representative'
otp_verified        BOOLEAN DEFAULT false
revoked             BOOLEAN DEFAULT false
revoked_at          TIMESTAMPTZ
revocation_reason   TEXT
created_at          TIMESTAMPTZ DEFAULT now()
```

**Rule:** Consent artifact must exist and `revoked = false` before any diagnostic, referral, or data-sharing action can proceed. This is enforced at the API layer — not just the UI.

#### `diagnostic_sessions`
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
agent_id            UUID REFERENCES agents(id)
status              TEXT DEFAULT 'open'   -- 'open' | 'complete'
visit_number        INTEGER DEFAULT 1
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `conversation_notes`
```sql
id                  UUID PRIMARY KEY
session_id          UUID REFERENCES diagnostic_sessions(id)
content_type        TEXT                  -- 'text' | 'voice_transcript' | 'image' | 'observation'
raw_content         TEXT                  -- unstructured, as captured
media_url           TEXT                  -- S3 URL for voice/image
ai_suggested_tags   JSONB                 -- AI's suggested capability tags (unconfirmed)
agent_reviewed      BOOLEAN DEFAULT false
created_at          TIMESTAMPTZ DEFAULT now()
```

**Rule:** ConversationNotes are saved immediately without requiring structure. Structure is derived progressively.

#### `entrepreneur_parameters`
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
session_id          UUID REFERENCES diagnostic_sessions(id)
module              TEXT                  -- 'cost_visibility' | 'market_access' | etc
key                 TEXT                  -- e.g. 'selling_price_per_unit', 'monthly_revenue_range'
value               TEXT
source              TEXT                  -- 'agent_input' | 'ai_extracted'
agent_confirmed     BOOLEAN DEFAULT false
confirmed_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
```

**Rule:** AI-extracted parameters are saved with `agent_confirmed = false`. The agent must explicitly confirm before parameters drive any downstream action (referral creation, service readiness checks).

#### `capability_mappings`
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
session_id          UUID REFERENCES diagnostic_sessions(id)
capability_tag      TEXT NOT NULL         -- from OESN capability taxonomy (see §5)
status              TEXT DEFAULT 'identified'  -- 'identified' | 'confirmed' | 'deferred' | 'addressed'
agent_confirmed     BOOLEAN DEFAULT false
priority            INTEGER               -- agent-assigned priority 1-5
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `service_units` (provider catalogue)
```sql
id                  UUID PRIMARY KEY
provider_id         UUID REFERENCES providers(id)
name                TEXT NOT NULL
capability_tags     TEXT[]                -- array of OESN taxonomy tags
delivery_modality   TEXT                  -- 'agent_delivered' | 'provider_delivered' | 'remote'
completion_criteria TEXT NOT NULL         -- exact verifiable condition for outcome verification
price_to_entrepreneur NUMERIC
price_currency      TEXT DEFAULT 'INR'
commission_type     TEXT                  -- 'fixed' | 'percentage'
commission_amount   NUMERIC
kyc_level_required  INTEGER DEFAULT 0
required_diagnostic_modules TEXT[]        -- modules that must be complete before referral
delivery_geography  TEXT[]
delivery_timeline_days INTEGER
declared_capacity   INTEGER               -- max concurrent referrals
active              BOOLEAN DEFAULT true
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `referrals`
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
agent_id            UUID REFERENCES agents(id)
provider_id         UUID REFERENCES providers(id)  -- nullable for intent referrals
service_unit_id     UUID REFERENCES service_units(id)  -- nullable for intent referrals
status              TEXT DEFAULT 'approved'
  -- 'approved' | 'in_progress' | 'blocked' | 'rtc' | 'completed' | 'disputed' | 'cancelled'
payment_pattern     TEXT NOT NULL
  -- 'programme_prebuy' | 'provider_commission' | 'direct_payment'
programme_credit_id UUID                  -- if programme_prebuy
locked_price        NUMERIC
locked_commission   NUMERIC
locked_delivery_days INTEGER
locked_completion_criteria TEXT
delivery_deadline   TIMESTAMPTZ
intent_flag         BOOLEAN DEFAULT false  -- true for pre-empanelment intent referrals
intent_provider_name TEXT                 -- for intent referrals
intent_commission_terms TEXT
intent_date         TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

**Rule:** All three sides (agent, provider, programme) see referral status updates in real time via WebSocket. No side operates on stale state.

#### `referral_status_history`
```sql
id                  UUID PRIMARY KEY
referral_id         UUID REFERENCES referrals(id)
from_status         TEXT
to_status           TEXT NOT NULL
changed_by_role     TEXT                  -- 'agent' | 'provider' | 'programme' | 'system'
changed_by_id       UUID
reason              TEXT
evidence_url        TEXT
created_at          TIMESTAMPTZ DEFAULT now()
```

Full append-only audit trail. Never update, only insert.

#### `earning_events`
```sql
id                  UUID PRIMARY KEY
agent_id            UUID REFERENCES agents(id)
referral_id         UUID REFERENCES referrals(id)  -- nullable for direct service delivery
service_delivery_id UUID                  -- for agent-delivered services
basis               TEXT                  -- 'service_delivery' | 'provider_commission' | 'programme_prebuy'
amount              NUMERIC NOT NULL
currency            TEXT DEFAULT 'INR'
payment_pattern     TEXT NOT NULL
status              TEXT DEFAULT 'pending'  -- 'pending' | 'confirmed' | 'settled'
confirmed_at        TIMESTAMPTZ
settled_at          TIMESTAMPTZ
payer               TEXT                  -- 'entrepreneur' | 'provider' | 'programme'
payer_id            UUID
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `service_deliveries` (agent-delivered services)
```sql
id                  UUID PRIMARY KEY
entrepreneur_id     UUID REFERENCES entrepreneurs(id)
agent_id            UUID REFERENCES agents(id)
service_type        TEXT                  -- 'unit_costing' | 'fssai_filing' | 'whatsapp_catalogue' | 'scheme_unlock' | etc
input_data          JSONB                 -- tool inputs (not shared externally)
output_data         JSONB                 -- tool outputs (shown to entrepreneur)
fee_stated_amount   NUMERIC               -- fee the agent stated before running the tool
agent_confirmed     BOOLEAN DEFAULT false
entrepreneur_acknowledged BOOLEAN DEFAULT false
payment_received    BOOLEAN DEFAULT false
payment_amount      NUMERIC
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `organisations` (deploying orgs)
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
type                TEXT                  -- 'ngo' | 'csr' | 'govt_scheme'
programme_name      TEXT
programme_end_date  DATE
contact_email       TEXT
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `programme_credits`
```sql
id                  UUID PRIMARY KEY
organisation_id     UUID REFERENCES organisations(id)
service_unit_id     UUID REFERENCES service_units(id)
total_credits       INTEGER NOT NULL
used_credits        INTEGER DEFAULT 0
expiry_date         DATE
agent_commission_per_delivery NUMERIC
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `providers`
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
contact_name        TEXT
contact_email       TEXT
contact_phone       TEXT
geography           TEXT[]
sectors             TEXT[]
empanelment_status  TEXT DEFAULT 'pending'  -- 'pending' | 'active' | 'suspended'
empanelled_at       TIMESTAMPTZ
recommended_by_agent_id UUID
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `tasks`
```sql
id                  UUID PRIMARY KEY
agent_id            UUID REFERENCES agents(id)
entrepreneur_id     UUID REFERENCES entrepreneurs(id)  -- nullable
referral_id         UUID REFERENCES referrals(id)       -- nullable
title               TEXT NOT NULL
due_date            DATE
status              TEXT DEFAULT 'open'   -- 'open' | 'done'
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `escalations`
```sql
id                  UUID PRIMARY KEY
referral_id         UUID REFERENCES referrals(id)
raised_by_id        UUID
raised_by_role      TEXT
target              TEXT                  -- 'programme' | 'nfo'
reason              TEXT NOT NULL
status              TEXT DEFAULT 'open'   -- 'open' | 'resolved'
resolved_by_id      UUID
resolution_note     TEXT
created_at          TIMESTAMPTZ DEFAULT now()
resolved_at         TIMESTAMPTZ
```

---

## 4. Backend API

### 4.1 Technology Stack

```
Runtime:     Node.js 20 (Fastify) OR Python 3.12 (FastAPI)
Database:    PostgreSQL 16
Cache/Queue: Redis 7
Storage:     S3-compatible (Cloudflare R2 recommended for cost)
WebSocket:   Native WS or Socket.IO for three-sided live updates
Auth:        JWT (short-lived access tokens) + refresh tokens
OTP:         Twilio Verify or MSG91 (India-local)
Hosting:     Railway, Render, or a single VPS (2 vCPU / 4GB RAM for pilot)
```

### 4.2 API Endpoint Map

All routes prefixed `/api/v1`. All require `Authorization: Bearer <token>` except auth routes.

#### Auth
```
POST   /auth/otp/send              Send OTP to phone number (agent or entrepreneur)
POST   /auth/otp/verify            Verify OTP, return JWT
POST   /auth/token/refresh         Refresh access token
GET    /auth/me                    Current authenticated user
```

#### Agents
```
POST   /agents/register            Register new agent (admin or NFO only)
GET    /agents/:id                 Get agent profile
PATCH  /agents/:id                 Update agent profile
GET    /agents/:id/dashboard       Main dashboard data (portfolio health, earning summary)
GET    /agents/:id/entrepreneurs   List all entrepreneurs (paginated, filterable)
GET    /agents/:id/referrals       List all referrals by status
GET    /agents/:id/earnings        Earning events with settlement status
GET    /agents/:id/tasks           Tasks list (with offline-sync support)
```

#### Entrepreneurs
```
POST   /entrepreneurs              Register new entrepreneur (requires agent auth + consent capture)
GET    /entrepreneurs/:id          Get entrepreneur profile + capability map + timeline
PATCH  /entrepreneurs/:id          Update entrepreneur profile fields
GET    /entrepreneurs/:id/timeline Full chronological activity: visits, diagnostics, referrals, services
```

#### Consent
```
POST   /consent                    Create consent artifact (OTP must be verified first)
POST   /consent/:id/revoke         Revoke consent — immediately propagates to block all pending referrals
GET    /consent/:id                Get consent artifact (agent or entrepreneur only)
```

#### Diagnostics
```
POST   /diagnostics                Start diagnostic session
POST   /diagnostics/:id/notes      Add conversation note (text, voice URL, image URL)
GET    /diagnostics/:id/suggest    AI-suggested capability tags + parameters from notes
POST   /diagnostics/:id/confirm    Agent confirms parameters and capability tags
GET    /diagnostics/:id            Get session with all notes and confirmed parameters
PATCH  /diagnostics/:id            Update session status (open → complete)
```

#### Service Delivery (agent-delivered)
```
POST   /services/unit-costing      Run unit costing calculation — returns margin analysis
POST   /services/solar-assessment  Run solar load estimate
POST   /services/loan-readiness    Run loan readiness score
POST   /services/fssai-eligibility Run FSSAI category determination (offline-capable)
POST   /services/scheme-match      Match entrepreneur against scheme database
POST   /services/delivery          Log a completed agent-delivered service + earning event
PATCH  /services/delivery/:id/confirm  Agent confirmation before saving (required)
```

#### Referrals
```
GET    /services/catalogue         Search service units by capability tag + geography
POST   /referrals                  Create referral (runs all readiness checks first)
GET    /referrals/:id              Get referral with full status history
PATCH  /referrals/:id/status       Update status — available transitions depend on role
POST   /referrals/:id/evidence     Upload evidence (provider side)
POST   /referrals/:id/verify       Agent verifies outcome (entrepreneur confirmed in person)
POST   /referrals/:id/dispute      Agent disputes RTC
POST   /referrals/:id/escalate     Raise escalation to programme or NFO
POST   /referrals/intent           Create intent referral (pre-empanelment)
POST   /referrals/intent/:id/link  Link intent to empanelled provider
```

#### Providers
```
POST   /providers/register         Provider self-registration
GET    /providers/:id              Get provider profile
PATCH  /providers/:id              Update provider profile / catalogue
GET    /providers/:id/referrals    Provider's active referrals
PATCH  /providers/:id/catalogue    Update service unit listing
```

#### Earnings
```
GET    /earnings/:agentId          All earning events for agent
PATCH  /earnings/:id/confirm       Confirm earning (programme or provider side)
GET    /earnings/:agentId/summary  Pending / confirmed / settled totals
```

#### Organisations (Deploying Orgs)
```
POST   /organisations              Register organisation
GET    /organisations/:id/dashboard  Programme dashboard: referrals, agent activity, credits, escalations
GET    /organisations/:id/agents   Agents deployed under this programme
GET    /organisations/:id/credits  Credit balance per service unit
POST   /organisations/:id/credits  Add credits (purchase)
POST   /escalations/:id/resolve    Resolve an escalation
```

#### WebSocket Events
```
SUBSCRIBE  /ws/referrals/:id       Real-time status updates for a referral (all three sides)
SUBSCRIBE  /ws/agent/:id           Agent dashboard live updates (new messages, status changes)
SUBSCRIBE  /ws/programme/:id       Programme dashboard live updates
```

### 4.3 Readiness Check Logic

Every referral creation (`POST /referrals`) must pass this gate before any referral artifact is created:

```
1. Consent artifact exists and revoked = false
2. OTP verified on consent
3. KYC level >= service_unit.kyc_level_required
4. All service_unit.required_diagnostic_modules are confirmed (agent_confirmed = true)
5. Provider capacity: provider's active referrals < declared_capacity
6. If programme_prebuy: programme credit is active and balance > 0

If any check fails:
  → Return 409 with structured error:
    { block_reason: "human-readable explanation", resolution_path: "what agent must do" }
  → Do not create the referral artifact
  → Do not show a generic error — every block must be actionable
```

---

## 5. OESN Capability Taxonomy (V1)

These tags are used to link diagnostic parameters to candidate services. The NFO maintains and versions this list. The taxonomy must be stored in the database and served via API — not hardcoded in clients.

```
cost_visibility          Unit costs, margins, pricing, profitability
market_access            Buyers, market linkage, trade connections, export
brand_presence           Logo, brand identity, label, packaging design
regulatory_readiness     FSSAI, MSME Udyam, GST, BIS, trade licence, compliance
digital_presence         WhatsApp catalogue, Instagram, Shopify, QR payments
financial_readiness      Loans, working capital, SHG-bank linkage, scheme finance
energy_reliability       Solar, DRE, generator-to-solar, power cost reduction
supply_chain             Packaging materials, raw material sourcing, supplier linkage
product_quality          Testing, standardisation, shelf-life, certifications
business_advisory        Strategy, pricing, growth planning, working capital management
```

---

## 6. Agent Application — Full Feature Specification

The agent app is the primary product. It is the diagnostic tool, the CRM, the service delivery platform, and the earning tracker. Every screen below is a build requirement derived from the operating model scenarios.

### 6.1 Platform Decision

**Recommended: Progressive Web App (PWA)**
- Works on any Android browser (no Play Store dependency)
- Service Worker for offline capability
- IndexedDB for local data store
- Push notifications via Web Push
- Easy to update without asking agents to update an app

**Alternative: React Native** if native camera/audio access proves limiting in PWA.

### 6.2 Design Constraints

- **Works in direct sunlight** — high contrast mode, minimum 4.5:1 contrast ratio, large touch targets (minimum 48×48dp)
- **Low-bandwidth tolerant** — API calls must handle 2G/3G gracefully; show cached data while updating
- **Regional language support from day one** — UI strings, diagnostic prompts, tool outputs, and earning summaries in agent's language (start: English, Khasi, Kannada, Marathi — expand from field feedback)
- **One-handed usable** — agent is often holding something, talking to someone
- **Battery-conscious** — no background polling; use WebSocket only when app is open

### 6.3 Screen Map

#### Home / Weekly Dashboard
The agent's primary planning surface. Opens every session. Must answer five questions without navigation:

1. **Who needs a visit this week?** — overdue follow-ups, referrals approaching deadline, dormant entrepreneurs (14-day and 30-day alerts)
2. **What is blocked or escalated?** — referrals with open blockers, escalations pending response
3. **What provider updates came in?** — status changes since last session
4. **What tasks are due?** — linked to entrepreneurs and referrals
5. **What earning is pending settlement?** — amount and expected date

Layout:
```
[Header: Agent name · District · Week dates]

ATTENTION NEEDED  ─────────────────────────────
  ● Bhaskar — solar referral overdue 5 days [Escalate]
  ● Kavitha — verification pending [Visit due]
  ● Anand — dormant 28 days [Send message]

THIS WEEK'S TASKS  ────────────────────────────
  ○ Kavitha: verify FSSAI outcome [Today]
  ○ Priya: follow up loan disbursement [Thursday]

EARNINGS  ─────────────────────────────────────
  Pending:    ₹1,200  (2 referrals)
  Confirmed:  ₹400    (1 referral, release Friday)
  This month: ₹4,800

PORTFOLIO HEALTH  ──────────────────────────────
  Active: 28   Dormant: 2   New this week: 1
```

#### Entrepreneur List
- Searchable, filterable by status (active / dormant / new), capability tag, referral status
- Each row: name, sector, days since last contact, open referral count, next action
- Tap → Entrepreneur Profile

#### Entrepreneur Profile
Full longitudinal record. Tabs:

**Overview tab:**
- Name, sector, location, entity type, KYC level
- Capability map: each confirmed tag with status (identified / in-progress / addressed)
- Next recommended action (AI-suggested based on capability gaps)
- Assigned tasks

**Timeline tab:**
- Chronological activity: every visit, diagnostic session, service delivery, referral status change
- Each item expandable to see notes and data

**Diagnostics tab:**
- All diagnostic sessions, resumable
- Conversation notes (text, voice, image)
- Confirmed parameters by module
- AI suggestions (unconfirmed, shown separately)

**Referrals tab:**
- All referrals with current status
- Tap to see referral detail: terms, status history, provider updates, evidence

**Services tab:**
- All agent-delivered services: unit costing outputs, scheme eligibility results, FSSAI status
- Earning events linked to each

**Notes tab:**
- Private agent notes (not shared with providers or programme)
- New note: text or voice

#### New Entrepreneur Registration
Step-by-step, required fields minimal at entry:

```
Step 1: Contact
  Phone number → Send OTP → Verify OTP

Step 2: Basic profile (all optional at this step — can be completed across visits)
  Name / Entity type / Sector / Location

Step 3: Consent capture
  Read consent scope to entrepreneur in their language
  Method: Verbal (agent attests) or OTP-confirmed
  Consent artifact created → timestamped

Step 4: Visit note
  Optional: add first conversation note (text or voice)
  
→ Profile created. Programme dashboard notified if applicable.
```

#### Diagnostic Session
Not a form. A workspace for capturing and making sense of a conversation.

```
[Session header: Entrepreneur · Visit N · Date]

CONVERSATION NOTES  ──────────────────────────
  [+ Add note]  [🎤 Voice]  [📷 Photo]
  
  [Note 1 — 10:32am] "She sells at Rs.6/bundle..."
  [Note 2 — 10:35am] [Photo: product setup]

AI SUGGESTIONS (unconfirmed — review before saving)  ──
  → Cost Visibility: selling price Rs.6/bundle detected
  → Market Access: single buyer dependency flagged
  [Review suggestions] [Dismiss all]

CONFIRMED PARAMETERS  ────────────────────────
  Cost Visibility:
    selling_price_per_unit: Rs.6/bundle ✓ (agent confirmed)
    
CONFIRMED CAPABILITY TAGS  ────────────────────
  ✓ Cost Visibility (priority: 1)
  ✓ Market Access (priority: 2)
  ○ Brand Presence (identified, deferred)
  
CANDIDATE SERVICES  ───────────────────────────
  ● Unit Costing Tool [Agent-delivered · Rs.150 · Ready ✓]
  ● Meera Connects — Market Linkage [Provider · Rs.0 to entrepreneur · Ready ✓]
  ● FoodSafe Solutions — FSSAI [Provider · Rs.200 govt fee · Blocked: KYC 1 required]
```

**AI suggestion flow:**
1. Agent adds notes (text/voice/photo)
2. Backend sends note to Claude API for extraction (async, ~2–3 seconds)
3. App receives suggested tags and parameters
4. **Agent must tap Confirm on each suggestion** before it enters the confirmed data store
5. Agent can edit values before confirming
6. Unconfirmed suggestions never drive downstream actions

#### Service Delivery Tools

All calculation tools must work **fully offline**. They are client-side calculations with no server dependency.

**Unit Costing Tool:**
```
Inputs (from diagnostic data or manual entry):
  Raw materials (itemised: material name, qty, unit, cost per unit)
  Labour (hours, rate)
  Overhead / utilities estimate
  Output quantity per batch
  Current selling price

Outputs:
  Cost per unit
  Margin per unit (₹ and %)
  Break-even selling price
  Monthly profit at current volume
  Sensitivity: "If you sold at Rs.8, margin would be Rs.2.10 (26%)"

Fee flow:
  [Fee to state: Rs.___] → [Confirm fee stated] → [Run calculation]
  Output visible after agent confirms → Entrepreneur acknowledges → [Log delivery]
```

**Loan Readiness Calculator:**
```
Inputs: Monthly revenue range, monthly expenses, existing loans,
        loan purpose, amount sought, bank account status, credit history
Outputs: Readiness score (0-100), gap analysis, recommended product
         (MUDRA / NBFC / SHG-bank linkage), documents checklist
Offline: Yes — all local logic
```

**FSSAI Eligibility Checker:**
```
Inputs: Business type, turnover estimate, states of operation, products
Outputs: Recommended licence category (Basic / State / Central),
         documents checklist, estimated cost, timeline
Offline: Yes — static logic table, updated in background sync
```

**Scheme Eligibility Matcher:**
```
Inputs: Entrepreneur category (SC/ST/OBC/Gen), sector, state, 
        business stage, prior scheme benefits
Outputs: 3–5 eligible schemes ranked by ease + benefit, documents needed
Offline: Scheme database synced weekly, matched locally
```

**Solar / DRE Load Assessment:**
```
Inputs: Equipment list (item, wattage, hours/day), current energy source,
        monthly energy cost, power cut frequency, roof/land available,
        premises ownership
Outputs: Daily kWh load, recommended system size, cost range,
         monthly saving, estimated payback period
Offline: Yes — calculation model is local
```

#### Referral Creation
Triggered from Candidate Services list on diagnostic screen.

```
1. Service selected (from candidate list or manual search)
2. Readiness check runs (server call — requires connectivity)
   → If blocked: show block reason + resolution path
   → If clear: proceed
3. Referral package preview:
   - What the provider will see (sector, capability need, key parameters, photos)
   - What the entrepreneur will not see (diagnostic notes, cost details from other referrals)
   - Locked terms: price, delivery timeline, completion criteria, commission
   - Payment pattern clearly shown
4. Agent reviews with entrepreneur: "Here is what I am sending to [Provider]"
5. Entrepreneur acknowledges
6. [Submit referral]
7. → Referral created, provider notified, all three sides updated
```

**For intent referrals (provider not yet on OESN):**
```
Provider name (text input)
Service description
Commission terms agreed (text)
Intent date (pre-filled: today)
[Save intent] → Transaction can proceed in real world
→ Intent archived if not linked within 45 days
```

#### Referral Detail
```
[Referral header: Service · Provider · Status badge · Days remaining]

STATUS HISTORY  ──────────────────────────────
  ● Approved          — Agent — 12 Jun 10:42am
  ● In Progress       — Provider — 13 Jun 2:15pm
  ● Blocked           — Provider — 15 Jun — "Missing label spec"
  ● Blocker resolved  — Agent — 16 Jun

PROVIDER UPDATES  ────────────────────────────
  "Design draft ready, please share entrepreneur feedback"
  [Reply to provider]

EVIDENCE  ────────────────────────────────────
  [No evidence uploaded yet]

EARNING  ─────────────────────────────────────
  Pattern: Provider commission
  Amount: ₹250 on verified outcome
  Status: Pending

ACTIONS  ─────────────────────────────────────
  [Flag blocker]  [Escalate to NFO]  [Verify outcome]  [Dispute RTC]
```

#### Earning Tracker
```
[Summary: Pending ₹1,200 · Confirmed ₹400 · Settled this month ₹3,200]

PENDING  ─────────────────────────────────────
  Meera Connects — Market Linkage (Kavitha)
  ₹250 · Provider commission · Awaiting verification
  
  Unit Costing (Priya)
  ₹150 · Direct payment · Awaiting entrepreneur payment

CONFIRMED  ───────────────────────────────────
  NBFC Loan (Laxmi)
  ₹400 · Provider commission · Release: Friday

SETTLED THIS MONTH  ──────────────────────────
  [List with dates]

Total this month: ₹4,800
```

### 6.4 Offline Behaviour

**Available without connectivity:**
- Read: all entrepreneur profiles, referral statuses, task list (last synced)
- Write (queued): conversation notes, diagnostic inputs, task completion marks
- Calculate: unit costing, FSSAI eligibility, scheme matcher, solar assessment, loan readiness

**Blocked without connectivity (with clear message):**
- Referral creation (requires live readiness check + provider notification)
- OTP verification
- Programme credit check
- Consent artifact creation

**On reconnection:**
- All queued writes sync automatically
- Conflicts surfaced to agent for resolution (never silently overwritten)
- No data loss — queue is append-only

**IndexedDB / SQLite schema** mirrors the server schema for entities the agent needs offline:
- Full entrepreneur profiles (assigned entrepreneurs only)
- Referral summaries and status (not full history — on-demand)
- Tasks
- Scheme database (weekly sync)
- Taxonomy (weekly sync)
- Offline calculation module bundles

---

## 7. AI and LLM Layer

### 7.1 Diagnostic Assistance (Claude API)

Every conversation note is processed asynchronously after saving. The agent is never blocked waiting for AI.

**Prompt template:**
```
System:
You assist OESN field agents in India who support micro-entrepreneurs. 
Extract structured business signals from field notes. Return JSON only.
Be conservative — only extract what is clearly stated. Do not infer.

Capability tags available: [cost_visibility, market_access, brand_presence, 
regulatory_readiness, digital_presence, financial_readiness, energy_reliability, 
supply_chain, product_quality, business_advisory]

Extract:
  capability_tags: [list of tags with evidence quote from text]
  parameters: [{module, key, value, confidence: high/medium/low, quote}]
  needs_flagged: [brief phrases for needs clearly expressed]
  concerns: [anything that needs agent attention — consent, safety, urgency]

User: [conversation note text / voice transcript]
```

Use **Claude Haiku** for speed and cost. At NGO volumes (~500 notes/day × 200 tokens), cost is under ₹200/month.

### 7.2 Translation Assist

For notes and messages in regional languages (Khasi, Garo, Pnar, Kannada, Marathi):

- Detect language: Google Cloud Translation API (`detectLanguage`)
- Translate to English: Google Translate API
- Store translation alongside original
- Show to agent as context — labelled "Rough translation — verify with entrepreneur"

Translation is always clearly marked as approximate. Never used for consent verification or legal records.

### 7.3 Plugin Services (Pay-Per-Use)

Plugins are external API services accessed through the OESN backend. The agent's earning account is charged at the point of use. The agent prices the service to the entrepreneur above their cost. Markup cap: 5× API cost (OESN collective rule).

| Plugin | What It Does | API Cost Estimate | Agent Charges |
|---|---|---|---|
| AI Product Photography | 3–5 raw photos → professional product images (clean background, good lighting) | ₹20–50 per set | ₹150–300 per product |
| Digital Catalogue Generator | Product details + photos → formatted PDF / WhatsApp-ready catalogue | ₹30–80 per catalogue | ₹200–400 |
| Logo / Brand Identity | Brand brief → 3–5 logo options | ₹50–150 | ₹300–500 |
| Packaging Label Template | Product data + FSSAI number → print-ready FSSAI-compliant label | ₹30–60 | ₹150–250 |
| Social Media Content Pack | Product details → 5–10 Instagram/Facebook posts with captions | ₹40–100 | ₹200–400 |
| Market Price Lookup | Product category + geography → current wholesale/retail price ranges | ₹5–15 | Included in unit costing fee |

**Plugin flow in app:**
```
1. Agent selects plugin from service tool
2. App shows: "This tool costs ₹XX from your earning account. Charge entrepreneur ₹YY?"
3. Agent sets price (within 5× cap)
4. [Confirm and run]
5. API call made through OESN backend (agent never sees raw API credentials)
6. ₹XX deducted from agent earning account
7. Result returned to agent
8. Agent reviews → delivers to entrepreneur
9. Service logged, earning event created
```

**Implementation:** OESN backend holds the API keys for all plugin providers. Agents access plugins through OESN — they never need their own API accounts. This is a managed service.

---

## 8. Provider Dashboard

Web app (React). Provider sees only their referrals with minimum entrepreneur context.

**What providers see per referral:**
- Entrepreneur sector and geography (not name, not phone, not diagnostics)
- Capability need and referral terms
- Completion criteria
- Lead brief (product details, photos if applicable)
- Referral status history

**What providers can do:**
- Update referral status
- Upload evidence (photos, documents, confirmation screenshots)
- Mark Ready to Close (RTC)
- Flag a blocker with reason
- Update service catalogue

**What providers cannot see:**
- Entrepreneur personal details or contact info (until explicitly consented per referral)
- Diagnostic conversation notes
- Cost structure or other referrals
- Other providers' referrals

---

## 9. Programme Dashboard

Web app (React). Deploying organisation sees aggregated view.

**Dashboard sections:**
- **Portfolio overview:** referrals by status, agent activity by week, entrepreneur count
- **Credit management:** credit balance per service unit, usage rate, projected exhaustion date
- **Agent performance:** referrals created, completed, earning events (aggregate — not individual earning details)
- **Escalations:** open escalations requiring programme response
- **Dormant entrepreneurs:** contacts with no activity in 30 days across all agents
- **Outcome tracking:** completion rate by service type, delivery time performance

**What programmes cannot see:**
- Individual agent earning amounts
- Entrepreneur diagnostic notes
- Provider internal data

---

## 10. WhatsApp Integration

OESN and the WhatsApp communication layer (specified in `WHATSAPP-PLATFORM-SPEC.md`) are separate systems that share the entrepreneur contact record.

**Connection points:**

| Event in OESN | Action in WhatsApp layer |
|---|---|
| New entrepreneur registered | Glific contact created with programme label and agent assignment |
| Referral status changes to `completed` | WhatsApp notification sent to entrepreneur (via Glific broadcast template) |
| Agent marks entrepreneur as `needs-followup` | PM notified in Glific inbox |
| Doorstep intake form submitted (Gupshup) | Webhook creates stub entrepreneur profile in OESN, assigns to agent |
| OESN diagnostic session opened | Glific conversation tagged with session ID for context |

**Sync mechanism:** Webhook from Glific to OESN API on contact events. Webhook from OESN to Glific API on outcome events.

The entrepreneur's phone number is the shared key. Both systems look up and update the same record by phone.

---

## 11. Phased Build Plan

### Phase 1 — Agent App Core + Backend (Weeks 1–8)
**Goal:** One agent can register entrepreneurs, run diagnostics, log services, and create referrals end-to-end.

- [ ] Backend API scaffold with auth (JWT + OTP)
- [ ] PostgreSQL schema — all core tables
- [ ] Entrepreneur registration + consent artifact creation
- [ ] Diagnostic session — note capture (text first, voice in Phase 2)
- [ ] AI diagnostic assistance (Claude Haiku) — async parameter suggestion
- [ ] Capability mapping confirmation flow
- [ ] Service readiness check logic
- [ ] Unit costing tool (offline-capable)
- [ ] FSSAI eligibility checker (offline-capable)
- [ ] Referral creation (online-required) with three-sided notification
- [ ] Agent earning event creation on service delivery
- [ ] Agent app: Home dashboard, entrepreneur list, entrepreneur profile, diagnostic screen, referral creation
- [ ] Agent app: Offline sync (IndexedDB + service worker)
- [ ] Agent app: English only in Phase 1

**Deliverable:** One agent completes Kavitha's full journey end-to-end in the app.

### Phase 2 — Provider Side + Three-Sided Exchange (Weeks 9–14)
**Goal:** Provider receives referrals, updates status, uploads evidence. Agent verifies. Earning confirmed.

- [ ] Provider registration and catalogue management
- [ ] WebSocket for real-time three-sided status sync
- [ ] Provider dashboard (web app — basic)
- [ ] Referral status history and evidence upload
- [ ] RTC flow — provider marks, agent verifies, earning confirmed
- [ ] Dispute flow
- [ ] Escalation flow (to programme or NFO)
- [ ] Earning tracker with pending/confirmed/settled states
- [ ] Loan readiness calculator (offline-capable)
- [ ] Solar assessment tool (offline-capable)
- [ ] Scheme matcher (offline-capable, weekly sync)
- [ ] Voice note capture in diagnostic session

**Deliverable:** Full Kavitha + Rajan (intent referral) + Meera Connects scenario runs end-to-end with real providers.

### Phase 3 — Programme Side + Operating Models (Weeks 15–20)
**Goal:** Deploying organisation has full programme visibility. All three operating models supported.

- [ ] Organisation registration
- [ ] Programme credit management
- [ ] Programme dashboard (web app)
- [ ] Programme-enrolled bulk registration (CSV import of entrepreneur stubs)
- [ ] CSR operating model: programme pre-buy payment pattern
- [ ] Govt scheme operating model: stipend + top-up earning rules
- [ ] Agent language support: Khasi, Kannada, Marathi (UI string translation)
- [ ] Intent referral archival at 45 days
- [ ] KYC upgrade flow
- [ ] Programme end / agent transition to independent

**Deliverable:** Full Phiba (CSR) and Meena (govt scheme) scenarios run end-to-end.

### Phase 4 — AI Plugins + WhatsApp Integration (Weeks 21–26)
**Goal:** Agent can deliver AI-powered services. WhatsApp layer connected.

- [ ] Plugin architecture: backend proxies API calls, charges agent earning account
- [ ] AI product photography plugin
- [ ] Digital catalogue generator plugin
- [ ] Logo generator plugin
- [ ] Packaging label template plugin
- [ ] WhatsApp integration: Glific contact sync, outcome notifications
- [ ] Entrepreneur WhatsApp access to their own consent + referral status
- [ ] Market price lookup plugin
- [ ] Portfolio health predictions (AI-suggested next actions per entrepreneur)

**Deliverable:** Agent can deliver a full brand package in one session. WhatsApp notifications reach entrepreneur on referral completion.

---

## 12. Open Questions Requiring Decisions Before Build

These block specific implementation decisions. Need answers from the OESN collective before Phase 1 starts.

1. **OTP provider:** Which service for India? MSG91 (local, cheaper) or Twilio Verify?
2. **Storage:** Cloudflare R2 (cheaper) or AWS S3? Affects file URL structure.
3. **Backend language:** Node.js/Fastify or Python/FastAPI? Affects developer hiring.
4. **Agent app platform:** PWA or React Native? Affects offline capability depth and camera access.
5. **Taxonomy ratification:** The 10 capability tags in §5 are V1 — collective must ratify before the schema is locked.
6. **KYC levels 0–3:** Exact definitions and which services require which level. Blocks service unit catalogue entry.
7. **Scheme database:** What is the source dataset? Government open data? Manually curated? Who maintains it? Affects scheme matcher implementation.
8. **Plugin provider selection:** Which AI services for photography, catalogue, logo generation? Affects plugin architecture contracts.
9. **NFO identity:** Who operates the NFO for pilot? Who has admin access to the OESN backend?
10. **Pilot geography:** Meghalaya only? Or multi-state from day one? Affects language priorities and scheme database scope.
11. **Trust-gating rule (§7.7 of UC1):** Must be ratified by collective before referral creation logic is finalised.
12. **Data retention policy:** How long are consent artifacts, diagnostic notes, and referral records kept? Affects database design and backup policy.

---

## 13. Technical Constraints Summary

- KYC documents **never** stored or transmitted as network payload. KYC level (integer 0–3) only. Hard rule — enforce at API input validation, not just UI.
- All calculation tools **must** function offline. No calculation should make a server call.
- Referral is **not committed** until all three sides are notified. If connectivity lost mid-creation, queue and complete on reconnect.
- AI parameter suggestions **must not** auto-confirm. Agent confirmation is a required user action, not a default.
- Consent revocation **propagates immediately** to block all pending referrals. This must be synchronous, not eventual.
- Payment pattern **must be visible to agent** before any service is initiated. Never reveal after.
- No silent blocks anywhere. Every block has a human-readable reason and a resolution path.
- Audit trail is append-only. No updates to `referral_status_history`, `consent_artifacts`, `earning_events`. Only inserts.
