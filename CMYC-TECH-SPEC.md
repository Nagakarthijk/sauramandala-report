# CMYC Technical Specification — Developer Build Guide

**Program:** Community Managed Youth Centres (CMYC)  
**Scale:** 50+ centres · 5000+ learners · Mixed age groups  
**Current state:** Spreadsheets + WhatsApp  
**Status:** Draft for developer handoff

---

## 1. What CMYC Is

CMYC runs multi-component youth and community development centres. Each centre offers some or all of the following program components:

| Component | What it is |
|---|---|
| **The Nook** | Self-directed learning makerspace — maker projects, creative exploration, hands-on learning |
| **Library** | Reading space with book lending, reading programs, literacy support |
| **Sports** | 3–4 sports disciplines per centre (varies by centre and season) |
| **Mental Health Counselling** | Individual and group counselling sessions |
| **Career Counselling** | Individual career planning, assessments, opportunity linkage |

A learner may participate in one or several components. Each component has its own registration, plans, sessions, attendance, and expense line. A centre manager oversees all components at their centre. Programme managers oversee all centres.

**The system must manage:**
- Learner discovery and enrolment across components
- Individual learner plans + centre-level plans
- Session planning, attendance, and activity tracking per component
- Expense management from budget allocation to claim approval
- Community mobilisation events and outreach
- Issue tracking with escalation
- Automated report generation (weekly, monthly, annual)
- MIS — aggregated metrics across centres and components
- Public dashboard — selected metrics visible without login

---

## 2. Roles and Access

| Role | What they can do |
|---|---|
| **Programme Admin** | Full access: all centres, all components, all learners, budgets, reports, user management |
| **Programme Manager** | All centres read-only; approve expenses; view all MIS; generate reports |
| **Centre Manager** | Their centre only: all components, all learners, expenses, plans, issue raising |
| **Component Facilitator** | Their component only: session planning, attendance, learner plans, notes |
| **Counsellor** | Mental health component: session notes (private), referrals, crisis flags — cannot be seen by other roles |
| **Career Counsellor** | Career component: individual plans, assessments, opportunity tracking |
| **Community Mobiliser** | Outreach events, community registrations, mobilisation reports |
| **Finance Officer** | Expense management: review, approve, report across centres |
| **Public** | Public dashboard only — no login required |

---

## 3. Data Model

### 3.1 Core Entities

#### `centres`
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
location_village    TEXT
location_block      TEXT
location_district   TEXT
location_state      TEXT
centre_type         TEXT              -- 'urban' | 'rural' | 'semi_urban'
active_components   TEXT[]            -- ['nook', 'library', 'sports', 'mental_health', 'career']
manager_id          UUID REFERENCES users(id)
established_date    DATE
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `users` (staff and facilitators)
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
phone               TEXT UNIQUE
email               TEXT UNIQUE
role                TEXT NOT NULL     -- see §2 roles
centre_id           UUID REFERENCES centres(id)  -- null for programme-level roles
component           TEXT              -- null unless role is component-specific
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `learners`
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
dob                 DATE
gender              TEXT              -- 'male' | 'female' | 'other' | 'prefer_not_to_say'
age_group           TEXT              -- auto-derived: 'child' | 'adolescent' | 'youth' | 'adult'
phone               TEXT              -- learner's own phone if applicable
guardian_name       TEXT
guardian_phone      TEXT
address_village     TEXT
address_block       TEXT
address_district    TEXT
primary_centre_id   UUID REFERENCES centres(id)
enrollment_date     DATE NOT NULL
active              BOOLEAN DEFAULT true
photo_url           TEXT
notes               TEXT              -- general notes (visible to centre manager+)
created_by          UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `component_enrollments`
One row per learner per component. A learner can be enrolled in multiple components.

```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
centre_id           UUID REFERENCES centres(id)
component           TEXT NOT NULL     -- 'nook' | 'library' | 'sports' | 'mental_health' | 'career'
sport_type          TEXT              -- if component = 'sports': 'football' | 'volleyball' etc
enrollment_date     DATE NOT NULL
status              TEXT DEFAULT 'active'  -- 'active' | 'paused' | 'completed' | 'dropped'
exit_date           DATE
exit_reason         TEXT
enrolled_by         UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `individual_plans`
One plan per learner per component. Reviewed and updated periodically.

```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
component           TEXT NOT NULL
centre_id           UUID REFERENCES centres(id)
plan_period_start   DATE NOT NULL
plan_period_end     DATE NOT NULL
goals               JSONB             -- [{goal, target_date, status}]
current_status      TEXT              -- 'on_track' | 'needs_support' | 'at_risk' | 'achieved'
notes               TEXT
created_by          UUID REFERENCES users(id)
reviewed_by         UUID REFERENCES users(id)
reviewed_at         TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

