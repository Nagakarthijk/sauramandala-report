# Program Configuration Engine — Technical Specification

**System:** Sauramandala WhatsApp Program Operating System  
**Purpose:** Convert program descriptions and user journeys into deployed WhatsApp ecosystems  
**Status:** Draft for developer handoff

---

## 1. The Core Idea

This platform is built once. Every program — TFFP, CMYC, OESN/Doorstep, anything that comes next — is a **configuration** run through the same engine. A programme team describes their program in plain language. The engine deploys a live WhatsApp ecosystem. No developers needed for each new program.

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROGRAM STUDIO                             │
│           (web UI — used by programme teams, not devs)          │
│                                                                 │
│  1. Describe your program                                       │
│  2. Define your users                                           │
│  3. Map their journeys                                          │
│  4. Define what data to collect                                 │
│  5. Define what to report and show publicly                     │
└────────────────────────────┬────────────────────────────────────┘
                             │  structured program config (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONFIG → DEPLOY ENGINE                        │
│                                                                 │
│  LLM layer:      journey descriptions → flow logic             │
│  Template layer: flow logic → Glific flow JSON                  │
│                             → Gupshup WhatsApp Form config      │
│                             → database schema extension         │
│                             → dashboard view config             │
│  Validation:     check all artifacts before deploying          │
│  Deployment:     push to Glific API, Gupshup API, DB, dashboard │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RUNTIME PLATFORM                             │
│           (built once, shared by all programs)                  │
│                                                                 │
│  Glific          WhatsApp CRM, inbox, broadcasts, flows        │
│  Gupshup         WhatsApp delivery, Forms                      │
│  Database         Contact data, program data, MIS              │
│  PM Inbox         Human-in-the-loop for each program           │
│  Dashboard        Per-program + public views                    │
│  AI Layer         Translation, extraction, suggestions         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. What a Program Configuration Contains

A program config is a structured JSON document. The Program Studio generates it. Developers never write it by hand — but it is human-readable and version-controlled in git.

```json
{
  "program": {
    "id": "tffp",
    "name": "TFFP",
    "full_name": "Teachers for the Future Pathway",
    "description": "ECCE professional learning pathway for anganwadi workers, preschool teachers, parents, and home-based caregivers in Meghalaya",
    "languages": ["khasi", "garo", "pnar", "english"],
    "primary_language": "khasi",
    "geography": ["Meghalaya"],
    "ethos": "Professional learning community — warm, peer-led, practical",
    "whatsapp_number": "+91XXXXXXXXXX",
    "gupshup_api_key": "{{env.GUPSHUP_API_KEY}}",
    "glific_org_id": "{{env.GLIFIC_ORG_ID}}"
  },

  "user_types": [
    {
      "id": "practitioner",
      "label": "ECCE Practitioner",
      "subtypes": ["anganwadi_worker", "preschool_teacher", "parent", "home_based_caregiver"],
      "primary_contact": "whatsapp",
      "language_field": true,
      "consent_required": true
    },
    {
      "id": "program_manager",
      "label": "Programme Manager",
      "primary_contact": "glific_inbox",
      "can_broadcast": true,
      "can_see_all": true
    }
  ],

  "journeys": [
    {
      "id": "onboarding",
      "trigger": "keyword:join",
      "user_type": "practitioner",
      "description": "New practitioner finds the number and sends 'join'. System registers them and asks which role they are.",
      "steps": [
        {
          "id": "welcome",
          "type": "message",
          "content": "Welcome to TFFP! We support ECCE practitioners across Meghalaya. What best describes you?",
          "options": ["Anganwadi Worker", "Preschool Teacher", "Parent", "Home-based Caregiver"]
        },
        {
          "id": "language_select",
          "type": "message",
          "content": "Which language do you prefer?",
          "options": ["Khasi", "Garo", "Pnar", "English"],
          "saves_to": "contact.language"
        },
        {
          "id": "name_collect",
          "type": "form",
          "fields": [
            {"key": "name", "label": "Your name", "type": "text", "required": true},
            {"key": "location", "label": "Your village or block", "type": "text"},
            {"key": "centre_name", "label": "Your centre or school name (if any)", "type": "text"}
          ]
        },
        {
          "id": "confirmation",
          "type": "message",
          "content": "You're registered! Every Wednesday you'll receive learning materials. Your programme manager {{pm_name}} will be in touch.",
          "assigns_to_group": "tffp-{{contact.subtype}}"
        }
      ]
    },
    {
      "id": "weekly_content",
      "trigger": "schedule:wednesday:10:00",
      "user_type": "practitioner",
      "description": "Every Wednesday at 10am, send this week's ECCE content to all active practitioners",
      "steps": [
        {
          "id": "content_send",
          "type": "broadcast",
          "content_source": "content_library",
          "content_filter": {"week": "current", "program": "tffp"},
          "target_group": "tffp-all"
        }
      ]
    },
    {
      "id": "checkin",
      "trigger": "schedule:monthly:first_monday",
      "user_type": "practitioner",
      "description": "Monthly check-in form — did they try the activity, how did it go",
      "steps": [
        {
          "id": "checkin_form",
          "type": "whatsapp_form",
          "fields": [
            {"key": "tried_activity", "label": "Did you try this month's activity?", "type": "radio", "options": ["Yes, fully", "Yes, partly", "Not yet"]},
            {"key": "children_response", "label": "How did the children respond?", "type": "text", "optional": true},
            {"key": "challenge", "label": "Any challenges?", "type": "text", "optional": true},
            {"key": "want_more", "label": "What would you like more of?", "type": "multiselect", "options": ["Stories", "Activity ideas", "Videos", "Tips for parents", "Resources in my language"]}
          ],
          "saves_to": "mis.tffp_checkins"
        }
      ]
    },
    {
      "id": "open_conversation",
      "trigger": "any_inbound_message",
      "user_type": "practitioner",
      "description": "Any message outside a flow goes to the PM inbox. AI translates and suggests a response.",
      "steps": [
        {
          "id": "ai_assist",
          "type": "ai_process",
          "actions": ["translate_to_english", "extract_topic_and_sentiment", "suggest_response"],
          "output_to": "pm_inbox"
        },
        {
          "id": "pm_inbox",
          "type": "human_handoff",
          "assigned_pm": "{{program.pm}}",
          "sla_hours": 24
        }
      ]
    }
  ],

  "data_schema": {
    "contact_fields": [
      {"key": "subtype", "label": "Role", "type": "enum", "options": ["anganwadi_worker", "preschool_teacher", "parent", "home_based_caregiver"]},
      {"key": "language", "label": "Preferred language", "type": "enum", "options": ["khasi", "garo", "pnar", "english"]},
      {"key": "location", "label": "Village / Block", "type": "text"},
      {"key": "centre_name", "label": "Centre or school", "type": "text"},
      {"key": "content_week", "label": "Current content week", "type": "number"},
      {"key": "engagement_level", "label": "Engagement", "type": "enum", "options": ["high", "medium", "low"]}
    ],
    "mis_tables": [
      {
        "id": "tffp_checkins",
        "label": "Monthly Check-ins",
        "fields": ["contact_phone", "submission_date", "tried_activity", "children_response", "challenge", "want_more", "ai_topic", "ai_sentiment"]
      }
    ]
  },

  "content_library": {
    "source": "google_sheets",
    "sheet_id": "{{env.TFFP_CONTENT_SHEET_ID}}",
    "columns": ["week_number", "content_type", "title", "language", "content_text_or_url", "template_name", "target_group"]
  },

  "dashboard": {
    "internal": {
      "metrics": ["active_practitioners", "weekly_content_reach", "checkin_completion_rate", "top_topics_this_month", "inactive_14_days", "inactive_30_days"]
    },
    "public": {
      "metrics": ["total_practitioners_reached", "content_weeks_delivered", "districts_covered"],
      "visible": true
    }
  },

  "notifications": [
    {"trigger": "inactivity_14_days", "recipient": "pm", "message": "{{contact.name}} has not responded in 14 days"},
    {"trigger": "new_registration", "recipient": "pm", "message": "New practitioner registered: {{contact.name}}, {{contact.location}}"}
  ]
}
```

This is the **full program config** for TFFP. The engine reads this and deploys everything. CMYC and OESN are different JSON configs through the same engine.

---

## 3. Program Studio — The UI

A web app used by programme teams to create and edit program configs. Non-technical users can operate it. Developers review the generated JSON before deployment.

### 3.1 Studio Screen Flow

```
Studio Home
├── My Programs
│   ├── TFFP [Active] [Edit] [View Deployment]
│   ├── CMYC [Active] [Edit] [View Deployment]
│   └── [+ New Program]
└── Shared Resources
    ├── WhatsApp number pool
    ├── Content libraries
    └── PM assignments
```

### 3.2 New Program Wizard — Step by Step

#### Step 1: Describe Your Program

```
Program name: _______________
Full name: __________________

Describe your program in plain language:
┌─────────────────────────────────────────────────────────┐
│ TFFP is a professional learning pathway for ECCE        │
│ practitioners in Meghalaya — anganwadi workers,         │
│ preschool teachers, parents, and home-based caregivers. │
│ We deliver weekly content and support reflective        │
│ practice through a peer learning community.             │
└─────────────────────────────────────────────────────────┘

Languages: [+ Add language]
  ● Khasi (primary)  ● Garo  ● Pnar  ● English

Geography: Meghalaya

Program ethos / tone of communication:
┌─────────────────────────────────────────────────────────┐
│ Warm, peer-led, practical. Not institutional.           │
│ Practitioners are professionals, not recipients.        │
└─────────────────────────────────────────────────────────┘

[AI: Generate program summary for review →]
```

#### Step 2: Define Your Users

```
Who uses this program via WhatsApp?

[+ Add user type]

USER TYPE 1: Practitioner
  Label shown: "ECCE Practitioner"
  Sub-types: Anganwadi Worker / Preschool Teacher / Parent / Home-based Caregiver
  They contact us via: WhatsApp
  Language preference: Ask on registration? [Yes]
  Consent required before data collection? [Yes]

USER TYPE 2: Programme Manager
  Label: "Programme Manager"
  They work in: Glific inbox
  They manage: All practitioners
  [+ Add PM: name + phone]
```

#### Step 3: Map User Journeys

This is the core step. The programme team describes journeys in plain language. The AI converts them to deployable flows.

```
JOURNEYS FOR: Practitioner

[+ Add Journey]

─────────────────────────────────────────────────
JOURNEY 1: Joining TFFP
─────────────────────────────────────────────────
How does this start?
  ● Someone sends a specific keyword: [join]
  ○ Scheduled message
  ○ PM triggers it manually

Describe what should happen, step by step:
┌─────────────────────────────────────────────────────────┐
│ They send 'join'. We welcome them and ask which type    │
│ of practitioner they are. Then ask their preferred      │
│ language. Then collect their name and location via a    │
│ form. Confirm registration and tell them what to expect │
│ — weekly content every Wednesday, PM will be in touch.  │
└─────────────────────────────────────────────────────────┘

What data do we collect in this journey?
  [+ Add field]
  ● Role (dropdown: Anganwadi Worker, Preschool Teacher, Parent, Home-based)
  ● Language (dropdown: Khasi, Garo, Pnar, English)
  ● Name (text, required)
  ● Location — village or block (text)
  ● Centre or school name (text, optional)

What happens at the end?
  ● Add to group: tffp-[their role]
  ● Notify PM: new registration

[AI: Generate flow preview →]
```

Flow preview shows the generated conversation as a visual chat mockup:

```
FLOW PREVIEW — Joining TFFP

Bot: "Welcome to TFFP! We support ECCE practitioners across
     Meghalaya. What best describes you?"
     [Anganwadi Worker] [Preschool Teacher] [Parent] [Home-based]

User taps: Anganwadi Worker

Bot: "Which language do you prefer?"
     [Khasi] [Garo] [Pnar] [English]

User taps: Khasi

Bot: [Opens WhatsApp Form]
     Name: ___
     Village or Block: ___
     Centre or school name (optional): ___
     [Submit]

Bot: "You're registered! Every Wednesday you'll receive learning
     materials. Your programme manager Daphisha will be in touch."

→ Added to group: tffp-anganwadi
→ PM notified: "New registration: [name], [location]"

[Looks good — Save Journey] [Edit]
```

```
─────────────────────────────────────────────────
JOURNEY 2: Weekly Content Delivery
─────────────────────────────────────────────────
How does this start?
  ○ Keyword
  ● Scheduled: Every Wednesday at 10:00am

Describe what should happen:
┌─────────────────────────────────────────────────────────┐
│ Send this week's content to all active practitioners.   │
│ Content comes from our Google Sheet — the week number   │
│ matches the current week. Send to all groups.           │
└─────────────────────────────────────────────────────────┘

Content source: [Google Sheet] Sheet ID: ___

[AI: Generate schedule preview →]
```

```
─────────────────────────────────────────────────
JOURNEY 3: Open Conversation (anything else)
─────────────────────────────────────────────────
How does this start?
  ● Any inbound message that isn't part of another journey

Describe what should happen:
┌─────────────────────────────────────────────────────────┐
│ Route to the PM inbox. Before it reaches the PM,        │
│ translate the message to English if it's in Khasi/Garo/ │
│ Pnar, and suggest a response for the PM to use or edit. │
└─────────────────────────────────────────────────────────┘

PM response time target: 24 hours

[AI: Generate handoff flow →]
```

#### Step 4: Define Your Data and Reports

```
WHAT DO YOU WANT TO TRACK?

From journeys (auto-detected):
  ✓ Registrations — name, role, language, location, date
  ✓ Monthly check-in responses
  ✓ Inbound message topics (AI-extracted)

Add more:
  [+ Add tracked metric]

WHAT REPORTS DO YOU NEED?

  ● Weekly PM digest (auto, every Sunday) — who engaged, who didn't
  ● Monthly MIS snapshot — registrations, check-in completion, top topics
  ○ Quarterly narrative report
  ○ Annual impact report

DASHBOARD

  Internal (PM login):
    ✓ Active practitioners
    ✓ Weekly content reach
    ✓ Inactive 14+ days
    ✓ Check-in completion rate
    ✓ Top topics this month

  Public (no login):
    ✓ Total practitioners reached
    ✓ Content weeks delivered
    ✓ Districts covered
    ○ (add metric)
```

#### Step 5: Review and Deploy

```
DEPLOYMENT CHECKLIST

  ✓ Program description — complete
  ✓ User types defined — 2 types
  ✓ Journeys defined — 4 journeys, 12 steps
  ✓ Data schema — 6 contact fields, 1 MIS table
  ✓ Content library connected — Google Sheet linked
  ✓ PM assigned — Daphisha (+91XXXXXXXXXX)
  ✓ WhatsApp number assigned — +91XXXXXXXXXX (Gupshup)
  
  ⚠ WhatsApp templates — 2 need Gupshup approval (est. 24–48hrs)
  ⚠ Review generated flows before going live

WHAT WILL BE DEPLOYED

  Glific:
    → 4 contact groups created
    → 6 custom contact fields added
    → 3 flows created and published
    → PM staff account set up
    → Broadcast schedule configured

  Gupshup:
    → 2 message templates submitted for approval
    → 1 WhatsApp Form created (registration)
    → 1 WhatsApp Form created (monthly check-in)
    → Webhook callback URL configured

  Database:
    → tffp_checkins table created
    → Contact fields mapped

  Dashboard:
    → TFFP internal dashboard view created
    → Public metrics added to public dashboard

[Download config JSON] [Send to developer for review] [Deploy →]
```

---

## 4. Config → Deploy Engine

The engine that converts a program config into deployed artifacts. This is the technical core of the platform.

### 4.1 Architecture

```
Program Config JSON
        │
        ▼
┌────────────────────────────────────────────────────┐
│                  ENGINE PIPELINE                   │
│                                                    │
│  1. VALIDATE        Check config completeness      │
│                     Check all required env vars    │
│                     Check WhatsApp number active   │
│                                                    │
│  2. LLM PROCESS     Journey descriptions → logic   │
│                     Plain English steps → formal   │
│                     flow specification             │
│                                                    │
│  3. GENERATE        Flow spec → Glific flow JSON   │
│                     Form spec → Gupshup Form JSON  │
│                     Data spec → SQL migration      │
│                     Dashboard spec → view config   │
│                                                    │
│  4. PREVIEW         Human-readable preview of all  │
│                     artifacts before any push      │
│                                                    │
│  5. DEPLOY          Push to each target system     │
│                     Verify each deployment         │
│                     Roll back on any failure       │
│                                                    │
│  6. MONITOR         Confirm flows are live         │
│                     Send test message through      │
│                     Report deployment status       │
└────────────────────────────────────────────────────┘
```

### 4.2 LLM Processing Layer

For each journey step described in plain language, the LLM converts it to a formal flow specification:

**Input (from Studio):**
```
"They send 'join'. We welcome them and ask which type of practitioner 
they are. Then ask their preferred language. Then collect their name 
and location via a form. Confirm registration."
```

**LLM prompt:**
```
System:
You convert WhatsApp program journey descriptions into structured flow 
specifications for the OESN platform. Output JSON only.

A flow spec has:
  nodes: array of steps, each with:
    id, type, content/options/fields, next_node, conditions
  
Node types: message | quick_reply | whatsapp_form | broadcast | 
            ai_process | human_handoff | webhook | condition

Rules:
- Every user input must save to a contact field or MIS table
- Forms must be WhatsApp Forms (Gupshup), not sequential questions
- Group assignments and notifications happen at the end of flows
- Never collect sensitive data (ID numbers, financial details) in flows

Program context: {{program_json}}
Journey description: {{journey_description}}
Data fields to collect: {{data_fields}}

Convert to flow spec JSON.
```

**Output (flow spec):**
```json
{
  "flow_id": "tffp_onboarding",
  "trigger": {"type": "keyword", "value": "join"},
  "nodes": [
    {
      "id": "welcome_message",
      "type": "quick_reply",
      "content": "Welcome to TFFP! We support ECCE practitioners across Meghalaya. What best describes you?",
      "options": [
        {"label": "Anganwadi Worker", "value": "anganwadi_worker", "next": "language_select"},
        {"label": "Preschool Teacher", "value": "preschool_teacher", "next": "language_select"},
        {"label": "Parent", "value": "parent", "next": "language_select"},
        {"label": "Home-based Caregiver", "value": "home_based", "next": "language_select"}
      ],
      "saves_to": "contact.subtype"
    },
    {
      "id": "language_select",
      "type": "quick_reply",
      "content": "Which language do you prefer?",
      "options": [
        {"label": "Khasi", "value": "khasi", "next": "registration_form"},
        {"label": "Garo", "value": "garo", "next": "registration_form"},
        {"label": "Pnar", "value": "pnar", "next": "registration_form"},
        {"label": "English", "value": "english", "next": "registration_form"}
      ],
      "saves_to": "contact.language"
    },
    {
      "id": "registration_form",
      "type": "whatsapp_form",
      "form_id": "tffp_registration",
      "next": "confirmation"
    },
    {
      "id": "confirmation",
      "type": "message",
      "content": "You're registered! Every Wednesday you'll receive learning materials. Your programme manager will be in touch.",
      "post_actions": [
        {"type": "add_to_group", "group": "tffp-{{contact.subtype}}"},
        {"type": "notify_pm", "template": "new_registration"}
      ]
    }
  ]
}
```

This flow spec then feeds the Glific flow generator (next step).

### 4.3 Glific Flow Generator

Converts flow spec JSON → Glific-compatible RapidPro flow JSON.

This is the piece that was previously broken when trying to import JSON manually. The difference here: the engine exports an **existing flow from Glific** first to use as a version-locked template, then generates new flows in that exact format. No version mismatch.

```python
class GlificFlowGenerator:
    def __init__(self, glific_client):
        self.client = glific_client
        # Export a known-working flow to use as format reference
        self.template = self.client.export_reference_flow()
    
    def generate(self, flow_spec: dict) -> dict:
        """Convert flow spec to Glific-importable JSON"""
        flow = {
            "version": self.template["version"],  # Use live version
            "flows": [self._build_flow(flow_spec)],
            "campaigns": [],
            "triggers": [self._build_trigger(flow_spec["trigger"])]
        }
        return flow
    
    def deploy(self, flow_json: dict) -> str:
        """Push via GraphQL API — not the broken import UI"""
        return self.client.graphql("""
            mutation ImportFlow($flow: String!) {
                importFlow(flow: $flow) {
                    status
                    errors { key message }
                }
            }
        """, variables={"flow": json.dumps(flow_json)})
```

### 4.4 Gupshup Form Generator

Converts form field specs → Gupshup WhatsApp Flow Builder API calls.

```python
class GupshupFormGenerator:
    def generate_and_deploy(self, form_spec: dict) -> str:
        screens = self._build_screens(form_spec["fields"])
        flow = {
            "version": "3.0",
            "screens": screens
        }
        # POST to Gupshup Flow API
        response = self.gupshup_client.create_flow(
            name=form_spec["id"],
            flow=flow
        )
        return response["flow_id"]
    
    def _build_screens(self, fields):
        # Group fields into screens (max 5 fields per screen)
        # Map field types: text→TextInput, enum→RadioButtons,
        #                  multiselect→CheckboxGroup, date→DatePicker
        ...
```

### 4.5 Database Migration Generator

Converts data schema spec → SQL migration file, auto-applied on deployment.

```python
def generate_migration(program_id: str, schema_spec: dict) -> str:
    sql = []
    
    # Contact fields → stored in Glific via API
    for field in schema_spec["contact_fields"]:
        sql.append(f"-- Contact field: {field['key']} added to Glific via API")
    
    # MIS tables → created in platform database
    for table in schema_spec["mis_tables"]:
        columns = "\n  ".join([
            f"{f} TEXT" for f in table["fields"]
        ])
        sql.append(f"""
CREATE TABLE IF NOT EXISTS mis_{program_id}_{table['id']} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  {columns},
  created_at TIMESTAMPTZ DEFAULT now()
);
        """)
    
    return "\n".join(sql)
```

### 4.6 Dashboard View Generator

Converts dashboard spec → Metabase dashboard configuration (or equivalent).

For each metric defined in the program config, the engine creates:
- A Metabase question (SQL query)
- A card on the program's dashboard
- Public embedding config if marked `visible: true`

```python
METRIC_TEMPLATES = {
    "active_practitioners": """
        SELECT COUNT(*) FROM contacts 
        WHERE program = '{program_id}' AND active = true
    """,
    "weekly_content_reach": """
        SELECT COUNT(DISTINCT contact_id) FROM message_logs
        WHERE program = '{program_id}' 
        AND flow_id = 'weekly_content'
        AND sent_at > NOW() - INTERVAL '7 days'
    """,
    "inactive_14_days": """
        SELECT COUNT(*) FROM contacts
        WHERE program = '{program_id}'
        AND last_message_at < NOW() - INTERVAL '14 days'
    """
}
```

### 4.7 Deployment State Machine

Every deployment is tracked with rollback capability:

```
PENDING → VALIDATING → GENERATING → PREVIEWING → DEPLOYING → LIVE
                                                      │
                                                   FAILED → ROLLING_BACK → ROLLED_BACK
```

Each step is logged. If Gupshup form creation succeeds but Glific flow creation fails, the Gupshup form is deleted before reporting failure. No half-deployed programs.

---

## 5. Runtime Platform

Built once. Shared infrastructure that all program configs deploy into.

### 5.1 Components

| Component | Technology | Purpose |
|---|---|---|
| **API Server** | Python FastAPI | Config ingestion, deployment orchestration, MIS data |
| **Database** | PostgreSQL | All program data, MIS tables, deployment state |
| **File Storage** | Cloudflare R2 | Content library media, form uploads |
| **Job Queue** | BullMQ (Redis) | Scheduled broadcasts, report generation, AI processing |
| **Glific** | Managed cloud or self-hosted | WhatsApp CRM, inbox, flows, broadcasts |
| **Gupshup** | Existing account | WhatsApp delivery, WhatsApp Forms |
| **AI Layer** | Claude API (Haiku) + Google Translate | Translation, extraction, response suggestions |
| **Dashboard** | Metabase | Internal MIS and public dashboard |
| **Program Studio** | React web app | Program configuration UI |

### 5.2 Multi-Program Isolation

All programs share the same runtime but are isolated in data:

- Every contact record is tagged with `program_id`
- Glific contacts have a `program` custom field
- MIS tables are namespaced: `mis_tffp_checkins`, `mis_cmyc_attendance`
- Dashboard views are scoped to `program_id`
- PM accounts in Glific only see their program's contacts
- WhatsApp numbers may be shared (routed by keyword) or dedicated per program

### 5.3 Inbound Message Router

Every inbound WhatsApp message from Gupshup hits one webhook endpoint:

```python
@app.post("/webhook/inbound")
async def inbound_message(payload: GupshupWebhookPayload):
    phone = payload.sender.phone
    message = payload.text
    
    # 1. Identify contact and their program
    contact = await db.get_contact_by_phone(phone)
    
    # 2. Check if they're in an active flow
    if await flow_engine.is_in_flow(phone):
        await flow_engine.continue_flow(phone, message)
        return
    
    # 3. Check for keyword triggers across all programs
    for program in await db.get_active_programs():
        if triggers_journey(message, program):
            await flow_engine.start_journey(phone, program, message)
            return
    
    # 4. Default: AI assist + route to PM inbox
    await ai_layer.process_and_route(contact, message)
```

### 5.4 AI Processing Layer

Runs on every inbound message not handled by a flow:

```python
async def process_and_route(contact, message):
    # Translate if needed
    if contact.language in ["khasi", "garo", "pnar"]:
        translation = await google_translate(message, target="en")
    else:
        translation = message
    
    # Extract structured signals
    signals = await claude_extract(translation, contact.program)
    # signals: {topic, sentiment, need_detected, urgency}
    
    # Suggest PM response
    suggestion = await claude_suggest_response(
        message=translation,
        contact=contact,
        signals=signals
    )
    
    # Write to MIS
    await db.log_conversation_signal(contact, signals)
    
    # Route to PM inbox (Glific) with context attached
    await glific.route_to_pm_inbox(
        contact=contact,
        message=message,
        translation=translation,
        signals=signals,
        suggestion=suggestion
    )
```

---

## 6. How Each Program Maps to the Engine

### TFFP (ECCE Pathway)

| Config element | Value |
|---|---|
| Journeys | Onboarding, weekly content, monthly check-in, open conversation |
| Forms | Registration (onboarding), check-in (monthly) |
| Broadcasts | Weekly content — driven by Google Sheet |
| AI role | Translation (Khasi/Garo/Pnar → English), topic extraction, PM response suggestions |
| Human in loop | PM handles all open conversation in Glific inbox |
| MIS | Engagement rates, topics arising, inactive contacts |

### CMYC

| Config element | Value |
|---|---|
| Journeys | Member registration, component selection, weekly updates, issue reporting |
| Forms | Registration, monthly activity check-in per component |
| Broadcasts | Centre-level weekly updates, event announcements |
| AI role | Translation, attendance pattern signals, issue severity extraction |
| Human in loop | Centre manager + programme manager |
| MIS | Attendance, component participation, issues, expense utilisation |
| Special | Centre manager app (separate from WhatsApp layer — see CMYC-TECH-SPEC.md) |

CMYC is **two systems in one config**: the WhatsApp communication layer (handled by this engine) and the centre management app (a separate build — see `CMYC-TECH-SPEC.md`). They share the same database and contact records.

### OESN / Doorstep Incubation

| Config element | Value |
|---|---|
| Journeys | Entrepreneur discovery, intake form, status updates, outcome notifications |
| Forms | Doorstep intake (name, location, sector, stage, needs) |
| Broadcasts | Service completion notifications, opportunity alerts |
| AI role | Needs signal extraction from open messages, referral status summaries |
| Human in loop | Programme manager for complex queries |
| MIS | Entrepreneur profiles, needs map, referral outcomes |
| Special | Full OESN agent and provider system (see OESN-TECH-SPEC.md) |

The WhatsApp layer here is **the entrepreneur-facing channel** of OESN. The agent app is separate.

### Any New Program

1. Programme team opens Program Studio
2. Fills in 5 steps (program description, users, journeys, data, dashboard)
3. AI generates and previews all artifacts
4. Developer reviews the generated config JSON (30 minutes, not 3 weeks)
5. Deploy → live in hours

---

## 7. Program Studio — Technical Build Spec

### 7.1 Tech Stack

```
Frontend:  React + TypeScript
           TailwindCSS
           React Flow (for visual journey mapping)
           Monaco Editor (for JSON config review)

Backend:   FastAPI (Python) — same runtime as platform API
Database:  PostgreSQL — program_configs table + deployment_logs

Auth:      Google OAuth (Sauramandala org accounts)
Hosting:   Same infrastructure as platform
```

### 7.2 Database

```sql
CREATE TABLE program_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      TEXT UNIQUE NOT NULL,
  config          JSONB NOT NULL,
  version         INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'draft',  -- draft | review | deployed | archived
  created_by      UUID,
  last_modified   TIMESTAMPTZ DEFAULT now(),
  deployed_at     TIMESTAMPTZ
);

CREATE TABLE deployment_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      TEXT NOT NULL,
  config_version  INTEGER NOT NULL,
  status          TEXT,  -- pending | validating | generating | deploying | live | failed | rolled_back
  steps           JSONB, -- per-step status: glific, gupshup, database, dashboard
  error           TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE generated_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      TEXT NOT NULL,
  artifact_type   TEXT,  -- glific_flow | gupshup_form | sql_migration | dashboard_view
  artifact_id     TEXT,  -- ID in the target system
  config          JSONB,
  deployed_at     TIMESTAMPTZ DEFAULT now()
);
```

### 7.3 Studio API Endpoints

```
POST   /studio/programs              Create new program config (draft)
GET    /studio/programs              List all programs (with status)
GET    /studio/programs/:id          Get program config
PATCH  /studio/programs/:id          Update program config
POST   /studio/programs/:id/validate Validate config (pre-deploy check)
POST   /studio/programs/:id/preview  Generate artifacts preview (no deploy)
POST   /studio/programs/:id/deploy   Full deployment
GET    /studio/programs/:id/status   Deployment status (poll during deploy)
POST   /studio/programs/:id/rollback Rollback deployment
GET    /studio/journeys/suggest      AI: convert journey description to flow spec
GET    /studio/templates             Pre-built program templates to start from
```

---

## 8. Pre-Built Templates

The Studio ships with templates that programme teams can start from and customise:

| Template | Description | Journeys included |
|---|---|---|
| **Content Delivery Program** | Weekly content to a subscriber community | Opt-in, weekly broadcast, monthly check-in, open conversation |
| **Weekly Reporting Program** | Team submits structured weekly reports | Reminder trigger, report form, PM digest |
| **Intake and Onboarding** | Register new participants, collect profile data | Discovery, registration form, intake questionnaire, PM assignment |
| **Field Agent CRM** | Agents register and update records in the field | Agent onboarding, client registration, status updates |
| **Event and Activity Tracker** | Community events with registration and attendance | Event announcement, RSVP, attendance marking, follow-up |
| **Issue and Feedback Channel** | Community members report issues or give feedback | Inbound message → categorise → PM inbox → resolution notify |

Each template is a valid program config JSON. Programme team edits it in the Studio to fit their program.

---

## 9. Phased Build Plan

### Phase 1 — Runtime Platform Core (Weeks 1–6)
**Goal:** The runtime infrastructure that all programs deploy into is live and stable.

- [ ] API server scaffold (FastAPI)
- [ ] PostgreSQL schema (contacts, programs, MIS framework, deployment logs)
- [ ] Glific GraphQL client (flows, contacts, groups, broadcasts)
- [ ] Gupshup API client (send messages, create forms, manage webhooks)
- [ ] Inbound message router (webhook → flow engine → PM inbox)
- [ ] AI processing layer (translate + extract + suggest)
- [ ] Job queue for scheduled broadcasts and reports (BullMQ)
- [ ] TFFP manually configured as first program (validates the runtime before Studio exists)

**Deliverable:** TFFP fully live — practitioners can register, receive weekly content, and PM manages conversations in Glific inbox. All via manually-written config JSON.

### Phase 2 — Config Engine (Weeks 7–12)
**Goal:** Program configs can be validated, converted, and deployed programmatically.

- [ ] Config JSON schema and validator
- [ ] Glific flow generator (flow spec → RapidPro JSON → deploy via GraphQL)
- [ ] Gupshup form generator (form spec → WhatsApp Flow → deploy via API)
- [ ] Database migration generator (schema spec → SQL → apply)
- [ ] Dashboard view generator (metric specs → Metabase API → create views)
- [ ] Deployment state machine with rollback
- [ ] CMYC WhatsApp layer deployed as second config (validates multi-program)
- [ ] OESN/Doorstep WhatsApp layer deployed as third config

**Deliverable:** All three programs deployed via config. New program deployment takes hours not weeks.

### Phase 3 — Program Studio UI (Weeks 13–20)
**Goal:** Non-technical programme teams can create and deploy programs without developer help.

- [ ] Studio UI scaffold (React)
- [ ] Step 1: Program description form
- [ ] Step 2: User type definition
- [ ] Step 3: Journey builder (plain language → AI flow preview → visual chat mockup)
- [ ] Step 4: Data and reports configuration
- [ ] Step 5: Review and deploy UI (checklist, generated artifact preview, deploy button)
- [ ] Deployment status live view (per-step progress)
- [ ] Pre-built templates library (6 templates)
- [ ] Program config version history and rollback UI

**Deliverable:** Programme team can create and deploy a new program without a developer. End-to-end in one day.

### Phase 4 — Scale and Intelligence (Weeks 21–28)
**Goal:** The platform learns from deployed programs and gets smarter over time.

- [ ] Cross-program insights: what journey patterns work best (engagement, completion)
- [ ] AI journey optimiser: suggest improvements based on drop-off data
- [ ] A/B flow testing: deploy two versions of a journey, measure outcomes
- [ ] Programme analytics: compare programs on shared metrics
- [ ] Bulk program operations: update all programs when runtime changes
- [ ] Mobile Studio: create and monitor programs from phone
- [ ] Exported program configs shareable with other organisations

---

## 10. Open Questions Before Build Starts

1. **Glific hosting:** Managed Glific cloud or self-hosted? Affects API access and rate limits.
2. **Single WhatsApp number or one per program?** One number with keyword routing is simpler. Separate numbers per program gives cleaner UX but higher cost.
3. **Program Studio access:** Who can create programs? Only Sauramandala staff, or will other orgs eventually use this platform?
4. **Config version control:** Store in git (developer workflow) or in-database only (Studio workflow)? Recommend: both — Studio writes to DB, DB syncs to git.
5. **Metabase vs custom dashboard:** Metabase is fast to set up but less customisable. A custom React dashboard gives full control but is more build. Recommend: Metabase for Phase 1–2, custom if needed in Phase 3+.
6. **LLM for journey conversion:** Claude is recommended. Which API tier — Haiku (fast, cheap) for extraction, Sonnet for journey-to-flow conversion (more nuanced)?
7. **Multi-org future:** Is this platform only for Sauramandala, or eventually a product for other NGOs? This affects how programs are isolated and whether the Studio needs multi-tenancy.
