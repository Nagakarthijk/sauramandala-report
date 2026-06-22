# Sauramandala WhatsApp Communication Platform — Developer Spec

**Organisation:** Sauramandala  
**Programs in scope:** TFFP (ECCE Pathway), CMYC, Doorstep Incubation  
**Stack:** Glific · Gupshup · WhatsApp Business API · Claude/GPT API · Google Sheets / Metabase  
**Languages served:** English, Khasi, Garo, Pnar  
**Model:** Human-in-the-loop WhatsApp CRM with AI background assist

---

## 1. Context & Design Principles

This platform is **not** a traditional chatbot. It is a WhatsApp-native communication system where:

- **Program managers are the primary responders** — they see every conversation and reply in the local language
- **AI works invisibly in the background** — translation assist, structured data extraction, content suggestions, dashboard population
- **WhatsApp Forms handle structured data collection** — weekly reports, onboarding intake
- **Glific manages relationships** — contact profiles, group membership, inbox, broadcasts
- **Gupshup is the BSP** — WhatsApp message delivery via the existing account and number

### What AI can do here
- Translate Khasi/Garo/Pnar → English (rough, for PM context only — Google Translate API)
- Draft English response suggestions for PM review
- Extract structured signals from conversations (topic, need, sentiment, milestone)
- Generate weekly digest summaries for coordinators
- Populate dashboard from conversation data

### What AI cannot do here
- Reliably converse in Khasi, Garo, or Pnar — these are low-resource languages
- Replace the program manager's relationship with the community member
- Guarantee accuracy of translation — always treat as context-only, not ground truth

---

## 2. Programs & Their Communication Needs

### 2.1 TFFP — Early Childhood Care & Education (ECCE) Pathway

**Who:** Anganwadi workers, preschool teachers, parents, home-based caregivers (mix)  
**Primary need:** Professional learning support, weekly content delivery, peer sharing  
**Communication type:** Outbound content + open conversational inbound  
**Language:** Primarily Khasi/Garo/Pnar with some English