**Privacy rule:** Mental health component plans are readable only by the counsellor and Programme Admin. No other role can access them, including the Centre Manager.

#### `centre_plans`
Monthly or quarterly plan at the centre level — aggregate of component plans plus community activities and targets.

```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
period_start        DATE NOT NULL
period_end          DATE NOT NULL
period_type         TEXT              -- 'monthly' | 'quarterly'
components_planned  JSONB             -- per component: target sessions, target attendance, target learners
community_targets   JSONB             -- outreach events, new registrations targets
budget_allocated    NUMERIC
created_by          UUID REFERENCES users(id)
approved_by         UUID REFERENCES users(id)
status              TEXT DEFAULT 'draft'  -- 'draft' | 'approved' | 'active' | 'closed'
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `sessions`
A planned or completed activity session for any component.

```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
component           TEXT NOT NULL
sport_type          TEXT              -- if sports component
session_type        TEXT              -- 'regular' | 'workshop' | 'event' | 'assessment' | 'group_counselling'
title               TEXT
planned_date        DATE NOT NULL
planned_start_time  TIME
planned_end_time    TIME
actual_date         DATE
actual_start_time   TIME
actual_end_time     TIME
facilitator_id      UUID REFERENCES users(id)
venue               TEXT
session_plan        TEXT              -- what was planned
session_notes       TEXT              -- what actually happened (visible to facilitator + manager)
status              TEXT DEFAULT 'planned'  -- 'planned' | 'completed' | 'cancelled' | 'postponed'
cancellation_reason TEXT
created_by          UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `attendance`
One row per learner per session.

```sql
id                  UUID PRIMARY KEY
session_id          UUID REFERENCES sessions(id)
learner_id          UUID REFERENCES learners(id)
status              TEXT NOT NULL     -- 'present' | 'absent' | 'late' | 'excused'
marked_by           UUID REFERENCES users(id)
marked_at           TIMESTAMPTZ DEFAULT now()
notes               TEXT
```

**WhatsApp integration:** Attendance summary for each session is automatically sent to the Centre Manager via WhatsApp after marking is complete (see §9).

#### `counselling_sessions` (mental health — private)
Separate table with strict access control. Not joined or visible in any general query.

```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
counsellor_id       UUID REFERENCES users(id)
centre_id           UUID REFERENCES centres(id)
session_date        DATE NOT NULL
session_type        TEXT              -- 'individual' | 'group'
session_number      INTEGER           -- session N in a sequence
goals_this_session  TEXT
observations        TEXT              -- PRIVATE: counsellor + admin only
action_plan         TEXT              -- PRIVATE
risk_level          TEXT              -- 'none' | 'low' | 'medium' | 'high' | 'crisis'
referral_needed     BOOLEAN DEFAULT false
referral_destination TEXT
follow_up_date      DATE
created_at          TIMESTAMPTZ DEFAULT now()
```

**Privacy rule:** `risk_level = 'crisis'` triggers an immediate alert to the Programme Admin only — not to centre manager or any other role.

#### `career_plans`
```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
counsellor_id       UUID REFERENCES users(id)
centre_id           UUID REFERENCES centres(id)
aspirations         TEXT
assessment_summary  TEXT
strengths           TEXT
development_areas   TEXT
short_term_goals    JSONB             -- [{goal, timeline, status}]
long_term_goals     JSONB
opportunities_linked JSONB            -- [{type: 'job'|'college'|'scholarship'|'training', name, status}]
last_reviewed       DATE
next_review_date    DATE
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `library_records`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
book_title          TEXT NOT NULL
author              TEXT
isbn                TEXT
genre               TEXT
language            TEXT
total_copies        INTEGER DEFAULT 1
available_copies    INTEGER DEFAULT 1
added_at            DATE
active              BOOLEAN DEFAULT true
```

#### `library_borrowings`
```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
book_id             UUID REFERENCES library_records(id)
centre_id           UUID REFERENCES centres(id)
borrowed_date       DATE NOT NULL
due_date            DATE NOT NULL
returned_date       DATE
condition_on_return TEXT
issued_by           UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `nook_projects`
```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
centre_id           UUID REFERENCES centres(id)
facilitator_id      UUID REFERENCES users(id)
title               TEXT NOT NULL
description         TEXT
start_date          DATE
completion_date     DATE
status              TEXT DEFAULT 'in_progress'  -- 'idea' | 'in_progress' | 'completed' | 'paused'
materials_used      TEXT
outcome_description TEXT
photos_urls         TEXT[]
skills_demonstrated TEXT[]
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `sports_registrations`
```sql
id                  UUID PRIMARY KEY
learner_id          UUID REFERENCES learners(id)
centre_id           UUID REFERENCES centres(id)
sport_type          TEXT NOT NULL
team_name           TEXT
position_role       TEXT
registration_date   DATE NOT NULL
active              BOOLEAN DEFAULT true
```

