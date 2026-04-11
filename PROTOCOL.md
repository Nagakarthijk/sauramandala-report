# Doorstep Incubation Protocol (DIP)

**Version:** 0.1.0 — Living Document  
**Status:** Active Development  
**Repository:** nagakarthijk/sauramandala-report  
**Branch:** `claude/doorstep-incubation-protocol-31r3g`  
**Maintained by:** Sauramandala Foundation  
**Last Updated:** April 2026

---

## Vision

> _Anyone, anywhere should be able to find an entrepreneur in their community, understand their business problems, and connect them to the right vendors and services — all from a doorstep visit._

The Doorstep Incubation Protocol (DIP) is an **open, AI-augmented network protocol** for grassroots business incubation. It is inspired by the Beckn Protocol's open-network philosophy but built specifically for the realities of rural and semi-urban entrepreneurship in India's northeast.

Unlike traditional incubators that require entrepreneurs to travel to hubs, apply through formal processes, or have existing digital literacy — DIP brings the incubation process **to the entrepreneur** — at their home, farm, or workshop.

---

## Why This Exists

Sauramandala Foundation's PSREF programme (Prime-Sauramandala Rural Entrepreneurship Fellowship) has met 420+ potential entrepreneurs across 12 field units in Meghalaya. These entrepreneurs share common barriers:

- **No market access** beyond their immediate community
- **No digital presence** or the skills to build one
- **Regulatory opacity** — unaware of which licences, schemes, or certifications they qualify for
- **Vendor blindness** — no visibility into platforms, APIs, or services that could help
- **Isolation** — no peer network, no mentor, no support structure

DIP is the protocol that systematises how we close these gaps — at scale — through a combination of **human field agents** and **AI orchestration**, with humans staying in control at every key decision point.

---

## Protocol Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   DOORSTEP INCUBATION PROTOCOL                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SEEKERS              AI ORCHESTRATION         PROVIDERS       │
│   (Entrepreneurs)      (Agents + Humans)        (Vendors)       │
│                                                                 │
│   ┌──────────┐    ┌───────────────────────┐   ┌─────────────┐  │
│   │ Weaver   │───▶│  Problem Diagnosis    │──▶│  Meesho     │  │
│   │ Farmer   │    │  Vendor Matching      │   │  (Platform) │  │
│   │ Brewer   │    │  Incubation Planning  │   └─────────────┘  │
│   │ Artisan  │    │  ✅ Human Checkpoint  │   ┌─────────────┐  │
│   └──────────┘    └───────────┬───────────┘──▶│  KVIC Govt  │  │
│         ▲                     │               └─────────────┘  │
│         │          ┌──────────┴──────────┐   ┌─────────────┐  │
│   ┌─────┴──────┐   │   Human Field Agent  │──▶│  NABARD MFI │  │
│   │ Field      │──▶│   (Doorstep Visit)  │   └─────────────┘  │
│   │ Agent App  │   └─────────────────────┘   ┌─────────────┐  │
│   └────────────┘                          ──▶│  Shiprocket │  │
│                                               │  (API)      │  │
│                                               └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Network Participants

| Role | Who | What They Do |
|------|-----|-------------|
| **Seeker** | Rural/semi-urban entrepreneur | Has a business; describes their problems and needs |
| **Field Agent** | Human (SMF staff, CMYC fellow, volunteer) | Visits entrepreneur, captures profile via Field Agent App |
| **AI Orchestrator** | Gemini AI (gemini-2.0-flash) | Diagnoses problems, matches vendors, writes incubation plan |
| **Human Checkpoint** | SMF coordinator / field lead | Reviews and approves AI suggestions before action |
| **Provider / Vendor** | Any service, platform, API, government scheme | Delivers a solution to the entrepreneur's problem |

### Provider Types

