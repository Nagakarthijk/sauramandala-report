# Sauramandala — WhatsApp Flows Specification

Built from programme Q&A. This is the source of truth for all flow design across programmes.  
Each section feeds into YAML config → deploy.py → Glific GraphQL.

---

## Table of Contents

1. [Common Architecture](#common-architecture)
2. [Common Onboarding Flow](#common-onboarding-flow)
3. [TFFP Flows](#tffp-flows)
4. [CMYC Flows](#cmyc-flows)
5. [OESN / Doorstep Flows](#oesn--doorstep-flows)
6. [Content Scheduler](#content-scheduler)
7. [Cross-Programme Systems](#cross-programme-systems)
8. [Flow Index](#flow-index)

---

## Common Architecture

### Platforms

| Layer | Tool | Purpose |
|-------|------|---------|
| WhatsApp delivery | Glific (Elixir, AGPL) | All chatbot flows, groups, broadcasts |
| Flow config | YAML → deploy.py → GraphQL | No drag-and-drop, version-controlled |
| Content scheduling | Google Sheet + Apps Script → Glific API | Per-programme content calendars |
| Backend CRM/data | Supabase (PostgreSQL) | Learner profiles, CRM, OESN, dashboards |
| Analytics | Glific → BigQuery | Auto-exported contacts, messages, flow results |
| AI services | OpenAI Assistant (asst_f3bdr643lebg4o3kbtp4t4kc) | Content matching, OESN AI generation |
| Media hosting | Google Drive / YouTube | PDFs, videos, images, audio |

### Languages

All flows support four languages based on contact's region:

| Region | Languages Delivered |
|--------|-------------------|
| Khasi Hills | English + Khasi |
| Garo Hills | English + Garo |
| Jaintia Hills | English + Pnar |
| Other / Unknown | English only |

Language pair is set at onboarding and stored in `preferred_language` contact field.  
All scheduled content is sent in both languages (or English-only if no translation available).

### Contact Fields (Common)

| Field Key | Values | Set By |
|-----------|--------|--------|
| `preferred_language` | English / Khasi / Garo / Pnar | Onboarding |
| `consent_given` | yes | Onboarding |
| `programme` | tffp / cmyc / oesn / core_team | Onboarding |
| `region` | free text district name | Onboarding |
| `onboarding_source` | keyword / qr / field_form / sheet | Onboarding |

---

## Common Onboarding Flow

**Keyword**: `onboard`  
**Also triggered by**: QR code (encodes keyword), field worker form (Apps Script initiates), sheet entry (Apps Script initiates)  
**File**: `Sauramandala_Onboarding_Flow.json`

### Entry Points

| Entry | Mechanism |
|-------|-----------|
| Type keyword | Contact sends `onboard` (case-insensitive) |
| QR code | Encodes `onboard` keyword, same trigger |
| Field worker Google Form | Apps Script → Glific API → sends first message to contact |
| Sheet entry | Field worker adds row → Apps Script → Glific initiates contact |

When initiated by field form or sheet, set `onboarding_source = field_form` or `sheet` before flow starts.

### Flow Steps

```
1. Welcome message (bilingual if region known, else English)
2. Consent: "Do you agree to receive messages from Sauramandala?" [Yes / No]
   → No: "Thank you, reply ONBOARD anytime to join." END
   → Yes: set consent_given = yes
3. Language selection (LIST: English / Khasi / Garo / Pnar)
   → set preferred_language
4. Region / District (free text)
   → set region
5. Programme selection (LIST: TFFP / CMYC / OESN / Core Team)
   → set programme
6. Role question — varies by programme (see below)
7. Programme-specific questions (see below)
8. Add to correct Glific groups
9. Confirmation message → handoff to programme flow
```

### Programme Branch: TFFP

```
Role selection (LIST):
  → Anganwadi Worker
  → Teacher
  → Parent / Caregiver

If Parent:
  → Child date of birth (DD/MM/YYYY)
  → set child_dob, calculate age_band (3-4 / 4-5 / 5-6 / 6-8)
  → set ecce_role = parent

If Anganwadi Worker:
  → set ecce_role = anganwadi_worker

If Teacher:
  → set ecce_role = teacher

All TFFP roles:
  → Add to group: TFFP — All
  → Add to role-specific group (TFFP — Parents / Practitioners / Supervisors)
  → Add to region group (TFFP — Khasi / Garo / Jaintia)
```

### Programme Branch: CMYC

```
Role selection (LIST):
  → Innovation Associate
  → Community Associate
  → Librarian
  → Sports Coach
  → Youth Member
  → Club Coordinator

If Youth Member or Club Coordinator:
  → Age (for consent gate)
  → If age < 14: parent/guardian consent step
    → Parent name + number captured, consent confirmation message sent to parent

All CMYC roles:
  → Centre or Club affiliation (search or LIST of known centres/clubs)
  → Add to group: CMYC — All
  → Add to role-specific group
  → Add to centre/club group
```

### Programme Branch: OESN

```
Role selection (LIST):
  → Field Agent (independent)
  → Field Agent (Sauramandala staff)
  → Vendor (service provider)
  → Programme Staff

If Field Agent:
  → Agent onboarding (name, area, type of entrepreneurs they work with)
  → set oesn_role = agent
  → Add to group: OESN — Agents

If Vendor:
  → Vendor registration flow (see OESN section)
  → set oesn_role = vendor
  → Add to group: OESN — Vendors

If Programme Staff:
  → set oesn_role = programme_staff
```

### Programme Branch: Core Team

```
Role selection (LIST):
  → Programme Lead
  → Field Coordinator
  → Communications
  → Tech / Data

→ set core_role
→ Add to group: Core Team — All
→ Add to role-specific group
```

---

## TFFP Flows

### Contact Fields (TFFP-specific)

| Field Key | Values | Set By |
|-----------|--------|--------|
| `ecce_role` | parent / anganwadi_worker / teacher | Onboarding |
| `child_dob` | DD/MM/YYYY | Onboarding (parents only) |
| `age_band` | 3-4 / 4-5 / 5-6 / 6-8 | Calculated from DOB, updated periodically |
| `tffp_activity_count` | integer | Incremented per activity submission |
| `tffp_last_active` | date | Updated on each interaction |
| `tffp_champion_level` | none / bronze / silver / gold | Updated by programme team |

### Groups (TFFP)

| Group | Members |
|-------|---------|
| TFFP — All | All TFFP contacts |
| TFFP — Parents | Parents/caregivers |
| TFFP — Practitioners | Anganwadi workers + teachers |
| TFFP — Supervisors | Block/cluster supervisors |
| TFFP — Khasi | Contacts from Khasi region |
| TFFP — Garo | Contacts from Garo region |
| TFFP — Jaintia | Contacts from Jaintia/Pnar region |

### Content Sheet (TFFP)

**Sheet name**: `TFFP Content Calendar`  
See `CONTENT-SCHEDULER-SPEC.md` for full column spec.

Additional columns for TFFP:

| Column | Key | Values |
|--------|-----|--------|
| N | `age_band` | all / 3-4 / 4-5 / 5-6 / 6-8 |
| O | `content_category` | story / activity / video / audio / tip / nudge |
| P | `follow_up_question` | Text of the follow-up question to ask after delivery |

**Content routing logic**:
- `age_band = all` → send to TFFP — Parents (all bands)
- `age_band = 3-4` → send only to parents whose `age_band` contact field matches
- Stories: `age_band = all`, `content_category = story`
- Activities: `age_band = specific`, `content_category = activity`

**Recommended cadence**: 2× per week  
- **Tuesday 9 AM**: Content piece (story / video / activity)  
- **Thursday 9 AM**: Follow-up question OR nudge related to Tuesday content

### Flow: TFFP — Weekly Content Delivery

**Trigger**: Apps Script daily → finds Tuesday/Thursday rows in TFFP Content Calendar → calls Glific API  
**Recipients**: Correct TFFP group filtered by `age_band` contact field

```
1. Send content message (text / image / video / document / audio)
   Caption includes: content title + brief context
2. [If follow_up_question not empty]:
   Wait — send follow-up next scheduled day (Thursday)
   "How did it go? You can send a photo, voice note, or just reply 👍"
3. Contact responds:
   → Photo / video / audio note captured → set tffp_last_active, increment tffp_activity_count
   → Simple emoji / text → same tracking
4. Bot reply: "Thank you! [Name] has shared activity #[N] 🌟"
   [If milestone reached]: trigger Certificate / Champion flow
```

### Flow: TFFP — Activity Response & Gamification

**Trigger**: When contact responds to content (photo/video/audio)

```
1. Log response (media type, timestamp, content_id) → Supabase
2. Increment tffp_activity_count
3. Check milestones:
   5 activities  → Bronze Champion message + certificate image sent
   15 activities → Silver Champion + group shoutout scheduled
   30 activities → Gold Champion + social media feature queued for team
4. If milestone:
   → Send certificate (image generated or pre-made per level)
   → Bot posts shoutout in TFFP WhatsApp group (if contact is in one)
   → Flag for team: social media feature
```

**Milestone check**: Glific webhook → Supabase → returns current count → flow router checks thresholds

### Flow: TFFP — Content Request

**Trigger**: Contact sends any message outside a flow, OR keywords like "content", "send", "last", "activity"

```
1. Bot checks for simple patterns first (no AI needed):
   "last 3" / "last week" / "send again"
     → Query last 3 content items sent to this contact → resend links
   "activities 4-5" / "stories" / keyword + age
     → Direct filter on content library sheet

2. If no pattern match:
   → Send to OpenAI assistant with:
     - Contact's role + age_band
     - Their message text
     - Content library index (title, type, age_band, URL)
   → AI returns best match → bot sends content + "Is this what you were looking for?"

3. If AI returns low confidence or "not found":
   → "Let me check with the team — we'll get back to you shortly."
   → Glific agent handoff: flag for programme coordinator
   → Coordinator manually replies or schedules content

4. Log all content requests → Supabase (request text, matched content, AI confidence, resolved by)
```

### Flow: TFFP — Age Band Update (Automated)

**Trigger**: Glific Trigger — runs monthly, checks all parent contacts

```
For each parent contact:
  → Calculate age from child_dob
  → If age_band has changed (e.g. 4-5 → 5-6):
    → Update age_band contact field
    → Send message: "Your child is growing! Content updates starting this week 🌱"
    → Move contact to correct age-filtered send list
```

### Flow: TFFP — Inactivity Nudge

**Trigger**: Glific Trigger — runs weekly, checks `tffp_last_active`

```
If tffp_last_active > 14 days ago:
  → Send nudge: "We miss you! Here's a quick activity for this week [content link]"
  → If still no response after 7 more days:
    → Flag for coordinator: "Contact [name] inactive 21+ days"
```

### Dashboard — TFFP

**Levels**: Programme team, funders  
**Data source**: BigQuery (Glific auto-export) + Supabase (activity logs)

| Metric | Source |
|--------|--------|
| Total enrolled by role/region | BigQuery contacts |
| Weekly active (responded in 7 days) | Supabase activity log |
| Activity submissions (photo/video/audio) | Supabase |
| Champion level distribution | Supabase |
| Content delivery rate (sent vs group size) | BigQuery messages |
| Inactivity flags | Computed: last_active > 14 days |
| Content request volume and resolution | Supabase request log |
| Age band distribution (parents) | BigQuery contact fields |

---

## CMYC Flows

### CMYC Structure

**Centres**: Physical spaces with assigned staff  
**Clubs**: Smaller groups, inside or outside centres, tagged to a parent centre

**Staff per centre:**
| Role | Component |
|------|-----------|
| Innovation Associate | The Nook (self-directed learning makerspace) |
| Community Associate | Community building + problem solving |
| Librarian (part-time) | Library |
| Sports Coaches | Ultimate Frisbee, Football, Chess |

**Programme components:**
Nook · Library · Ultimate Frisbee · Football · Chess · Nano Entrepreneurship · Counselling Support · Community Problem Solving · Clubs

### Contact Fields (CMYC-specific)

| Field Key | Values | Set By |
|-----------|--------|--------|
| `cmyc_role` | innovation_associate / community_associate / librarian / coach / youth / club_coordinator | Onboarding |
| `cmyc_centre` | centre ID / name | Onboarding |
| `cmyc_club` | club ID (if applicable) | Onboarding |
| `learner_id` | generated UUID | Registration flow |
| `learner_pathway_stage` | see pathway stages below | Updated by associate |
| `cmyc_last_checkin` | date | Updated on daily check-in |
| `parent_consent` | yes / pending | Onboarding (under 14) |

### Groups (CMYC)

| Group | Members |
|-------|---------|
| CMYC — All | All CMYC contacts |
| CMYC — Associates | Innovation + Community Associates |
| CMYC — Coordinators | All centre/club coordinators |
| CMYC — Youth | Youth members (9-25) |
| CMYC — [Centre Name] | Per centre (auto-created on centre registration) |
| CMYC — [Club Name] | Per club, linked to parent centre group |

### Learner Pathways

Associates guide learners through pathways — pathway stage is updated by the associate, not the learner.

**Nook Pathway:**
```
Early Projects → Exploration → Goal Setting → Projects → Exhibition
```

**Other components** (similar structure, to be defined per component by programme team):
- Library pathway
- Sports development stages
- Nano Entrepreneurship stages

### Flow: CMYC — Learner Registration

**Trigger**: Associate sends `REGISTER` or selects from associate menu  
**Who fills**: Associate (on behalf of learner, during or after conversation)

```
1. Search for existing learner (by name or number):
   → If found: show profile, offer to update
   → If not found: start new registration

2. Capture:
   → Full name
   → Phone number (theirs or guardian's)
   → Age
   → Village / area
   → Components interested in (multi-select LIST)
   → Why they're joining (brief — free text or LIST of common reasons)
   → What they wish to do (free text)

3. If age < 14:
   → Capture parent/guardian name + number
   → Send consent message to parent: "Your child [name] is joining CMYC. Reply YES to consent."
   → set parent_consent = pending until parent replies YES

4. Generate learner_id (UUID) → save to Supabase
5. Confirm: "Learner [name] registered. ID: [learner_id]"
6. Associate assigns initial pathway stage
```

### Flow: CMYC — Daily Check-In / Check-Out

**Trigger**: Morning: associates/coaches send `IN` or `CHECKIN`  
**Trigger**: Evening: `OUT` or `CHECKOUT`

**Morning Check-In:**
```
1. "Good morning! How many youth arrived today?"
   → Number input (attendance count)
2. "Which components are active today?" (LIST multi-select)
3. Set cmyc_last_checkin = today
4. Log to Supabase: centre, associate, date, component, attendance_in
```

**Evening Check-Out:**
```
1. "Evening! Any updates from today?"
   → LIST: Activities completed / Issues to flag / Nothing to add
2. If Activities:
   → "Briefly describe what happened" (free text or LIST of activity types)
   → "Any photos or media from today?" → capture media
3. If Issues:
   → Capture issue description → flag to programme backend
4. Log to Supabase: attendance_out, activities, media_urls, issues
```

**Note**: Each staff role has their own format — associates don't need to fill every field every day.

### Flow: CMYC — Learner Journey Update

**Trigger**: Associate sends `UPDATE` or selects from associate menu

```
1. Search learner by name, number, or learner_id
2. Show current profile + pathway stage
3. Options (LIST):
   → Update pathway stage
   → Add activity note
   → Update contact info
   → Flag concern / raise issue
4. If Update pathway stage:
   → Show current → next stage options
   → Confirm → save to Supabase
   → Log stage change with date
5. If Add activity note:
   → Free text or voice note
   → Optional: attach photo/media
   → Save to Supabase learner log
```

### Flow: CMYC — Monthly Report Generation

**Trigger**: Glific Trigger — last day of month OR associate sends `REPORT`

```
1. Bot queries Supabase:
   → All check-ins/check-outs for this centre this month
   → Activity logs by component
   → Learner journey updates
   → Issues flagged
   → Attendance totals per component

2. Bot compiles and sends summary to associate:
   "Here's your [Month] summary:
    Total attendance days: X
    Average daily attendance: Y
    Components active: [list]
    Learner pathway updates: Z
    Issues flagged: N
    [Link to full report in dashboard]"

3. Associate can confirm ("Looks good") or flag corrections
4. Confirmed report locked in Supabase → visible in dashboard
```

### Flow: CMYC — Club Registration & Reporting

**Trigger**: `CLUB REGISTER` keyword

```
1. Club name
2. Club type (topic/activity focus)
3. Parent centre (search by name or LIST)
4. Club coordinator name + number
5. Members: initial headcount (detail can be added later)
6. Generate club_id → save to Supabase → link to parent centre
7. Create Glific group for club → add coordinator

Club reporting: Same flows as centre (check-in, activity log, monthly report)
All club data appears under parent centre in dashboard (aggregated)
```

### Flow: CMYC — Social Media Content Creation

**Trigger**: Associate/coordinator sends photo/video + blurb, OR triggers `SOCIAL POST`

**Mode 1 — Report → Post:**
```
1. "Share a photo/video and a brief blurb about what happened"
2. Contact sends media + text
3. Bot sends to OpenAI:
   → "Generate 3 Instagram caption options and 1 WhatsApp status from this blurb: [text]"
4. Bot returns caption options (LIST to pick from)
5. Contact picks → bot formats final post
6. Also extracts structured info for activity log → saves to Supabase
7. "Share to your social media! Tag @sauramandala 🙌"
```

**Mode 2 — Post → Report:**
```
1. Contact sends their already-created social media post (text/screenshot)
2. Bot sends to OpenAI:
   → "Extract: date, activity type, number of participants, location from this post: [text]"
3. Bot shows extracted info: "Is this correct? [details]" → Yes / Edit
4. Confirmed info saved to Supabase activity log
```

### Flow: CMYC — Capacity Material Delivery

Same Google Sheet scheduler as TFFP.  
**Sheet name**: `CMYC Content Calendar`  
Target audiences: `cmyc_associates`, `cmyc_coordinators`, `cmyc_youth`

Content types sent to staff: training resources, toolkits, guides, session plans  
Content types sent to youth: learning prompts, activity ideas, inspiration

### Dashboard — CMYC

**Levels**: Centre → Block → Cluster → District → State → External (funders)

| Metric | Visible At |
|--------|-----------|
| Daily attendance (in/out) | Centre, Block, Cluster, District, State |
| Active learners this month | Centre+ |
| Learner pathway progression | Centre+ |
| Component activity frequency | Centre+ |
| Clubs active + linked to centres | Block+ |
| Issues flagged + resolved | Centre, Cluster, State |
| Social media posts generated | State, External |
| Monthly report completion rate | Block+ |
| Capacity material engagement | State |

---

## OESN / Doorstep Flows

### Overview

Three-actor CRM system:

```
Field Agent ←→ Entrepreneur ←→ Vendor
     ↓               ↓             ↓
        Programme Backend (Supabase)
              ↓
         AI Services (OpenAI)
```

### Contact Fields (OESN-specific)

**Agent:**
| Field Key | Values |
|-----------|--------|
| `oesn_role` | agent / vendor / programme_staff |
| `agent_type` | independent / staff |
| `agent_area` | free text |
| `caseload_count` | integer (updated dynamically) |

**Entrepreneur (stored in Supabase, not Glific contact fields):**
| Field | Type |
|-------|------|
| `entrepreneur_id` | UUID |
| `name` | text |
| `phone` | text |
| `business_name` | text |
| `business_type` | text |
| `location` | text |
| `agent_id` | FK to agent |
| `registered_date` | date |
| `needs` | JSONB (array of need objects by theme) |
| `journey_log` | JSONB (array of visit/action records) |

**Vendor (Supabase):**
| Field | Type |
|-------|------|
| `vendor_id` | UUID |
| `name` | text |
| `phone` | text |
| `organisation` | text |
| `type` | local / outside / government |
| `services` | array of theme codes they can fulfil |
| `location` | text |
| `registration_source` | team_added / self_registered |

### Needs Themes

14 current themes (expandable — new themes added to config without breaking existing data):

| Code | Theme | AI Output Possible |
|------|-------|-------------------|
| `bookkeeping` | Bookkeeping | Account summaries, templates |
| `logo` | Logo Design | Logo generation (DALL-E / other) |
| `label` | Label Design | Label generation |
| `solar` | Solar System Design | System sizing + design |
| `machinery` | Machinery | Sourcing advisory |
| `built_env` | Built Environment | Architectural design matching |
| `food_testing` | Food Testing | Lab referral matching |
| `packaging` | Packaging & Procurement | Vendor matching |
| `govt_schemes` | Govt Scheme Matching | Eligibility matching |
| `training` | Training & Capacity | Training programme matching |
| `loan` | Loan Connect | Document preparation support |
| `food_recipe` | Food Recipe Standardisation | Recipe documentation |
| `social_media` | Social Media Content | Caption/post generation |
| `catalogue` | Catalogue Creation | Product catalogue generation |

### Groups (OESN)

| Group | Members |
|-------|---------|
| OESN — Agents | All field agents |
| OESN — Vendors | All vendors |
| OESN — Programme | Programme staff |

### Flow: OESN — Agent Menu (Main)

**Trigger**: Agent sends any message when not in a flow

```
Main menu (LIST):
  1. Find / update entrepreneur
  2. Register new entrepreneur
  3. Log a visit
  4. View my tasks
  5. Register a vendor
  6. Programme updates
```

### Flow: OESN — Entrepreneur Registration

**Trigger**: Agent selects "Register new entrepreneur"

```
1. Search first (by name or number):
   → If found: show profile → offer update → go to Update flow
   → If not found: continue registration

2. Basic profile (dropdowns where possible):
   → Full name (free text)
   → Phone number
   → Location / village (free text)
   → Business name (free text)
   → Business type (LIST: food/craft/agri/service/retail/other)
   → Years in business (LIST: <1 / 1-3 / 3-5 / 5+)
   → Number of employees (LIST: just me / 2-5 / 6-10 / 10+)

3. Save to Supabase → generate entrepreneur_id
4. Confirm: "Registered! ID: [id]. Add needs now or later?"
   → Now: go to Needs Assessment flow
   → Later: return to main menu
```

### Flow: OESN — Needs Assessment (Partial Fill + Resume)

**Trigger**: From registration, OR agent selects entrepreneur → "Add/update needs"  
**Key feature**: Partial save at any point — agent can exit and resume later

```
1. Show current needs already captured (if any)
2. "Which theme would you like to work on?" (LIST of 14 themes)
3. Agent picks theme → theme-specific questions shown
4. Each question:
   → Dropdown where possible (income range, land size, etc.)
   → Free text only when no dropdown applies
   → "Save and continue" or "Save and exit" option at each step
5. On exit: all filled fields saved to Supabase immediately
6. On resume: pre-fill already-answered fields, highlight unanswered ones

[Theme-specific question sets — defined in separate YAML per theme]
[Common across all themes: what is the main challenge, what support is needed urgently]
```

**Partial fill state**: saved as `needs.{theme}.draft` in Supabase JSONB → promoted to `needs.{theme}.complete` when agent confirms done.

### Flow: OESN — Entrepreneur Search & Update

**Trigger**: Agent selects "Find / update entrepreneur"

```
1. "Search by name, number, or ID"
   → Text input → Supabase search → returns top 3 matches
   → Agent picks correct one
2. Show profile summary:
   Name, business, location, agent, registered date, needs themes captured
3. Options (LIST):
   → Update basic info
   → Add / update needs (go to Needs Assessment)
   → Log a visit
   → View journey log
   → Match to vendor
   → View tasks
```

### Flow: OESN — Visit Log

**Trigger**: Agent selects "Log a visit" → picks entrepreneur

```
1. Date of visit (default: today)
2. Visit type (LIST: first visit / follow-up / delivery / phone check-in)
3. What was discussed? (LIST: needs update / vendor intro / support delivered / other)
4. Any media to attach? (photo of business, product, site)
5. Next step agreed (free text or LIST)
6. Next follow-up date
7. Save to Supabase journey_log
```

### Flow: OESN — Vendor Matching

**Trigger**: Agent selects "Match to vendor" for an entrepreneur → picks need theme

```
1. Show theme needs summary for this entrepreneur
2. Query Supabase: vendors where services includes this theme
3. Return top matches (ranked by: location proximity, service match score)
4. Agent sees list: vendor name, type, location, services
5. Agent picks vendor → action options:
   → Connect now: bot sends message to vendor with entrepreneur intro
   → Note for follow-up: save to task list
   → Skip / not suitable

6. Task created in Supabase:
   → entrepreneur_id, vendor_id, theme, action, status = pending
   → Assigned to: agent
   → Due date (optional)
```

### Flow: OESN — Task Management (Agent)

**Trigger**: Agent selects "View my tasks"

```
Show (LIST): 
  → Pending tasks (sorted by due date)
  → Completed this week
  → Overdue

On each task:
  → View details
  → Update status (LIST: in progress / completed / blocked / cancelled)
  → Add note
  → Reassign (programme staff only)

Bot sends daily task summary at 8 AM:
  "Good morning [name]. You have [N] pending tasks today. [List top 3]"
```

### Flow: OESN — Vendor Onboarding (Self-Registration)

**Trigger**: Vendor sends `VENDOR REGISTER` or is referred by agent

```
1. Welcome + explain platform
2. Organisation / business name
3. Contact name
4. Location
5. Vendor type (LIST: local individual / local business / outside organisation / government)
6. Services offered (multi-select LIST of 14 themes)
7. Brief description of services (free text)
8. How did you hear about us? (LIST)
9. Save to Supabase → generate vendor_id → status = pending_review
10. "Thank you! Our team will review and activate your profile within 2 days."
11. Flag for programme staff to review + activate
```

### Flow: OESN — Vendor Task Notification

**Trigger**: When an agent connects a vendor to an entrepreneur need

```
Vendor receives:
  "Hello [vendor name]! A field agent has a potential opportunity for you.
   Business: [entrepreneur business name]
   Location: [location]
   Need: [theme description]
   Contact: [agent name + number]
   
   Reply:
   1. Interested — I'll follow up
   2. Not available right now
   3. Need more info"

Vendor response updates task status in Supabase.
```

### Flow: OESN — Payment Logging

**Trigger**: Agent or vendor selects "Log payment" on a completed task

```
1. Select task (from task list)
2. Payment type (LIST: direct (entrepreneur pays vendor) / part subsidy / full subsidy)
3. Amount (number input)
4. Date of payment
5. Paid by (LIST: entrepreneur / Sauramandala / third party)
6. Receipt / proof (optional photo)
7. Save to Supabase payments table
8. Update task status = payment_logged
```

### Flow: OESN — AI Service Generation

**Trigger**: Programme staff or agent triggers from entrepreneur profile  
**Requires**: Relevant need theme data to be captured first

```
For each AI service, send structured data to OpenAI assistant:

Logo / Label:
  → Business name, sector, colours preference, style notes
  → Returns: 3 logo/label concepts as images

Solar System Design:
  → Location, roof size, usage hours, appliances list, budget
  → Returns: recommended system size, panel count, estimated cost range

Govt Scheme Matching:
  → Business type, owner profile, state, existing certifications
  → Returns: list of eligible schemes with links and requirements

Loan Document Preparation:
  → Business details, loan amount needed, assets, income details
  → Returns: draft application text, checklist of required documents

Food Recipe Standardisation:
  → Recipe name, ingredients, current process, intended scale
  → Returns: standardised recipe document with quantities and steps

Social Media Content:
  → Business name, product/service, key message, language
  → Returns: 5 caption options + hashtag set

Catalogue Creation:
  → Product list with descriptions and prices
  → Returns: formatted catalogue text ready for design
```

### Dashboard — OESN

| Metric | Level |
|--------|-------|
| Entrepreneurs registered (by agent, area, sector) | Programme |
| Needs captured by theme | Programme |
| Vendor match rate (needs matched vs total) | Programme |
| Task completion rate | Programme |
| Agent caseload and activity | Programme |
| Payment volume by type | Programme |
| AI service usage (what was generated) | Programme |
| Vendor directory (by type, service, location) | Programme |

---

## Content Scheduler

See `CONTENT-SCHEDULER-SPEC.md` for full technical spec.

### Per-Programme Sheets

| Programme | Sheet Name | Target Audiences |
|-----------|-----------|-----------------|
| TFFP | TFFP Content Calendar | tffp_parents, tffp_practitioners, tffp_supervisors, tffp_all |
| CMYC | CMYC Content Calendar | cmyc_associates, cmyc_coordinators, cmyc_youth, cmyc_all |
| OESN | OESN Content Calendar | oesn_agents, oesn_vendors |

One Apps Script serves all three sheets — reads `programme` column to route correctly.

### Content Opt-Out / Opt-In

All contacts can:
- Send `STOP CONTENT` → removed from content groups (not from programme)
- Send `START CONTENT` → re-added based on their programme + role contact fields

---

## Cross-Programme Systems

### Common: Inactivity Nudge

Runs across TFFP, CMYC — checks `last_active` contact field:
- 14 days inactive → automated nudge
- 21 days inactive → flag to coordinator

### Common: Group Champion Bot

Bot sits in WhatsApp groups (added manually by team):
- Sends scheduled content to the group
- Responds to `CONTENT [query]` in group with relevant content
- Posts champion shoutouts when milestone triggers
- Does NOT respond to general conversation (ignore anything not matching keywords)

### Common: Field Worker Form → Glific

Google Form used by field workers to:
- Add new contacts (TFFP/CMYC/OESN)
- Apps Script watches form responses → calls Glific API → initiates onboarding flow

Single Apps Script handles all three programmes based on `programme` column in form.

### Common: OpenAI Assistant Integration

**Assistant ID**: `asst_f3bdr643lebg4o3kbtp4t4kc`  
**Connected via**: Glific → Settings → Integrations → OpenAI

Used for:
- TFFP content request matching (natural language → content library lookup)
- CMYC social media caption generation
- OESN needs → AI service generation (logo, solar, schemes, loan docs, etc.)

Glific webhook calls assistant with structured prompt → returns response → flow continues.

---

## Flow Index

### Common Flows

| Flow Name | Keyword | Purpose |
|-----------|---------|---------|
| Common Onboarding | `onboard` | All programmes, role-based branching |
| Content Opt-Out | `stop content` | Remove from content delivery groups |
| Content Opt-In | `start content` | Re-add to content delivery groups |

### TFFP Flows

| Flow Name | Trigger | Purpose |
|-----------|---------|---------|
| TFFP Weekly Content Delivery | Apps Script (scheduled) | Send content to groups |
| TFFP Activity Response | Incoming media | Log engagement, check milestones |
| TFFP Gamification / Champion | Milestone reached | Certificate + shoutout |
| TFFP Content Request | Keyword / any message | AI-matched content retrieval |
| TFFP Age Band Update | Monthly trigger | Recalculate + update age bands |
| TFFP Inactivity Nudge | Weekly trigger | Re-engage inactive contacts |

### CMYC Flows

| Flow Name | Trigger | Purpose |
|-----------|---------|---------|
| CMYC Learner Registration | `REGISTER` | Add new youth member |
| CMYC Learner Journey Update | `UPDATE` | Update pathway stage, notes |
| CMYC Daily Check-In | `IN` / `CHECKIN` | Morning attendance |
| CMYC Daily Check-Out | `OUT` / `CHECKOUT` | Evening attendance + activity log |
| CMYC Monthly Report | Trigger / `REPORT` | Auto-compile monthly summary |
| CMYC Club Registration | `CLUB REGISTER` | Register new club, link to centre |
| CMYC Social Media Content | `SOCIAL POST` / media + blurb | Caption generation / info extraction |
| CMYC Capacity Content Delivery | Apps Script (scheduled) | Send learning materials to staff/youth |
| CMYC Inactivity Nudge | Weekly trigger | Re-engage inactive staff/youth |

### OESN Flows

| Flow Name | Trigger | Purpose |
|-----------|---------|---------|
| OESN Agent Menu | Any agent message | Navigation hub for agents |
| OESN Entrepreneur Registration | From menu | Onboard new entrepreneur |
| OESN Needs Assessment | From menu / registration | Capture needs by theme (partial fill) |
| OESN Entrepreneur Search & Update | From menu | Find and update entrepreneur |
| OESN Visit Log | From menu | Log field visit |
| OESN Vendor Matching | From menu | Match need to vendor |
| OESN Task Management | From menu | View and update tasks |
| OESN Vendor Self-Registration | `VENDOR REGISTER` | Vendor joins platform |
| OESN Vendor Task Notification | Automated | Notify vendor of match |
| OESN Payment Logging | From task | Record payment |
| OESN AI Service Generation | From entrepreneur profile | Trigger AI outputs |
| OESN Agent Daily Summary | 8 AM trigger | Task briefing for agent |

**Total flows: 25**  
All implemented as YAML → deploy.py → Glific GraphQL (importFlow mutation).