#### `sports_events`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
sport_type          TEXT NOT NULL
event_type          TEXT              -- 'practice' | 'match' | 'tournament' | 'inter_centre'
title               TEXT
date                DATE NOT NULL
opponent_centre_id  UUID REFERENCES centres(id)  -- for inter-centre matches
result              TEXT
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `expenses`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
component           TEXT              -- null if centre-level expense
expense_type        TEXT              -- 'materials' | 'transport' | 'facilitator_fee' | 'event' | 'equipment' | 'other'
description         TEXT NOT NULL
amount              NUMERIC NOT NULL
currency            TEXT DEFAULT 'INR'
expense_date        DATE NOT NULL
receipt_url         TEXT              -- S3 URL for receipt photo
submitted_by        UUID REFERENCES users(id)
approved_by         UUID REFERENCES users(id)
status              TEXT DEFAULT 'submitted'  -- 'submitted' | 'approved' | 'rejected' | 'paid'
rejection_reason    TEXT
payment_date        DATE
payment_reference   TEXT
budget_line_id      UUID REFERENCES budget_lines(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `budget_lines`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
component           TEXT
financial_year      TEXT              -- e.g. '2025-26'
period              TEXT              -- 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'annual'
allocated_amount    NUMERIC NOT NULL
spent_amount        NUMERIC DEFAULT 0  -- auto-updated on expense approval
description         TEXT
created_by          UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `community_mobilisation`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
mobiliser_id        UUID REFERENCES users(id)
event_type          TEXT              -- 'community_meeting' | 'outreach_visit' | 'awareness_camp' | 'parent_meeting' | 'enrolment_drive'
title               TEXT NOT NULL
date                DATE NOT NULL
location            TEXT
target_audience     TEXT
participants_count  INTEGER
new_registrations   INTEGER DEFAULT 0
notes               TEXT
outcome             TEXT
photos_urls         TEXT[]
created_at          TIMESTAMPTZ DEFAULT now()
```

#### `issues`
```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)
raised_by           UUID REFERENCES users(id)
component           TEXT              -- null if centre-level issue
category            TEXT              -- 'infrastructure' | 'staff' | 'learner_welfare' | 'financial' | 'safety' | 'program_quality' | 'community' | 'other'
title               TEXT NOT NULL
description         TEXT NOT NULL
severity            TEXT              -- 'low' | 'medium' | 'high' | 'critical'
status              TEXT DEFAULT 'open'  -- 'open' | 'in_progress' | 'resolved' | 'escalated'
assigned_to         UUID REFERENCES users(id)
resolution_notes    TEXT
resolved_at         TIMESTAMPTZ
escalated_to        TEXT              -- 'programme_manager' | 'admin' | 'external'
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `reports`
Generated report artifacts — stored for access and sharing.

```sql
id                  UUID PRIMARY KEY
centre_id           UUID REFERENCES centres(id)  -- null for programme-level reports
report_type         TEXT              -- 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'component' | 'mis_snapshot'
component           TEXT              -- null if cross-component
period_start        DATE
period_end          DATE
generated_by        UUID REFERENCES users(id)
generated_at        TIMESTAMPTZ DEFAULT now()
file_url            TEXT              -- S3 URL for PDF
data_snapshot       JSONB             -- raw metrics at time of generation
shared_via          TEXT[]            -- ['whatsapp', 'email', 'dashboard']
```

---

## 4. System Components (Applications to Build)

### 4.1 Component Map