**What the system does:**
- Delivers weekly ECCE content (stories, activity ideas, videos, PDFs, lessons) via scheduled broadcast
- PMs manage relationships and respond to open messages in the Glific inbox
- Peer sharing facilitated through WhatsApp Groups
- AI translates incoming messages and suggests relevant content for PM to share
- Milestone check-in forms sent periodically (did you try this week's activity? how did it go?)

### 2.2 CMYC

**Who:** Program team members, community change-makers  
**Primary need:** Weekly task/event reporting, 2-way communication, learning sharing  
**Communication type:** Structured weekly reporting + conversational updates

**What the system does:**
- WhatsApp Form sent every Monday for weekly reporting (tasks, events, learnings, blockers)
- Form data flows directly to dashboard — no manual data entry
- PM manages open conversation for qualitative updates and sharing
- AI extracts themes from conversations, generates weekly coordinator digest

### 2.3 Doorstep Incubation

**Who:** Entrepreneurs being onboarded  
**Primary need:** Intake/onboarding, needs mapping, ongoing support  
**Communication type:** Onboarding form + conversational follow-up

**What the system does:**
- Onboarding WhatsApp Form captures structured profile (name, location, sector, business stage, immediate needs)
- Data flows directly to entrepreneur needs dashboard
- PM follows up conversationally after intake
- AI extracts needs signals from ongoing conversation to progressively enrich profile

### 2.4 New Use Cases

Any future program follows the same pattern:
1. Define contacts and language in Glific
2. Design the WhatsApp Form (if structured data needed) in Gupshup
3. Set up webhook → Google Sheet/dashboard
4. Configure broadcast schedule if content delivery needed
5. Assign program manager in Glific inbox

---

## 3. Glific Setup — Full Configuration Guide

Glific instance must be running and connected to Gupshup. This section covers all configuration tasks (no code required).

### 3.1 Staff Accounts & Roles

Create a staff account for each program manager and coordinator:

1. Go to **Settings → Staff Management → Add Staff**
2. Create accounts with these roles:

| Role | Access |
|---|---|
| `Admin` | Full access — coordinator / tech lead |
| `Manager` | Conversations, contacts, flows, broadcasts |
| `Staff` | Conversations and contacts only |

Assign one PM per program minimum. PMs should only see their program's contacts (use contact labels to filter).

### 3.2 Contact Groups & Labels

#### Groups — region × language (community layer)

Groups in this system are **community spaces**, not delivery channels. Personalised content goes to individuals via scheduled broadcasts. Groups carry nudges, shared reflections, and collective feedback.

Name groups as `{Program}-{Region}-{Language}`:

**TFFP groups:**
- `TFFP-EastKhasi-Khasi`
- `TFFP-WestKhasi-Khasi`
- `TFFP-WestGaro-Garo`
- `TFFP-EastGaro-Garo`
- `TFFP-Jaintia-Pnar`
- `TFFP-Urban-English` *(for district HQ / English-speaking members)*

Add regions as needed. One person can be in one group only (their home district × primary language). The group is for:
- Weekly community nudge (e.g. "What did you try this week? Share a moment 🌱")
- Celebrating member responses publicly in the group ("Thangi shared a great idea this week!")
- PM posting links to new content when it drops on YouTube/Facebook/WhatsApp
- Peer questions and informal conversation (PM monitors, does not moderate heavily)

**CMYC groups:**
- `CMYC-{District}` — one per district, language follows the district's dominant language

**Doorstep groups:**
- Not group-based at this stage — individual CRM conversations only

#### Contact Labels (Settings → Tags)

- `tffp` `cmyc` `doorstep` — program assignment
- `language-khasi` `language-garo` `language-pnar` `language-english` — for PM routing and translation
- `active` `inactive` `new` — engagement status
- `parent-track` — TFFP members on the developmental stage content path (see Section 3.4b)
- `needs-followup` `milestone-reached` `resource-shared` `escalate-to-coordinator`

**On contact opt-in:** assign program label + language label immediately. Add to their region × language group after district is confirmed in Session 1 profiling.

### 3.3 Contact Custom Fields

Add these custom fields to contact profiles (Settings → Contact Fields).

**Consent fields (all contacts — required before any data collection):**
- `consent_given` (boolean: true / false)
- `consent_date` (date: when consent was recorded)
- `consent_language` (text: language consent was given in)
- `consent_method` (text: whatsapp_optin / form / verbal_confirmed_by_pm)

**Identity & routing (all contacts):**
- `program` (text: tffp / cmyc / doorstep)
- `language` (text: english / khasi / garo / pnar)
- `location` (text: district name)
- `assigned_pm` (text: PM staff username)

**TFFP profile (built via progressive profiling — see Section 3.4a):**
- `ecce_role` (text: anganwadi_worker / preschool_teacher / parent / home_based)
- `experience_years` (text: 0-2 / 3-5 / 6-10 / 10+ — not collected for parents)
- `learning_interest` (text: free text or tag)
- `tffp_week` (number: current content week — used for anganwadi/teacher/home-based tracks)
- `last_content_sent` (date)
- `last_response_date` (date)
- `streak_weeks` (number: consecutive weeks with at least one response)
- `engagement_level` (text: high / medium / low / inactive)

**TFFP parent developmental track (see Section 3.4b):**
- `child_dob` (date: child's date of birth — YYYY-MM format is sufficient)
- `child_count` (number: if more than one child, track eldest or most recently born)
- `dev_stage` (text: computed and updated monthly — see stage table in 3.4b)
- `dev_stage_updated` (date: last time dev_stage was recalculated)
- `parent_content_week` (number: weeks of content sent within current dev_stage — resets when stage advances)

**CMYC additional:**
- `team` (text)
- `reporting_streak` (number: consecutive weeks reported)

**Doorstep additional:**
- `business_sector` (text)
- `business_stage` (text: idea / early / growing)
- `primary_need` (text)
- `onboarding_complete` (boolean)

### 3.4a Consent-First Architecture

Every user must give active consent **before** any data is collected or stored. This applies to all three programs. Consent is not implied by messaging in — it must be explicitly given.

#### Design principles

- **Language before consent:** We cannot ask for consent in a language the person doesn't understand. Language selection is always the first step.
- **Plain language:** Consent message says exactly what data is collected, how it is used, and how to opt out.
- **Active YES/NO:** Quick reply buttons — not assumed by silence or continuation.
- **Revocable:** Typing STOP at any time removes consent. This is handled immediately, not queued.
- **Consent stored:** `consent_given`, `consent_date`, `consent_language` written to contact fields before any profile questions begin.

#### Consent flow (TFFP example — same pattern for CMYC and Doorstep)

**Step 1 — Language selection** (Glific flow, triggered on first incoming message):

```
Welcome to Sauramandala's TFFP learning programme.

Please choose your language / अपनी भाषा चुनें:

[English]  [Khasi]  [Garo]  [Pnar]
```

Flow stores selection to `language` contact field immediately.

**Step 2 — Consent message** (sent in their chosen language; get translations from team):

English version:
```
Hello! 👋

The Teachers for the Future Pathway (TFFP) shares weekly 
learning content on early childhood care and education.

To do this, we will:
✅ Save your name and phone number
✅ Send you weekly content on WhatsApp
✅ Record which content you have received
✅ If you are a parent: save your child's birth month and year
   to personalise content to your child's age (no other child
   data is stored)

We will NOT share your details with anyone outside Sauramandala.

You can stop at any time by typing STOP.

Do you agree to join?

[Yes, I agree]  [No, not now]
```

**Step 3a — YES response:**
- Set `consent_given = true`
- Set `consent_date = today`
- Set `consent_language = their chosen language`
- Set `consent_method = whatsapp_optin`
- Add to relevant program group (e.g. `TFFP-Practitioners`)
- Send confirmation: *"Great! Welcome to TFFP. We'll send your first learning content soon."*
- Trigger Session 1 profile questions (see progressive profiling below)
- Notify PM

**Step 3b — NO response:**
- Set `consent_given = false`
- Send: *"No problem at all. If you change your mind, just message us again."*
- Do not add to any group
- Do not collect any further data
- PM notified (they may wish to follow up via other channel if appropriate)

**STOP handling (any time, any message containing "STOP"):**
- Flow detects keyword
- Set `consent_given = false`
- Remove from all TFFP groups immediately (synchronous)
- Send: *"You have been unsubscribed from TFFP. We won't message you again. Text JOIN if you'd like to re-join in future."*
- Log opt-out event with timestamp

#### Progressive profiling — TFFP

Instead of a long signup form, spread questions across three sessions. The flow branches at the role question — parents get a different path.

**Session 1 — After consent YES (3 questions, all tracks):**
```
To send you the most useful content, a few quick questions.

What best describes you?
[Anganwadi Worker]  [Preschool Teacher]  [Parent]  [Home-based Caregiver]
```
After answer:
```
Which district are you in?  (type your district name)
```
After answer — **if NOT parent:**
```
How many years have you worked with young children?
[0–2 years]  [3–5 years]  [6–10 years]  [10+ years]
```
→ Save `ecce_role`, `location`, `experience_years`. Add to region×language group. Send Week 1 content.

After answer — **if PARENT:**
```
What is your child's birth month and year? (e.g. March 2023)
```
→ Save `child_dob`. Compute `dev_stage`. Add to region×language group. Send Stage 1 content. Apply `parent-track` label. **Skip** to Section 3.4b for parent scheduling logic.

**Session 2 — After Week 2 content (2 questions, non-parent tracks only):**
Sent 48 hours after second weekly content piece:
```
Quick question — which age group do you mainly work with?
[0–3 years]  [3–6 years]  [Mixed 0–6]  [Older children]
```
```
How was last week's content?
[Very useful]  [Somewhat useful]  [Not very useful]
```
→ Save `age_group_served`. Use rating to flag low-engagement contacts for PM follow-up.

**Session 3 — After Week 4 content (1 question, all non-parent tracks):**
```
Is there a topic you'd especially like us to cover?
[Play-based learning]  [Child nutrition]  [Emotional wellbeing]  [Talking with parents]
```
→ Save `learning_interest`. Profile complete. No more profile questions.

#### Content personalisation — non-parent tracks

| Segment | Filter criteria | Content focus |
|---|---|---|
| Anganwadi workers | `ecce_role=anganwadi_worker` | AWC activities, Poshan, ICDS integration |
| Preschool teachers | `ecce_role=preschool_teacher` | Classroom practice, structured learning |
| Home-based caregivers | `ecce_role=home_based` | Home environment, play, language stimulation |

Content is tagged in the library with `audience` field. Individual scheduled messages use Glific template variables:

```
Hello {{contact.name}},
Your learning content for this week — for {{contact.ecce_role}}s in {{contact.location}}:
```

### 3.4b Parent Developmental Stage Track

Parents are on a fundamentally different schedule from other TFFP participants. An anganwadi worker always works with 3–6 year olds — her content can follow a standard week-by-week curriculum. A parent's content must grow alongside their child. A parent who joins when their child is 4 months old needs completely different content two years later than they did on day one.

#### Developmental stage table

| Stage ID | Child age | Content focus |
|---|---|---|
| `newborn` | 0–3 months | Responsive caregiving, skin contact, sleep, feeding |
| `early_infancy` | 3–6 months | Sensory play, talking to baby, tummy time |
| `late_infancy` | 6–9 months | Solid foods, babbling, object permanence |
| `crawler` | 9–12 months | Exploration, safety, first words |
| `toddler_early` | 12–18 months | Walking, language explosion, tantrums |
| `toddler_mid` | 18–24 months | Pretend play, independence, routines |
| `toddler_late` | 24–30 months | Stories, social play, toilet readiness |
| `preschool_early` | 30–36 months | Drawing, counting, peer play |
| `preschool_mid` | 3–4 years | School readiness, emotional regulation |
| `preschool_late` | 4–5 years | Reading readiness, friendships, questions |
| `kindergarten` | 5–6 years | Formal learning transitions, independence |

#### How stage advancement works

A scheduled backend job (runs monthly, or can run weekly and only acts on changes) does:

```python
from dateutil.relativedelta import relativedelta

def compute_dev_stage(child_dob: date) -> str:
    age = relativedelta(date.today(), child_dob)
    age_months = age.years * 12 + age.months
    if age_months < 3:   return "newborn"
    if age_months < 6:   return "early_infancy"
    if age_months < 9:   return "late_infancy"
    if age_months < 12:  return "crawler"
    if age_months < 18:  return "toddler_early"
    if age_months < 24:  return "toddler_mid"
    if age_months < 30:  return "toddler_late"
    if age_months < 36:  return "preschool_early"
    if age_months < 48:  return "preschool_mid"
    if age_months < 60:  return "preschool_late"
    return "kindergarten"
```

When `compute_dev_stage(child_dob)` returns a value different from the stored `dev_stage`:
1. Update `dev_stage` contact field in Glific via GraphQL
2. Reset `parent_content_week = 1`
3. Update `dev_stage_updated = today`
4. Send a stage-transition message to the parent:

```
Hi {{contact.name}} 🌱

Your child has reached a new stage! This month we'll be sharing ideas for
children aged {{new_stage_label}}.

The world looks different to them now — and your role is evolving too.
```

#### Content library tagging for parent track

Parent content in the library has two tags instead of the standard `audience`:
- `track = parent`
- `dev_stage = {stage_id}` (e.g. `toddler_early`)

Each stage has a content sequence of 4–6 weekly pieces. `parent_content_week` tracks position within the current stage's sequence. When it reaches the end of the stage's content before the child ages out, the system:
- Sends a "reinforcement" piece (activity idea, reflection prompt)
- Does not repeat the same content — flags to content team to add more for that stage

#### Parent content delivery

Parent content is **always individual** — never a group broadcast. The Glific GraphQL API sends a personalised message to each parent contact according to:
- Their `dev_stage` (which content pool to draw from)
- Their `parent_content_week` (which piece in the sequence)
- Their `language` (which translation variant)
- Their `last_content_sent` date (to maintain weekly cadence without double-sending)

Parent group posts (in the region×language group) are separate from this — they are community nudges, not personalised content. Example group nudge for parent segment:

```
This week's thought for parents in the group 🌟
What's one thing your child did this week that made you smile?
Share here — we love hearing your stories.
```

#### No child data beyond DOB

The system stores only the child's birth month/year — no name, no gender, no photos, no health data. The developmental stage is derived entirely from age. This is explicitly stated in the consent message for parents.

### 3.4 Conversation Inbox Configuration

The inbox is the primary workspace for program managers.

1. Go to **Conversations** in Glific sidebar
2. PMs filter by their program label to see only their contacts
3. Set up **Saved Replies** (Settings → Saved Replies) for common responses in each language — PMs can insert these quickly

**Saved Replies to create (get these translated by the team):**

- Welcome message (per language × per program)
- "Thank you for sharing" (per language)
- "We will get back to you" (per language)
- Weekly content introduction (per week × per language)
- Encouragement / well done (per language)

**PM workflow for every incoming message:**
1. Read message (with translation assist — see Section 6)
2. Respond in appropriate language using saved replies or freehand
3. Apply relevant label (`needs-followup`, `resource-shared` etc.)
4. If complex/urgent → label `escalate-to-coordinator` and notify coordinator

### 3.5 Flows — Keep Simple

Glific flows handle **only** the automated touchpoints. Do not build complex logic in flows — that causes the drag-and-drop problems previously encountered.

**Flows to create:**

#### Opt-in / Consent Flow
Triggered when a new contact sends any message for the first time. **No data is stored and no group is assigned until consent is given.** Full design in Section 3.4a.

Nodes:
1. Send language selection message → quick reply buttons [English] [Khasi] [Garo] [Pnar]
2. Save `language` contact field
3. Send consent message in chosen language
4. Wait for YES / NO / STOP keyword
5. **YES branch:** set consent fields → ask which program → add to group → apply label → trigger Session 1 profile questions → notify PM
6. **NO branch:** set `consent_given=false` → send no-problem message → end flow
7. **STOP keyword (any time):** remove from groups → set `consent_given=false` → send unsubscribe confirmation

#### TFFP Content Delivery Flow
Not a conversation flow — this is a broadcast template. See Section 3.6.

#### CMYC Weekly Reminder Flow
Triggered every Monday at 9am:
1. Send message: "Good morning! Time for your weekly check-in. Tap below to fill your report."
2. Send WhatsApp Form (see Section 4.2)

#### Doorstep Intake Trigger Flow
Triggered when contact is added to `Doorstep-Entrepreneurs` group:
1. Send welcome message
2. Send WhatsApp Form for onboarding intake (see Section 4.3)
3. Notify Doorstep PM

#### Inactivity Re-engagement Flow
Triggered if contact has no activity for 21 days:
1. Send a warm check-in message
2. Apply `needs-followup` label
3. Notify PM

### 3.6 Broadcasts — TFFP Weekly Content

This is the core TFFP delivery mechanism.

**Setup:**
1. Go to **Broadcasts → New Broadcast**
2. Select recipient group (e.g. `TFFP-Anganwadi`)
3. Select message template (pre-approved by WhatsApp/Gupshup — see Section 4.1)
4. Schedule for specific day/time (e.g. every Wednesday 10am)

**Content library:** Maintain a Google Sheet as the content master. The scheduler reads this sheet to know what to send and to whom.

| Column | Values / notes |
|---|---|
| `content_id` | Unique ID, e.g. `TFFP-AW-W03` or `TFFP-P-TODDLER_EARLY-W02` |
| `track` | `anganwadi_worker` / `preschool_teacher` / `home_based` / `parent` |
| `dev_stage` | For parent track only: stage ID from Section 3.4b. Leave blank for other tracks. |
| `week_in_sequence` | Which week within the track or stage (1, 2, 3...) |
| `content_type` | `story` / `activity_idea` / `video` / `lesson` / `pdf` / `reflection_prompt` / `group_nudge` |
| `title` | Short title for PM reference |
| `language` | `english` / `khasi` / `garo` / `pnar` |
| `platform` | Where the content lives: `whatsapp` / `youtube` / `facebook` / `instagram` / `drive` |
| `content_text` | The WhatsApp message body (for `platform=whatsapp`) or the caption/intro text (for link platforms) |
| `media_url` | YouTube link / Facebook post URL / Instagram reel URL / Google Drive shareable link |
| `whatsapp_media_id` | For WhatsApp-native media (images, audio, PDFs uploaded to Gupshup) — Gupshup media ID |
| `gupshup_template_name` | Approved template name to use for this content send |
| `approved` | `yes` / `no` — content is not sent until marked approved |
| `added_by` | Staff name who added the row |

#### Multi-platform sending logic

When the scheduler picks a content row to send, it builds the WhatsApp message based on `platform`:

- **`whatsapp`** — send `content_text` directly, attach `whatsapp_media_id` if present
- **`youtube`** — send `content_text` + YouTube link: *"Watch on YouTube: {media_url}"*
- **`facebook`** — send `content_text` + link: *"See on Facebook: {media_url}"*
- **`instagram`** — send `content_text` + link: *"Watch on Instagram: {media_url}"*
- **`drive`** — send `content_text` + link: *"Open resource: {media_url}"*

The WhatsApp message always has context text — never just a bare link. The link platform is secondary; the content is described first.

**Important:** YouTube and Drive links work fine inside WhatsApp messages. Instagram and Facebook links render as plain links — WhatsApp does not embed them. Warn content team to write strong caption text for those platforms since the preview may not show.

Team populates this sheet as content is prepared. The scheduler (Section 6) reads only rows where `approved=yes` and selects based on `track`, `dev_stage` (if parent), `week_in_sequence`, and `language`.

---

## 3.7 Individual vs Group Scheduling — Two-Layer Model

TFFP operates two parallel communication layers. They are independent systems with different logic.

### Individual layer — personalised content delivery

Each contact receives their own content sequence on their own schedule. The scheduler runs weekly (e.g. every Wednesday 9am) and for each eligible contact:

1. Look up `ecce_role` → determines which track (anganwadi / teacher / home_based / parent)
2. **If parent:** look up `dev_stage` and `parent_content_week` → find matching content row
3. **If other:** look up `tffp_week` → find matching content row
4. Check `language` → select correct language variant
5. Check `last_content_sent` → skip if content was sent less than 6 days ago (prevents double-send)
6. Send personalised message via Glific GraphQL API
7. Increment `tffp_week` or `parent_content_week`
8. Update `last_content_sent = today`

This means two anganwadi workers who joined 3 weeks apart are on different weeks. A parent whose child just turned 18 months gets `toddler_early` content regardless of when they joined.

**No group broadcasts for content delivery.** Content is always individual so the sequence is correct.

### Group layer — community nudges and feedback

Groups (region × language) receive:
- One nudge per week from PM or automated message — a prompt to share, reflect, or celebrate
- Links when new content is posted to YouTube/Facebook/Instagram (PM posts manually — not automated, since social media timing varies)
- Peer conversation — no moderation script, PM participates naturally

Group messages are simple Glific broadcasts to the group, not the individual scheduling system. PM sends them from the Glific interface, or they are scheduled as simple weekly templates with no personalisation logic.

Example weekly group nudge template (`tffp_group_nudge`):
```
{{contact.name}} and friends 🌱

This week's question for our group:
What is one thing a child in your care did this week that surprised you?

Share here — your stories help everyone learn.
```

### Gamification — individual streaks, group celebrations

Individual streaks (`streak_weeks`) are tracked per contact. When a contact replies to content (any inbound message within 72h of content send), `streak_weeks` increments. If no reply for 8+ days after content sent, streak resets.

Milestone messages trigger at: 1 week, 4 weeks, 8 weeks, 16 weeks, 26 weeks (6 months).

Example at 4 weeks:
```
You've been learning with TFFP for 4 weeks! 🎉
That's consistency — and it shows. Keep going.
```

**No leaderboards.** Streak is personal. Group posts celebrate engagement without ranking:
```
Our group has been active for 3 weeks straight — thank you everyone for sharing! 🙏
```

---

## 4. Gupshup Setup — WhatsApp Forms & Templates

### 4.1 Message Templates

All broadcast and outbound messages need pre-approved WhatsApp templates. Apply for these in the Gupshup dashboard.

**Templates to create and get approved:**

| Template Name | Use | Variables |
|---|---|---|
| `tffp_consent_request` | First-contact consent ask | *(language-specific, no variables — static text)* |
| `tffp_consent_confirmed` | Post-consent welcome | `{{first_name}}` |
| `tffp_profile_q1` | Session 1 role question | — |
| `tffp_profile_q2_session2` | Session 2 age group question | `{{first_name}}` |
| `tffp_profile_q3_session3` | Session 3 interest question | `{{first_name}}` |
| `tffp_weekly_content` | Weekly TFFP broadcast | `{{first_name}}`, `{{ecce_role}}`, `{{location}}`, `{{week_number}}`, `{{content_title}}`, `{{content_body}}` |
| `cmyc_weekly_reminder` | Monday CMYC form trigger | `{{first_name}}` |
| `doorstep_welcome` | New entrepreneur welcome | `{{first_name}}` |
| `general_followup` | PM-triggered follow-up | `{{first_name}}`, `{{message}}` |
| `inactivity_checkin` | 21-day re-engagement | `{{first_name}}` |
| `stop_confirmation` | Opt-out acknowledgement | *(static, no variables)* |

For each template: submit via Gupshup Dashboard → Templates → Create Template. Allow 24–48 hours for Meta approval.

For regional language templates (Khasi/Garo/Pnar): create a separate template per language. Meta supports regional language template approval.

### 4.2 WhatsApp Form — CMYC Weekly Report

Build this in Gupshup's Flow Builder (Gupshup Dashboard → Flows → Create Flow).

**Form fields:**

```
Screen 1: Weekly Report
- Week ending (date picker)
- Tasks completed this week (multi-line text, max 500 chars)
- Events organised or attended (multi-line text, max 300 chars)
- Key learning or insight (multi-line text, max 300 chars)
- Main challenge or blocker (multi-line text, max 300 chars)
- Overall mood this week (dropdown: Energised / Steady / Struggling)

Screen 2: Confirmation
- "Thank you for your report! Your coordinator will review it."
- Submit button
```

**Webhook configuration:**
- On form submit → POST to your backend webhook URL (Section 5)
- Payload will contain all field values + contact phone number + timestamp

### 4.3 WhatsApp Form — Doorstep Intake

**Form fields:**

```
Screen 1: About You
- Full name (text)
- Location / Village / District (text)
- Primary language (dropdown: Khasi / Garo / Pnar / English / Other)

Screen 2: Your Business
- Business sector (dropdown: Agriculture / Handicrafts / Food & Beverage / 
  Retail / Services / Technology / Other)
- Business stage (dropdown: Just an idea / Started but early / 
  Running and want to grow / Other)
- Brief description of what you do (multi-line text, max 400 chars)

Screen 3: Your Needs
- What do you need most right now? (multi-select checkboxes:
  Business planning help / Access to finance / Marketing support /
  Skills training / Connecting with other entrepreneurs /
  Government scheme guidance / Other)
- Biggest challenge right now (multi-line text, max 300 chars)

Screen 4: Confirmation
- "Welcome to Doorstep Incubation! Your program manager will be in touch soon."
```

**Webhook:** same backend endpoint as CMYC, with `program: "doorstep"` in payload.

### 4.4 WhatsApp Form — TFFP Milestone Check-in

Send this every 4 weeks to TFFP contacts.

```
Screen 1: Activity Check-in
- Did you try the activity from this week's content? 
  (Radio: Yes, fully / Yes, partly / Not yet)
- If yes — how did the children respond? (multi-line text, optional)
- Any challenges in trying the activity? (multi-line text, optional)
- What would you like more of? (multi-select: Stories / Activity ideas / 
  Videos / Tips for parents / Resources in my language / Other)
```

### 4.5 Gupshup Webhook / Callback URL Configuration

In Gupshup Dashboard → Settings → Webhook:

Set the **callback URL** to your backend service endpoint:
```
https://your-backend-domain.com/webhook/inbound
```

This URL receives every incoming WhatsApp message. Your backend routes it:
- If it's a form submission → extract structured data → write to dashboard
- If it's a regular message → forward to Glific (Glific handles this natively if connected)
- All messages → run AI background processing (Section 6)

> **Note:** As of Jan 2025, Gupshup requires a live callback URL — placeholder/test URLs are removed automatically. Ensure your backend is deployed before configuring this.

---

## 5. Data Pipeline — Forms → Dashboard

### 5.1 Webhook Handler (Backend Service)

A lightweight Python or Node.js service that:

1. Receives Gupshup webhook POST on `/webhook/inbound`
2. Identifies message type: form submission vs regular message
3. For form submissions: writes structured row to Google Sheet via Sheets API
4. For regular messages: passes to AI background layer (Section 6)
5. Returns `200 OK` within 5 seconds (queue heavy processing async)

**Deployment:** Railway, Render, or any VPS. Needs HTTPS. Minimum 512MB RAM.

### 5.2 Google Sheets Structure

Create one Google Sheet per program, shared with Metabase or viewed directly.

**CMYC Weekly Reports sheet:**

| Column | Source |
|---|---|
| `submission_date` | Gupshup webhook timestamp |
| `contact_phone` | Gupshup sender ID |
| `contact_name` | Looked up from Glific contact |
| `team` | Glific contact field |
| `week_ending` | Form field |
| `tasks_completed` | Form field |
| `events` | Form field |
| `learning` | Form field |
| `challenge` | Form field |
| `mood` | Form field |
| `ai_summary` | AI-generated one-line summary (Section 6) |
| `ai_tags` | Comma-separated themes extracted by AI |

**Doorstep Entrepreneurs sheet:**

| Column | Source |
|---|---|
| `onboarding_date` | Webhook timestamp |
| `contact_phone` | Gupshup sender |
| `name` | Form field |
| `location` | Form field |
| `language` | Form field |
| `sector` | Form field |
| `stage` | Form field |
| `description` | Form field |
| `needs` | Form field (multi-select, comma-separated) |
| `challenge` | Form field |
| `assigned_pm` | Assigned in Glific after intake |

**TFFP Engagement sheet:**

| Column | Source |
|---|---|
| `date` | Timestamp |
| `contact_phone` | Sender |
| `contact_name` | Glific lookup |
| `ecce_role` | Glific contact field |
| `message_direction` | inbound / outbound |
| `content_week` | Glific contact field `tffp_week` |
| `message_type` | form_submission / conversation / broadcast_reply |
| `ai_topic` | AI-extracted topic |
| `ai_sentiment` | positive / neutral / concern |
| `ai_need_detected` | Any need signal detected by AI |

### 5.3 Dashboard (Metabase)

Connect Metabase (free, self-hosted or cloud) to Google Sheets via a connector, or directly to the backend PostgreSQL database if you prefer DB over Sheets.

**Key dashboards to build:**

TFFP: weekly engagement rate, active vs inactive contacts, top topics arising, content reach by group  
CMYC: reporting streak per person, mood trends over time, recurring challenges, learning themes  
Doorstep: entrepreneurs by sector and stage, needs heatmap by location, onboarding completion rate

---

## 6. AI Background Layer

This is a Python service (can be the same service as the webhook handler) that runs on every inbound message without the user knowing.

### 6.1 Translation Assist for Program Managers

When a message arrives in Khasi, Garo, or Pnar:

1. Detect language (Google Cloud Translation API — `detectLanguage`)
2. Translate to English (Google Translate API)
3. Store translation alongside original in your database
4. Surface to PM via a simple internal tool or Glific note on the contact

> Translation quality for these languages is limited — treat as rough context only. PMs should not rely on it for sensitive conversations.

**Cost:** Google Translate API is ~$20 per million characters. At NGO volumes, expect under $5/month.

### 6.2 Structured Data Extraction from Conversations

For each inbound message, call Claude API with this task:

```
System: You extract structured signals from WhatsApp messages sent by 
ECCE practitioners / community members in northeast India. 
Extract only what is clearly present — do not infer beyond the text.

Extract:
- topic: one of [learning_activity, child_development, resource_request, 
         personal_update, challenge_reported, success_shared, question, 
         group_sharing, other]
- sentiment: positive / neutral / concern / distress
- need_detected: brief phrase if a specific need is mentioned, else null
- milestone: true if they report completing or trying something, else false

Return JSON only.
```

Write extracted fields to the engagement sheet alongside the message.

**Cost:** Claude Haiku is ~$0.25 per million input tokens. At 500 messages/day × 100 tokens each = 50K tokens/day = ~$0.01/day. Negligible.

### 6.3 Response Suggestions for PMs

When PM opens a conversation in Glific, the AI layer can pre-generate a suggested response:

```
System: You assist program managers at Sauramandala who support ECCE 
practitioners in Meghalaya. Write a warm, brief WhatsApp response in 
English that the PM can translate or adapt. Keep it under 3 sentences. 
Be encouraging and practical.

User message (translated): {{translated_message}}
Contact role: {{ecce_role}}
Last content sent: Week {{tffp_week}} — {{content_title}}
```

Deliver this suggestion via:
- A simple web page the PM opens alongside Glific (shows last message + AI suggestion)
- OR a Glific note added to the contact automatically

### 6.4 Weekly Coordinator Digest

Every Sunday night, run a script that:

1. Pulls the week's conversation data from the database
2. Groups by program and theme
3. Calls Claude API to generate a narrative summary:

```
Summarise this week's TFFP conversations for the program coordinator.
Include: engagement level, top themes arising, any concerns flagged, 
notable successes shared, contacts needing follow-up.
Keep it under 300 words, structured with short sections.
```

4. Sends the summary to the coordinator via WhatsApp (or email)

---

## 7. Phased Delivery Plan

### Phase 1 — Foundation (Weeks 1–3)
**Goal:** TFFP broadcasts live, Glific inbox active for PMs

Tasks:
- [ ] Create PM staff accounts in Glific
- [ ] Create contact groups and labels in Glific
- [ ] Add contact custom fields in Glific
- [ ] Create and get approved: `tffp_consent_request` (4 language variants), `tffp_consent_confirmed`, `tffp_weekly_content`, `general_followup`, `inactivity_checkin`, `stop_confirmation` templates in Gupshup
- [ ] Add consent fields to Glific contact profile: `consent_given`, `consent_date`, `consent_language`, `consent_method`
- [ ] Build and test consent flow in Glific (language → consent message → YES/NO/STOP handling)
- [ ] Build and test Session 1 progressive profiling flow (3 questions post-consent)
- [ ] Create TFFP content library Google Sheet and populate Week 1–4
- [ ] Set up first 4 weekly broadcasts in Glific (scheduled)
- [ ] Create Saved Replies in Glific for PMs
- [ ] Train PMs on Glific inbox — assign contacts, label conversations, saved replies
- [ ] Set up inactivity re-engagement flow

**Deliverable:** TFFP practitioners receive weekly content. PMs manage conversations from Glific inbox.

### Phase 2 — Structured Data Collection (Weeks 4–6)
**Goal:** CMYC reporting live, Doorstep intake live, data flowing to dashboard

Tasks:
- [ ] Design and build CMYC weekly report form in Gupshup Flow Builder
- [ ] Design and build Doorstep intake form in Gupshup Flow Builder
- [ ] Deploy webhook handler backend (Railway/Render)
- [ ] Connect Gupshup callback URL to webhook handler
- [ ] Create Google Sheets for CMYC and Doorstep data
- [ ] Build CMYC weekly reminder flow in Glific (Monday trigger → form send)
- [ ] Build Doorstep intake trigger flow in Glific
- [ ] Set up Metabase connected to Google Sheets
- [ ] Build initial dashboard views (CMYC reporting tracker, Doorstep needs map)
- [ ] Get approved: `cmyc_weekly_reminder`, `doorstep_welcome` templates

**Deliverable:** CMYC team reports weekly via form. Doorstep entrepreneurs onboard via form. Both visible in dashboard.

### Phase 3 — AI Background Layer (Weeks 7–10)
**Goal:** Translation assist and structured extraction running for all programs

Tasks:
- [ ] Add Google Translate API call to webhook handler
- [ ] Add Claude API extraction call to webhook handler
- [ ] Write extracted fields (topic, sentiment, need, milestone) to engagement sheets
- [ ] Build simple PM-facing translation assist view (basic webpage showing last message + translation + AI suggestion)
- [ ] Add TFFP engagement tracking to dashboard
- [ ] Build and schedule weekly coordinator digest script
- [ ] Build TFFP milestone check-in form and 4-week trigger

**Deliverable:** PMs have translation context. Dashboard shows conversation themes. Coordinator gets weekly AI digest.

### Phase 4 — Iterate & Scale (Ongoing)
- Add new programs using the same pattern (form + broadcast + inbox)
- Improve AI extraction prompts based on real data
- Add language-specific saved replies as team builds them up
- Scale contact numbers — Glific and Gupshup both handle thousands

---

## 8. Technical Stack Summary

| Component | Tool | Hosted Where |
|---|---|---|
| WhatsApp BSP | Gupshup (existing account) | Gupshup cloud |
| CRM & messaging | Glific | Glific cloud or self-hosted |
| WhatsApp Forms | Gupshup Flow Builder | Gupshup cloud |
| Webhook handler | Python (FastAPI) | Railway or Render |
| AI extraction | Claude API (Haiku model) | Anthropic cloud |
| Translation | Google Translate API | Google cloud |
| Data storage | Google Sheets (simple) or PostgreSQL | Google / Railway |
| Dashboard | Metabase | Metabase cloud (free) or self-hosted |
| Content library | Google Sheets | Google |
| Config / content management | Google Sheets or Airtable | Cloud |

---

## 9. Credentials & Keys Needed

Before development starts, collect:

- [ ] Gupshup API key and WhatsApp number
- [ ] Glific instance URL + admin credentials
- [ ] Anthropic API key (Claude)
- [ ] Google Cloud project with Translate API enabled + service account JSON
- [ ] Google Sheets IDs for each program's data sheet
- [ ] Metabase instance URL + credentials
- [ ] Railway/Render account for backend deployment

Store all secrets in environment variables — never in code.

---

## 10. Open Questions for the Team

Before Phase 1 build starts, decisions needed:

1. **Glific hosting:** Are you on Glific's managed cloud or self-hosted? If self-hosted, who manages infra?
2. **Opt-in mechanism:** How do TFFP practitioners currently know to message in? Is there an existing number they know?
3. **Content approval:** Who approves weekly TFFP content before broadcast? What is the sign-off process?
4. **PM capacity:** How many conversations can each PM realistically handle per day?
5. **Language coverage:** Which PM speaks which language? Map PM → language so contact assignment is correct.
6. **CMYC group size:** How many people will be submitting weekly reports? This determines broadcast volume.
7. **Dashboard viewers:** Who sees the dashboard — internal team only, or shared with funders/partners?
8. **Data privacy:** Are contact phone numbers sensitive? Do you need a data handling policy for WhatsApp conversations?
9. **Consent translations:** Who will translate the consent message into Khasi, Garo, and Pnar? This must be done by a fluent speaker — do not use machine translation for legal consent text.
10. **STOP keyword localisation:** Should STOP also work in local language equivalents (e.g. a Khasi word for "stop")? If yes, what are those keywords? Add them to the flow keyword triggers.
11. **Re-join flow:** If someone who previously typed STOP messages again, should the consent flow restart automatically or should a PM reach out first?