| Type | Examples | How They Connect |
|------|----------|-----------------|
| `platform` | Meesho, GoCoop, Craftsvilla, Dukaan | Online self-registration |
| `api` | Razorpay, Shiprocket, WhatsApp Business | API integration or app setup |
| `in-person` | FSSAI consultant, packaging designer, trainer | Field agent facilitates visit |
| `government` | KVIC, Startup India, NABARD, FSSAI | Application via field agent or CSC |
| `financial` | NABARD SHG, local MFI, cooperative bank | Field agent introduction + KYC |

---

## Protocol Stages

### Stage 1 — DISCOVER 🚶
**Actor:** Human Field Agent  
**Where:** Entrepreneur's location (home / farm / workshop)  
**Tool:** `field-agent.html` intake form  
**What happens:**
- Agent identifies entrepreneur through community referral or CMYC network
- Captures profile: identity, location, sector, business, problems, resources
- Obtains informed consent (documented in form)

**Human Checkpoint:** Agent validates identity and consent before submitting

---

### Stage 2 — DIAGNOSE 🔍
**Actor:** AI Agent + Human Review  
**Tool:** `ai-match.html`  
**What happens:**
- AI reads entrepreneur profile and problems
- Diagnoses root causes (not just surface symptoms)
- Categorises needs using the Needs Taxonomy (see below)
- Prioritises by urgency and feasibility

**Output:** Structured problem diagnosis  
**Human Checkpoint:** SMF coordinator reviews AI diagnosis; can edit before proceeding

---

### Stage 3 — MATCH 🔗
**Actor:** AI Agent + Human Approval  
**Tool:** `ai-match.html`  
**What happens:**
- AI queries vendor network against diagnosed needs
- Ranks vendors by relevance, accessibility, cost, and entrepreneur readiness
- Explains reasoning for each recommendation
- Generates top 3–5 vendor recommendations

**Output:** Prioritised vendor shortlist with reasoning  
**Human Checkpoint:** Coordinator approves vendor list; can substitute vendors

---

### Stage 4 — INCUBATE 🌱
**Actor:** Vendor + Entrepreneur + Field Agent (facilitator)  
**Where:** Entrepreneur's location or via phone/WhatsApp  
**What happens:**
- Field agent facilitates first contact between entrepreneur and vendor
- Vendor onboards entrepreneur to platform / begins service delivery
- Agent documents what happened and any blockers

**Human Checkpoint:** Field agent confirms engagement happened and logs outcome

---

### Stage 5 — EVALUATE 📊
**Actor:** Field Agent + AI + Entrepreneur  
**What happens:**
- 30/60/90-day check-ins on progress
- Document: revenue change, problem resolution, remaining gaps
- AI identifies patterns across incubations for protocol improvement
- Graduate entrepreneur or escalate stalled cases

**Output:** Outcome record in protocol log  
**Human Checkpoint:** Entrepreneur confirms outcome (consent-based)

---

## Needs Taxonomy

Problems entrepreneurs face, mapped to vendor categories:

| Need Tag | What It Means | Relevant Vendor Types |
|----------|-------------|----------------------|
| `e-commerce` | Needs online selling channel | platform, api |
| `branding` | Needs brand name, logo, story | in-person |
| `packaging` | Needs product packaging design/print | in-person |
| `food-license` | Needs FSSAI or state food licence | government, in-person |
| `compliance` | Needs regulatory guidance | government, in-person |
| `logistics` | Needs shipping / delivery solution | api, in-person |
| `payments` | Needs digital payment acceptance | api |
| `cold-chain` | Needs cold storage / refrigerated transport | in-person, government |
| `buyer-access` | Needs direct access to buyers | platform |
| `working-capital` | Needs credit or loan | financial |
| `capacity-building` | Needs production scale-up support | government, in-person |
| `digital-literacy` | Needs help going online for first time | in-person |
| `certification` | Needs quality/organic/GI certification | government |
| `distribution` | Needs wholesale/distribution channel | platform, in-person |
| `pricing-strategy` | Needs help pricing competitively | in-person |

---

## Data Schemas