```
┌────────────────────────────────────────────────────────────────┐
│                        CMYC PLATFORM                           │
│                                                                │
│  ┌──────────────────┐   ┌──────────────────┐                  │
│  │  Centre App       │   │  Programme MIS   │                  │
│  │  (mobile-first)   │   │  (web dashboard) │                  │
│  │                   │   │                  │                  │
│  │  Attendance       │   │  Cross-centre    │                  │
│  │  Session plans    │   │  analytics       │                  │
│  │  Learner profiles │   │  Budget overview │                  │
│  │  Expense claims   │   │  Report gen      │                  │
│  │  Issue raising    │   │  Issue tracking  │                  │
│  │  Nook / Library   │   │  Public export   │                  │
│  └──────────────────┘   └──────────────────┘                  │
│                                                                │
│  ┌──────────────────┐   ┌──────────────────┐                  │
│  │  Counsellor App  │   │  Public Dashboard │                  │
│  │  (private)       │   │  (no login)       │                  │
│  │                  │   │                   │                  │
│  │  Session notes   │   │  Centre map       │                  │
│  │  Crisis flags    │   │  Learner counts   │                  │
│  │  Career plans    │   │  Activity stats   │                  │
│  │  Referrals       │   │  Impact numbers   │                  │
│  └──────────────────┘   └──────────────────┘                  │
│                                                                │
│               BACKEND API + PostgreSQL + S3                    │
│               WhatsApp Layer (Glific + Gupshup)                │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Centre App — Feature Specification

Mobile-first web app (PWA). Used by centre managers and component facilitators daily in the field.

### 5.1 Home Screen — Centre Manager View

```
[Centre name · Date · Weather optional]

TODAY  ─────────────────────────────────────────
  Sessions planned: 4   Completed: 2   Pending: 2
  Attendance marked: 2 of 4 sessions

ALERTS  ────────────────────────────────────────
  ⚠ Library: 3 books overdue > 14 days
  ⚠ Nook: Budget 85% used this quarter
  🔴 Issue: Roof leak — Hall B [Open 3 days]

QUICK ACTIONS  ──────────────────────────────────
  [Mark Attendance]  [New Session]  [Add Learner]
  [Raise Issue]      [Claim Expense]
```

### 5.2 Learner Management

#### Discover & Register New Learner

Registration is triggered by community mobilisation outreach or walk-in.

```
Step 1: Basic details
  Name · Date of birth · Gender
  Guardian name + phone
  Village / Block / District

Step 2: Component interest
  Which programs are they interested in?
  [Nook] [Library] [Football] [Volleyball] [Basketball] [Athletics]
  [Mental Health Support] [Career Counselling]
  
Step 3: Enrolment
  Enrol immediately in selected components
  → Creates individual enrollment records
  → Prompts to create initial individual plan for each component

Step 4: Photo (optional)
  Camera capture for learner profile
```

#### Learner Profile

Accessible by facilitators for their component only. Full view for centre manager.

**Tabs:**
- **Overview:** Photo, age, contact, enrolled components, enrollment dates
- **Plans:** Individual plan per component — goals, status, last review date
- **Attendance:** Attendance heatmap by component, percentage per period
- **Activity:** Sessions attended, Nook projects, books borrowed, sports events
- **Notes:** General notes (centre manager + above only)
- **Career Plan:** Career counsellor only — goals, assessments, opportunities
- **Issues:** Issues raised about or by this learner (manager only)

### 5.3 Attendance Management

#### Mark Session Attendance

```
Select session → Learner list auto-loads (enrolled in this component)

[Priya Khongwir]     ● Present  ○ Absent  ○ Late  ○ Excused
[Romen Marak]        ● Present  ○ Absent  ○ Late  ○ Excused
[Banri Kharpran]     ○ Present  ● Absent  ○ Late  ○ Excused
...

[Save Attendance]
→ Summary: 18 present, 3 absent, 1 late
→ WhatsApp message auto-sent to centre manager
→ Absentees: option to send WhatsApp to guardian (via Glific)
```

#### Attendance Reports

- Per learner: attendance % by component by month
- Per session: who was present / absent
- Per component: weekly and monthly attendance trends
- At-risk learner flag: attendance < 60% in any component over 4 weeks

### 5.4 Session Planning

#### Create Session

```
Component: [Nook / Library / Football / Volleyball / Basketball / Athletics / Career / Mental Health]
Session type: [Regular / Workshop / Assessment / Event / Group counselling]
Date + Start time + End time
Facilitator: [auto-filled or select]
Venue: [text]
Session plan: [text — what is planned for this session]

[Save as draft]  [Publish — visible to learners]
```

#### Centre-Level Plan View

Calendar view of all sessions across all components for the month. Colour-coded by component. Centre manager can see gaps and overlaps.

### 5.5 The Nook — Makerspace

**Session management:** Standard session flow (same as §5.4) with additional field: materials used.

**Project tracking:**

```
[New Project]

Learner: [search]
Project title: ___
Description: ___
Skills this project develops: [tags]
Materials needed: ___
Start date: ___

→ Project created, linked to learner
→ Facilitator updates status across visits
→ Photos uploaded on completion
→ Project visible in learner's activity tab
```

**Materials inventory:**
```
Item: ___   Quantity in stock: ___   Unit: ___
[Low stock alert when below threshold]
```

### 5.6 Library

**Catalogue management:**
- Add/edit books with title, author, genre, language, copies
- Mark books as damaged / lost

**Borrowing:**
```
Learner: [search by name]
Book: [search by title or scan if barcode available]
Due date: [auto: 14 days]
[Issue book] → Available copies decremented

[Return] → Condition noted → Available copies incremented
```

**Overdue tracking:**
- Dashboard shows all overdue books at the centre
- WhatsApp reminder sent to guardian at 7 days overdue

**Reading records:**
- Learner's borrowing history visible on their profile
- Books read count per learner per term

### 5.7 Sports

**Component registrations:**
Each sport is a separate sub-component. Learners register per sport.

**Session/Training plans:**
Same session structure as §5.4 with additional fields: drill description, fitness targets.

**Match and tournament tracking:**
```
Event type: [Practice / Match / Tournament / Inter-centre]
Sport: ___
Date + Venue
Opponent centre: [if inter-centre]
Result: ___   Score: ___
Notes: ___
```

**Performance notes (per learner, per sport):**
Facilitator can add periodic notes on learner progress — not a formal plan, just field observations.

### 5.8 Expense Management

#### Submit Expense Claim

```
Component: [Nook / Library / Sports / General]
Expense type: [Materials / Transport / Facilitator fee / Event / Equipment / Other]
Description: ___
Amount: ₹___
Date: ___
Receipt: [Photo upload]
Budget line: [auto-suggested from component + period]

[Submit for approval]
→ Finance officer + Programme Manager notified
→ Status: Submitted
```

#### Approval Flow

Finance officer sees all submitted claims:
```
[Priya — Nook materials — ₹450 — 18 Jun]  [Approve] [Reject]
[Romen — Transport — ₹120 — 17 Jun]        [Approve] [Reject]
```

On approval:
- Budget line `spent_amount` auto-updated
- Submitter notified via WhatsApp
- Status: Approved → Paid (when payment reference added)

On rejection:
- Reason required
- Submitter notified

#### Budget Tracking View

```
Centre: Ri Bhoi    Q2 FY 2025-26

NOOK         Allocated: ₹8,000   Spent: ₹6,800   Remaining: ₹1,200  ████████░░ 85%
LIBRARY      Allocated: ₹3,000   Spent: ₹1,200   Remaining: ₹1,800  ████░░░░░░ 40%
SPORTS       Allocated: ₹5,000   Spent: ₹2,100   Remaining: ₹2,900  ████░░░░░░ 42%
GENERAL      Allocated: ₹4,000   Spent: ₹1,500   Remaining: ₹2,500  ████░░░░░░ 38%

TOTAL        Allocated: ₹20,000  Spent: ₹11,600  Remaining: ₹8,400  ██████░░░░ 58%
```

### 5.9 Community Mobilisation

#### Log Mobilisation Activity

```
Event type: [Community meeting / Outreach visit / Awareness camp / Parent meeting / Enrolment drive]
Title: ___
Date: ___
Location: ___
Target audience: ___
Participants: ___ (count)
New registrations from this event: ___ (count)
Outcome: ___
Photos: [Upload]
Notes: ___
```

All mobilisation events visible on the centre's activity timeline and roll up to the MIS.

### 5.10 Issue Tracking

#### Raise an Issue

```
Category: [Infrastructure / Staff / Learner welfare / Financial / Safety / Program quality / Community / Other]
Title: ___
Description: ___
Severity: [Low / Medium / High / Critical]
Photos: [optional]

[Submit]
```

**Routing:**
- Low/Medium → Centre manager receives, handles, resolves
- High → Programme manager notified immediately
- Critical → Programme admin notified + WhatsApp alert immediately

**Tracking:**
- Issues list with status badges
- Overdue open issues (>7 days unresolved) auto-escalated
- Resolution notes required to close

---

## 6. Counsellor Application

Separate app view (or separate login context) with strict privacy isolation.

### Mental Health Counsellor

**Learner list:** Only learners enrolled in mental health component at the counsellor's centre.

**Session record:**
```
Learner: [select]
Session number: [auto-incremented]
Date: ___
Session type: [Individual / Group]
Goals for this session: ___
Observations: ___ [PRIVATE — counsellor + admin only]
Action plan: ___ [PRIVATE]
Risk level: [None / Low / Medium / High / Crisis]
Referral needed: [Yes / No]
  If yes: Referral destination: ___