### Entrepreneur Profile
```json
{
  "id": "E001",
  "name": "string",
  "age": "number",
  "gender": "Male | Female | Other | Prefer not to say",
  "location": "string (district, state)",
  "sector": "string (from sector taxonomy)",
  "business": "string (name / description)",
  "story": "string (narrative from field agent)",
  "problems": ["array of problem strings in agent's own words"],
  "needs": ["array of need tags from Needs Taxonomy"],
  "resources": {
    "phone": "boolean",
    "bankAccount": "boolean",
    "internet": "none | limited | good"
  },
  "capturedBy": "string (field agent name)",
  "capturedAt": "ISO date string (YYYY-MM-DD)",
  "status": "pending-match | matched | in-incubation | graduated | stalled"
}
```

### Vendor Profile
```json
{
  "id": "V001",
  "name": "string",
  "type": "platform | api | in-person | government | financial",
  "sectors": ["array of sector tags, or 'any'"],
  "description": "string",
  "connect": "string (how to engage — URL, phone, referral)",
  "contact": "string (optional)",
  "tags": ["array of capability / need tags"],
  "impact": "string (optional — track record or scale)"
}
```

### Match Record
```json
{
  "id": "M001",
  "entrepreneurId": "E001",
  "entrepreneurName": "string",
  "problemStatement": "string (what was submitted to AI)",
  "aiDiagnosis": "string (AI-generated diagnosis)",
  "vendorMatches": [
    {
      "vendorId": "V001",
      "vendorName": "string",
      "reasoning": "string",
      "priority": 1
    }
  ],
  "incubationPlan": "string (AI-generated step-by-step plan)",
  "humanCheckpoints": ["array of checkpoint descriptions"],
  "createdAt": "ISO datetime string",
  "createdBy": "string (agent/user name)",
  "status": "proposed | approved | active | completed | stalled"
}
```

---

## Sector Taxonomy

| Code | Label | Example Businesses |
|------|-------|-------------------|
| `textiles` | Textiles & Weaving | Eri silk, Jainsem, cotton handloom |
| `food` | Food Processing | Jams, pickles, processed snacks |
| `beverages` | Beverages | Rice wine, herbal drinks, juices |
| `agriculture` | Agriculture & Farming | Organic ginger, turmeric, vegetables |
| `handicrafts` | Handicrafts & Jewellery | Bamboo, bone, cane, glass jewellery |
| `services` | Services | Tailoring, beauty, phone repair |
| `livestock` | Livestock & Dairy | Poultry, piggery, dairy farming |
| `education` | Education & Content | Tutoring, storybooks, digital content |

---

## Tech Stack

### v0.1 (Current)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | HTML + Tailwind CSS (CDN) | Zero build step. Works offline. Deploy anywhere. |
| AI | Google Gemini 2.0 Flash | Fast, generous free tier, multimodal |
| Persistence | Browser `localStorage` | No backend required for field testing |
| Hosting | GitHub Pages | Free, instant deploy from `main` branch |
| Protocol Brain | `PROTOCOL.md` (this file) | Version-controlled living document |
| Shared Data | `dip-network.js` | Vendor registry + shared functions |

### v1.0 (Target Architecture)

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | Supabase (Postgres + Auth + Realtime) | Real multi-agent sync, auth, cloud storage |
| Protocol | ONDC / Beckn-compatible network layer | Open, interoperable with national commerce network |
| Mobile | Progressive Web App (PWA) | Works offline in low-connectivity field conditions |
| Offline | IndexedDB | Capture entrepreneurs with zero connectivity |
| Messaging | WhatsApp Business API | Share incubation plans with entrepreneurs via WhatsApp |
| Language | i18n support | Khasi, Garo, Bodo, Hindi, English |

---

## File Structure

```
sauramandala-report/
├── index.html                    # Sauramandala Foundation annual report
├── AR2324.html                   # 2023-24 annual report
├── PROTOCOL.md                   # ← This file. The living brain.
├── dip-network.js                # Shared data layer & functions
├── doorstep-incubation.html      # Protocol overview landing page
├── field-agent.html              # Human agent intake tool (doorstep capture)
├── entrepreneur-directory.html   # Entrepreneur + vendor directory
└── ai-match.html                 # AI matchmaker (diagnosis + plan)
```