Follow-up date: ___
```

**Crisis protocol:**
- `risk_level = 'Crisis'` triggers immediate WhatsApp alert to Programme Admin (not centre manager)
- Issue auto-created with severity Critical, routed to admin only
- Counsellor prompted with crisis response checklist

**What counsellor cannot see:** Session notes of other counsellors, any other component data.

**What others cannot see:** Counselling session notes at all — not centre manager, not programme manager, not MIS. Only session counts (anonymised) feed into reports.

### Career Counsellor

**Career plan management:** Full access to career plans for their learners.

**Opportunity tracking:**
```
Opportunity type: [Job / College / Scholarship / Vocational training / Government scheme]
Name: ___
Description: ___
Deadline: ___
Linked learners: [multi-select]
Status: [Identified / Applied / Shortlisted / Secured / Unsuccessful]
```

Linked opportunities visible on each learner's career plan and on a counsellor-level pipeline view.

---

## 7. Programme MIS Dashboard

Web app for programme managers and admins. Cross-centre analytics.

### 7.1 Overview Dashboard

```
PROGRAMME SUMMARY  ──────────────────────────────────────────
  Active centres: 52    Total learners: 5,847    This month enrolled: 143

ATTENDANCE (this month)  ────────────────────────────────────
  Nook: 74%    Library: 68%    Sports: 81%    [Mental health: private]

COMPONENT REACH  ─────────────────────────────────────────────
  Nook: 2,104 learners    Library: 3,211    Sports: 1,847
  Career counselling: 412  Mental health: [count only, no names]

BUDGET STATUS  ───────────────────────────────────────────────
  Total allocated: ₹24,80,000    Spent: ₹14,12,000    Utilisation: 57%
  Centres with <20% budget remaining: 3  [View]

OPEN ISSUES  ─────────────────────────────────────────────────
  Critical: 0    High: 4    Medium: 12    [View all]

NEW THIS WEEK  ───────────────────────────────────────────────
  Learners registered: 38    Sessions run: 214    Expenses approved: ₹42,000
```

### 7.2 Centre-by-Centre View

Sortable table:

| Centre | Learners | Attendance% | Sessions/wk | Budget Used% | Open Issues |
|---|---|---|---|---|---|
| Ri Bhoi | 143 | 76% | 18 | 58% | 2 |
| Shillong East | 98 | 81% | 12 | 43% | 0 |
| ... | | | | | |

Click any centre → drill into that centre's full data.

### 7.3 Learner Analytics

- Age group distribution across centres
- Gender breakdown
- Multi-component participation: how many learners attend 2, 3, 4+ components
- Retention: learners active at month 3, 6, 12 vs enrollment count
- At-risk learner list: attendance <60% for 4+ weeks, shown to centre managers

### 7.4 Report Generation

#### Auto-generated reports (scheduled):

| Report | Frequency | Recipient | Format |
|---|---|---|---|
| Centre weekly summary | Every Sunday | Centre manager via WhatsApp | Text summary |
| Programme weekly digest | Every Monday | Programme manager | PDF + WhatsApp |
| Monthly MIS report | 1st of month | Programme admin | PDF + email |
| Quarterly narrative report | End of quarter | Programme admin + funders | PDF |
| Annual impact report | Year end | Public + funders | PDF |

#### On-demand report generation:

```
Report type: [Centre / Component / Period / MIS snapshot / Issue log / Budget utilisation]
Centre: [all / specific]
Component: [all / specific]
Period: [date range]
Format: [PDF / Excel / CSV]

[Generate]  →  Download link + optional WhatsApp share
```

**Report contents (monthly MIS example):**
- Learner counts: enrolled, active, new, dropped (with reasons)
- Attendance rates by component by centre
- Sessions planned vs delivered
- Nook: projects started, completed, skills documented
- Library: books circulated, reading hours (estimated), overdue rate
- Sports: training sessions, match results, inter-centre events
- Career counselling: plans created, opportunities linked, outcomes
- Mental health: sessions held (count only — no names or notes ever in reports)
- Community mobilisation: events, participants, new registrations
- Expense utilisation: spent vs allocated by centre and component
- Issues: opened, resolved, outstanding
- Highlights and concerns: AI-generated narrative from data (reviewed by PM before sending)

---

## 8. Public Dashboard

No login required. Accessible at a public URL. Shows aggregated, anonymised programme metrics.

**What is shown:**
- Map of active centres (no detailed address — district level)
- Total learners served (all-time and current year)
- Component reach numbers
- Sessions delivered this year
- Community events this year
- Library books circulated this year
- Nook projects completed
- Sports events and inter-centre tournaments
- Issue resolution rate (% of issues resolved within 7 days)

**What is never shown:**
- Individual learner data
- Expense or financial details
- Staff names or contact information
- Mental health statistics beyond session counts
- Centre-level breakdown that would identify individuals

**Update frequency:** Daily automated refresh. No manual intervention required.

---

## 9. WhatsApp Integration

Connects to the existing Glific + Gupshup layer (see `WHATSAPP-PLATFORM-SPEC.md`).

### Automated WhatsApp Messages (outbound, no PM intervention)

| Trigger | Recipient | Message |
|---|---|---|
| Attendance marked for session | Centre manager | "Attendance for [session] marked: [X] present, [Y] absent" |
| Learner absent 3+ consecutive sessions | Guardian (if phone on file) | Soft check-in message — PM-approved template |
| Book overdue 7 days | Guardian | Reminder template |
| Expense approved | Submitting staff | Approval notification |
| Issue escalated (High/Critical) | Programme manager | Alert with centre, issue title, severity |
| New learner enrolled | Centre manager | Confirmation |
| Weekly centre summary | Centre manager | Text summary of the week |
| Monthly report generated | Programme manager | "Report ready — [link or PDF]" |

### WhatsApp Attendance Sharing

After a session's attendance is marked, the system generates a shareable summary that the facilitator can forward to a WhatsApp group (centre staff group). This is a generated image or text, not a direct Glific API call — the facilitator taps "Share" and WhatsApp opens with the pre-composed message.

### Two-Way Communication

Centre managers can message programme managers directly through the Glific inbox (see `WHATSAPP-PLATFORM-SPEC.md` — CMYC PM assignment). Inbound messages from centre staff are handled by the programme's PM in the Glific inbox with AI translation assist for Khasi/Garo/Pnar messages.

---

## 10. Backend API

### Technology Stack

Same as OESN (see `OESN-TECH-SPEC.md §4.1`) if shared infrastructure. Can be separate service.

```
Runtime:   Node.js 20 (Fastify) or Python 3.12 (FastAPI)
Database:  PostgreSQL 16
Storage:   Cloudflare R2 (photos, receipts, reports)
Auth:      JWT + phone OTP
Reports:   Puppeteer (PDF generation from HTML templates) or WeasyPrint
Scheduler: pg-cron or BullMQ (scheduled reports, overdue checks)
Hosting:   Railway / Render / VPS
```

### Key API Endpoints

```
POST   /auth/otp/send
POST   /auth/otp/verify

GET    /centres                            All centres (admin+)
POST   /centres                            Create centre
GET    /centres/:id                        Centre detail
GET    /centres/:id/dashboard              Centre dashboard data
GET    /centres/:id/learners               Learner list for centre
GET    /centres/:id/sessions               Sessions (filterable by component, date)
GET    /centres/:id/budget                 Budget lines + utilisation
GET    /centres/:id/issues                 Issues list

POST   /learners                           Register new learner
GET    /learners/:id                       Learner profile (role-filtered)
PATCH  /learners/:id                       Update learner
GET    /learners/:id/attendance            Attendance history + percentages
GET    /learners/:id/plans                 Individual plans (component filter applied)

POST   /enrollments                        Enrol learner in component
PATCH  /enrollments/:id                    Update status (active/paused/dropped)

POST   /sessions                           Create session
PATCH  /sessions/:id                       Update session
POST   /sessions/:id/attendance            Submit attendance for session
GET    /sessions/:id/attendance            Get attendance for session

POST   /expenses                           Submit expense claim
GET    /expenses/:centreId                 Expenses list (filterable by status, component)
PATCH  /expenses/:id/approve              Approve expense (finance officer+)
PATCH  /expenses/:id/reject               Reject with reason

POST   /mobilisation                       Log mobilisation event
GET    /mobilisation/:centreId            Mobilisation events for centre

POST   /issues                             Raise issue
PATCH  /issues/:id                         Update status / assign / resolve
GET    /issues                             Issues list (filterable by centre, severity, status)

POST   /library/books                      Add book to catalogue
POST   /library/borrow                     Issue book to learner
POST   /library/return/:borrowingId        Return book

POST   /nook/projects                      Create Nook project
PATCH  /nook/projects/:id                  Update project status / add photos

POST   /counselling/sessions               Log counselling session (counsellor only)
GET    /counselling/sessions/:learnerId     Counsellor + admin only

POST   /career/plans                       Create/update career plan
POST   /career/opportunities               Log opportunity