---

## Protocol Principles

1. **Doorstep First** — The protocol must work for an entrepreneur with no internet, no smartphone, no ability to travel. The field agent bridges every gap.

2. **Human-in-the-Loop Always** — AI suggests; humans decide. No vendor connection is made without a human reviewing and approving it. The AI is an accelerator, not an authority.

3. **Open Network** — Any vendor can join the network. Any trained field agent can use the protocol. No gatekeeping, no exclusivity.

4. **Evidence-Led** — Every incubation is documented. Outcomes are tracked. The protocol improves based on what actually works, not assumptions.

5. **Dignity by Default** — Entrepreneurs are not beneficiaries receiving charity. They are entrepreneurs. The protocol and its agents treat them as capable adults building businesses.

---

## Build Log

### v0.1.0 — April 2026
- [x] Protocol vision, architecture, and principles documented
- [x] `dip-network.js` — shared data layer with 15 vendors, 5 seed entrepreneurs
- [x] `doorstep-incubation.html` — protocol overview landing page
- [x] `field-agent.html` — human agent intake tool (4-step form)
- [x] `entrepreneur-directory.html` — searchable directory with vendor browser
- [x] `ai-match.html` — AI matchmaker with Gemini 2.0 Flash
- [x] `index.html` updated — link to DIP from main foundation site
- [x] localStorage-based data persistence (no backend needed)
- [x] Human-in-the-loop checkpoints in AI output

---

## Roadmap

```
Q2 2026 — v0.1  FOUNDATION
                Protocol documented. Static app live.
                5 seed entrepreneurs. 15 vendors. Field testing begins.

Q3 2026 — v0.2  FEEDBACK LOOP
                Outcome tracking (30/60/90 day check-ins).
                Vendor self-registration form.
                WhatsApp share for incubation plans.
                Offline mode via IndexedDB.
                PWA manifest for home screen install.

Q4 2026 — v0.3  SCALE
                Supabase backend — real sync across field agents.
                Agent authentication and roles.
                Multi-language: Khasi, Garo, Hindi.
                SMS-based entrepreneur registration (no smartphone).

Q1 2027 — v1.0  NETWORK
                Beckn/ONDC protocol integration.
                3-state rollout: Meghalaya, Assam, Nagaland.
                Open API for partner organisations.
                Policy brief for state government replication.
```

---

## Contributing

This is an open protocol. You can contribute by:

**Adding Vendors**
Know a platform, service, or government scheme that helps rural entrepreneurs? Open a PR and add it to `dip-network.js` following the vendor schema above.

**Documenting Outcomes**
When an incubation succeeds or fails, document what happened in the issues or as a match record. This builds the protocol's learning.

**Improving the AI Prompt**
The AI matchmaker is only as good as its prompt. Test it with different entrepreneur profiles and refine the prompt in `ai-match.html`.

**Translating**
Help make the field agent tool work in Khasi, Garo, Bodo, or Hindi. Translations go in a `/lang/` folder.

**Opening Issues**
Use GitHub Issues (`nagakarthijk/sauramandala-report`) to report gaps, suggest vendors, or propose protocol changes.

---

## Questions This Protocol Is Still Working Through

- How do we verify vendor quality before connecting them to vulnerable entrepreneurs?
- What happens when an AI match is wrong? How is that fed back into the protocol?
- How do field agents stay accountable without creating surveillance burden?
- What does "graduated" actually mean — revenue milestone, problem resolved, or both?
- How do we handle entrepreneurs who need multiple incubation cycles?

*These are open questions. Contribute your thinking.*

---

*This document is the brain of the Doorstep Incubation Protocol.*  
*It evolves with every build, every field visit, and every entrepreneur incubated.*  
*Current maintainer: Sauramandala Foundation — sauramandala.org*