GET    /reports/generate                   Generate on-demand report
GET    /reports/:id                        Get generated report
GET    /mis/overview                       Programme overview metrics
GET    /mis/centres                        Per-centre metrics table
GET    /public/dashboard                   Public dashboard data (no auth)
```

---

## 11. Phased Build Plan

### Phase 1 — Core Centre Operations (Weeks 1–8)
**Goal:** A centre manager can register learners, run sessions, mark attendance, and raise issues.

- [ ] Auth system (JWT + OTP)
- [ ] Centre and user management (admin creates centres and assigns staff)
- [ ] Learner registration across all components
- [ ] Component enrollment
- [ ] Session creation and management
- [ ] Attendance marking (all components)
- [ ] Attendance summary WhatsApp message (post-marking)
- [ ] Issue raising and tracking
- [ ] Centre manager dashboard (today's sessions, alerts, quick actions)
- [ ] Individual learner profile with plans (basic — text goals)
- [ ] Programme MIS dashboard (read-only overview)
- [ ] Centre App as PWA (mobile-first)

**Deliverable:** One centre fully operational. No more attendance spreadsheets.

### Phase 2 — Component-Specific Features (Weeks 9–16)
**Goal:** Nook, Library, Sports fully functional. Expense management live.

- [ ] Nook project tracking (create, update, photos, skills)
- [ ] Library catalogue + borrowing + returns + overdue alerts
- [ ] Sports registrations + training sessions + match results
- [ ] Expense claim submission + receipt photo upload
- [ ] Expense approval workflow (finance officer)
- [ ] Budget lines and utilisation tracking
- [ ] Community mobilisation logging
- [ ] Centre-level plan (monthly) creation and approval
- [ ] Individual plans: structured goals per component with review cycle
- [ ] Report generation: monthly centre report (PDF)
- [ ] Scheduled weekly WhatsApp summary to centre manager

**Deliverable:** All five components managed digitally. Expense approval paperless.

### Phase 3 — Counselling + Career + MIS (Weeks 17–22)
**Goal:** Private counselling records live. Career plans operational. Full MIS running.

- [ ] Counselling session records (private access controls enforced)
- [ ] Crisis alert protocol (risk_level = crisis → admin WhatsApp alert)
- [ ] Career plans and opportunity tracking
- [ ] Cross-centre MIS dashboard with drill-down
- [ ] At-risk learner identification (attendance <60%)
- [ ] Guardian WhatsApp messages for absences and overdue books
- [ ] Scheduled report generation (monthly MIS, quarterly narrative)
- [ ] Public dashboard (deployed at public URL, auto-refreshed daily)
- [ ] Inter-centre sports events and tournament tracking

**Deliverable:** Full programme visible in one dashboard. Public dashboard live.

### Phase 4 — AI Layer + WhatsApp Full Integration (Weeks 23–28)
**Goal:** AI assists report writing and attendance insights. Full WhatsApp connectivity.

- [ ] AI-generated narrative sections for monthly/quarterly reports (PM reviews before send)
- [ ] Attendance pattern analysis: AI flags at-risk learners with context
- [ ] Annual impact report generation
- [ ] Full WhatsApp integration via Glific: all outbound automated messages live
- [ ] Centre manager ↔ programme manager inbox via Glific
- [ ] Report sharing via WhatsApp (PDF link)
- [ ] Bulk report generation (all centres in one click)
- [ ] Programme Admin mobile view optimisation

---

## 12. Open Questions Before Build

1. **CMYC full name:** Confirm the full name for all report headers and public dashboard.
2. **Sports disciplines:** Which 3–4 sports per centre? Are they the same across all centres or centre-specific?
3. **Age groups and definitions:** What are the exact age bands? (e.g. Child: 6–10, Adolescent: 11–15, Youth: 16–25)
4. **Mental health counselling scope:** Individual sessions only, or also group sessions? Are counsellors full-time staff or part-time / external?
5. **Career counselling eligibility:** Is career counselling only for a specific age group (e.g. 16+)?
6. **Financial year and budget cycle:** April–March? Quarterly or monthly budget periods?
7. **Expense approval chain:** Is it Centre Manager → Finance Officer → Programme Manager? Or simpler?
8. **Guardian WhatsApp:** Do you have guardian phone numbers currently? Are they comfortable receiving WhatsApp messages?
9. **Reporting recipients:** Who are the funders / external stakeholders who receive reports? What format do they require?
10. **Public dashboard:** Are there specific metrics funders or the public most need to see? Any metrics to exclude?
11. **Data migration:** Are there existing spreadsheets with learner data to import? What format?
12. **Multi-language UI:** Do centre staff need the app in Khasi/Garo/Pnar, or is English sufficient for staff?
