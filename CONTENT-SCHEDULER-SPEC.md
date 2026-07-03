# Sauramandala — Content Scheduler Spec

**System**: Google Sheet → Apps Script → Glific GraphQL → WhatsApp delivery  
**Programmes**: TFFP, CMYC  
**Pattern**: Hybrid (team sets `send_date` per row; Apps Script fires daily and sends matching rows)  
**No n8n required** — Apps Script is free, lives inside the Sheet, calls Glific API directly.

---

## How It Works

```
Team adds content row to Google Sheet
  (sets send_date, programme, audience, media type, content)
          ↓
Google Apps Script runs daily at 8:30 AM (time-driven trigger)
  → reads all rows where send_date = today AND status = Pending
  → for each row: calls Glific GraphQL API
          ↓
Glific receives API call
  → starts Content Delivery flow for target contact group
  → flow sends message (text / image / video / document / audio)
          ↓
Apps Script marks row status = Sent, logs sent_at timestamp
```

---

## 1. Google Sheet Structure

**Sheet name**: `Content Calendar`  
**One row = one content item to be sent**

| Column | Key | Type | Notes |
|--------|-----|------|-------|
| A | `content_id` | Auto (row number or GUID) | Unique identifier |
| B | `programme` | Dropdown | `tffp` / `cmyc` |
| C | `target_audience` | Dropdown | See audience codes below |
| D | `send_date` | Date (DD/MM/YYYY) | When to send |
| E | `send_time` | Time (HH:MM) | Optional; Apps Script uses date only by default |
| F | `media_type` | Dropdown | `text` / `image` / `video` / `document` / `audio` |
| G | `media_url` | URL | YouTube link, Drive PDF link, audio file URL, etc. |
| H | `caption` | Text | Message text shown with media (or full text if type=text) |
| I | `language` | Dropdown | `English` / `Khasi` / `Garo` / `Pnar` / `All` |
| J | `status` | Auto | `Pending` / `Sent` / `Error` |
| K | `sent_at` | Auto | Timestamp filled by Apps Script on success |
| L | `error_log` | Auto | Error message if Glific call fails |
| M | `notes` | Text | Internal notes for the team, not sent |

### Audience Codes

| Code | Group in Glific | Description |
|------|----------------|-------------|
| `tffp_all` | TFFP — All | Everyone in TFFP |
| `tffp_parents` | TFFP — Parents | Parents/caregivers with children 0–6 |
| `tffp_practitioners` | TFFP — Practitioners | ECCE workers, anganwadi, crèche |
| `tffp_supervisors` | TFFP — Supervisors | Block/cluster supervisors |
| `cmyc_all` | CMYC — All | Everyone in CMYC |
| `cmyc_coordinators` | CMYC — Coordinators | Youth centre coordinators |
| `cmyc_youth` | CMYC — Youth | Youth members |

### Media URL Guidelines for Team

| Type | What to put in `media_url` |
|------|---------------------------|
| `video` | YouTube link OR Google Drive shareable link (mp4) |
| `document` | Google Drive PDF link (set to "Anyone with link can view") |
| `image` | Google Drive image link or direct image URL |
| `audio` | Google Drive audio link (mp3/ogg) or direct URL |
| `text` | Leave blank — put full message in `caption` |

---

## 2. Glific Groups Setup

These groups must exist in Glific before the scheduler runs.  
Contacts are added to groups during onboarding (based on `programme` + role contact fields).

```yaml
# glific_config.yml — collections section

collections:
  - label: "TFFP — All"
    shortcode: tffp_all
    description: "All TFFP programme contacts"

  - label: "TFFP — Parents"
    shortcode: tffp_parents
    description: "Parents/caregivers enrolled in TFFP"

  - label: "TFFP — Practitioners"
    shortcode: tffp_practitioners
    description: "ECCE practitioners in TFFP"

  - label: "TFFP — Supervisors"
    shortcode: tffp_supervisors
    description: "Block/cluster supervisors in TFFP"

  - label: "CMYC — All"
    shortcode: cmyc_all
    description: "All CMYC programme contacts"

  - label: "CMYC — Coordinators"
    shortcode: cmyc_coordinators
    description: "Youth centre coordinators"

  - label: "CMYC — Youth"
    shortcode: cmyc_youth
    description: "Youth members in CMYC centres"
```

**How contacts land in these groups**: The onboarding flow adds contacts to the correct group after they set their `programme` and role fields. This is done via a `add_to_group` flow action node (added to the onboarding flow JSON).

---

## 3. Glific Contact Fields Required

These fields must exist (already defined in onboarding flow):

| Field Key | Set During | Used For |
|-----------|-----------|----------|
| `programme` | Onboarding | Routing to correct group |
| `ecce_role` | Onboarding (TFFP) | Sub-group assignment |
| `cmyc_role` | Onboarding (CMYC) | Sub-group assignment |
| `consent_given` | Onboarding | Gate: only send if `yes` |
| `preferred_language` | Onboarding | Future: language-targeted sends |

---

## 4. Google Apps Script

Paste this into **Extensions → Apps Script** inside the Google Sheet.

```javascript
// ============================================================
// Sauramandala Content Scheduler
// Runs daily at 8:30 AM via time-driven trigger
// Reads Content Calendar sheet, sends due rows via Glific API
// ============================================================

const GLIFIC_API_URL = "https://api.glific.com/api";  // Replace with your Glific instance URL
const GLIFIC_AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty("GLIFIC_TOKEN");
const SHEET_NAME = "Content Calendar";

// Maps audience codes to Glific group IDs
// Run getGroupIds() once to find your actual IDs and fill these in
const GROUP_ID_MAP = {
  tffp_all:          "GROUP_ID_HERE",
  tffp_parents:      "GROUP_ID_HERE",
  tffp_practitioners:"GROUP_ID_HERE",
  tffp_supervisors:  "GROUP_ID_HERE",
  cmyc_all:          "GROUP_ID_HERE",
  cmyc_coordinators: "GROUP_ID_HERE",
  cmyc_youth:        "GROUP_ID_HERE",
};

// Column indices (0-based)
const COL = {
  content_id:      0,   // A
  programme:       1,   // B
  target_audience: 2,   // C
  send_date:       3,   // D
  send_time:       4,   // E
  media_type:      5,   // F
  media_url:       6,   // G
  caption:         7,   // H
  language:        8,   // I
  status:          9,   // J
  sent_at:         10,  // K
  error_log:       11,  // L
};

function runDailyScheduler() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const today = formatDate(new Date());

  for (let i = 1; i < data.length; i++) {  // skip header row
    const row = data[i];
    const sendDate = formatDate(new Date(row[COL.send_date]));
    const status = row[COL.status];

    if (sendDate === today && status === "Pending") {
      const result = sendContent(row);
      if (result.success) {
        sheet.getRange(i + 1, COL.status + 1).setValue("Sent");
        sheet.getRange(i + 1, COL.sent_at + 1).setValue(new Date().toISOString());
      } else {
        sheet.getRange(i + 1, COL.status + 1).setValue("Error");
        sheet.getRange(i + 1, COL.error_log + 1).setValue(result.error);
      }
    }
  }
}

function sendContent(row) {
  const audience  = row[COL.target_audience];
  const mediaType = row[COL.media_type];
  const mediaUrl  = row[COL.media_url];
  const caption   = row[COL.caption];

  const groupId = GROUP_ID_MAP[audience];
  if (!groupId || groupId === "GROUP_ID_HERE") {
    return { success: false, error: `No group ID mapped for audience: ${audience}` };
  }

  // Build the message body for Glific sendGroupMessage mutation
  let messageBody;
  if (mediaType === "text") {
    messageBody = buildTextMessage(caption);
  } else {
    messageBody = buildMediaMessage(mediaType, mediaUrl, caption);
  }

  const mutation = `
    mutation SendGroupMessage($groupId: ID!, $message: MessageInput!) {
      sendGroupMessage(groupId: $groupId, message: $message) {
        success
        errors { key message }
      }
    }
  `;

  const variables = {
    groupId: groupId,
    message: messageBody,
  };

  try {
    const response = callGlificAPI(mutation, variables);
    if (response.data && response.data.sendGroupMessage && response.data.sendGroupMessage.success) {
      return { success: true };
    } else {
      const errors = JSON.stringify(response.errors || response.data?.sendGroupMessage?.errors);
      return { success: false, error: errors };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function buildTextMessage(text) {
  return {
    body: text,
    type: "TEXT",
  };
}

function buildMediaMessage(mediaType, url, caption) {
  const typeMap = {
    image:    "IMAGE",
    video:    "VIDEO",
    document: "DOCUMENT",
    audio:    "AUDIO",
  };
  return {
    body: caption || "",
    type: typeMap[mediaType] || "TEXT",
    media: url,
  };
}

function callGlificAPI(query, variables) {
  const payload = JSON.stringify({ query, variables });
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": GLIFIC_AUTH_TOKEN,
    },
    payload: payload,
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(GLIFIC_API_URL, options);
  return JSON.parse(response.getContentText());
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

// ── Setup Helpers ──────────────────────────────────────────

// Run this ONCE to install the daily 8:30 AM trigger
function installTrigger() {
  ScriptApp.newTrigger("runDailyScheduler")
    .timeBased()
    .atHour(8)
    .nearMinute(30)
    .everyDays(1)
    .create();
  Logger.log("Trigger installed: runs daily at 8:30 AM");
}

// Run this ONCE to store your Glific auth token securely
// Replace TOKEN_VALUE with your actual token
function storeToken() {
  PropertiesService.getScriptProperties().setProperty(
    "GLIFIC_TOKEN",
    "TOKEN_VALUE"
  );
  Logger.log("Token stored.");
}

// Run this ONCE to list your Glific groups and find their IDs
// Copy the IDs into GROUP_ID_MAP above
function getGroupIds() {
  const query = `
    query {
      groups(filter: {}) {
        id
        label
      }
    }
  `;
  const result = callGlificAPI(query, {});
  Logger.log(JSON.stringify(result.data?.groups, null, 2));
}
```

### First-Time Setup Steps

1. Open the Google Sheet → **Extensions → Apps Script**
2. Paste the script above, update `GLIFIC_API_URL` to your Glific instance
3. Run `storeToken()` once with your Glific auth token (from Glific → Settings → Account)
4. Run `getGroupIds()` once — copy the group IDs into `GROUP_ID_MAP`
5. Run `installTrigger()` once — this creates the 8:30 AM daily trigger
6. Test: add a row with `send_date = today`, `status = Pending`, run `runDailyScheduler()` manually

---

## 5. Glific Auth Token

Get from: **Glific UI → Settings → Account → Access Token**

Store in Apps Script Properties (never in the sheet cells):
```
Run storeToken() with your token value
```

The token is accessed via `PropertiesService` — not visible in code or sheet.

---

## 6. Adding Contacts to Groups (Onboarding Flow Update)

The onboarding flow must add contacts to the correct Glific group after programme + role selection.

Add this node type to the onboarding flow JSON at the end of each programme branch:

```json
{
  "uuid": "NODE-UUID-HERE",
  "actions": [{
    "type": "add_contact_groups",
    "groups": [{"uuid": "GLIFIC-GROUP-UUID", "name": "TFFP — Parents"}]
  }],
  "exits": [{"uuid": "EXIT-UUID", "destination_uuid": "NEXT-NODE"}]
}
```

**Group assignment logic:**

| Programme | Role | Add to Groups |
|-----------|------|--------------|
| tffp | parent | TFFP — All, TFFP — Parents |
| tffp | practitioner / anganwadi / creche | TFFP — All, TFFP — Practitioners |
| tffp | supervisor / block_supervisor | TFFP — All, TFFP — Supervisors |
| cmyc | coordinator | CMYC — All, CMYC — Coordinators |
| cmyc | youth | CMYC — All, CMYC — Youth |

---

## 7. Sheet Validation Setup (Data Validation in Google Sheets)

To prevent team entry errors, add dropdown validation:

| Column | Allowed Values |
|--------|---------------|
| B (programme) | tffp, cmyc |
| C (target_audience) | tffp_all, tffp_parents, tffp_practitioners, tffp_supervisors, cmyc_all, cmyc_coordinators, cmyc_youth |
| F (media_type) | text, image, video, document, audio |
| I (language) | English, Khasi, Garo, Pnar, All |
| J (status) | Pending, Sent, Error *(protect this column — Apps Script writes it)* |

**Protect columns J, K, L** from manual editing: Data → Protect sheets and ranges → restrict to Apps Script only.

---

## 8. Sample Sheet Rows

| content_id | programme | target_audience | send_date | send_time | media_type | media_url | caption | language | status | sent_at | error_log |
|-----------|-----------|----------------|-----------|-----------|-----------|-----------|---------|----------|--------|---------|-----------|
| 001 | tffp | tffp_parents | 07/07/2026 | 09:00 | video | https://youtu.be/abc123 | This week's activity for your child — watch and try at home! | English | Pending | | |
| 002 | tffp | tffp_practitioners | 07/07/2026 | 09:00 | document | https://drive.google.com/file/d/xyz/view | July learning kit — practitioners edition | Khasi | Pending | | |
| 003 | cmyc | cmyc_coordinators | 08/07/2026 | 10:00 | text | | Reminder: weekly attendance report is due by Friday 5 PM. Reply REPORT to submit. | English | Pending | | |
| 004 | tffp | tffp_all | 14/07/2026 | 09:00 | image | https://drive.google.com/file/d/pqr/view | Happy learning! Share what your child made this week. | Garo | Pending | | |

---

## 9. Delivery Flow JSON (for Glific)

The Apps Script calls Glific's `sendGroupMessage` mutation directly — no Glific flow is needed for the delivery step itself. Glific handles the WhatsApp delivery natively.

However, a **Content Opt-Out flow** should exist so contacts can stop receiving content:

```yaml
# In glific_config.yml

flows:
  - name: "Content Opt-Out"
    keywords: ["stop content", "no content", "unsubscribe"]
    description: "Removes contact from content delivery groups"
    nodes:
      - type: send_msg
        text: "You've been removed from content updates. Reply START CONTENT anytime to rejoin."
      - type: remove_from_groups
        groups: [tffp_parents, tffp_practitioners, tffp_supervisors, tffp_all, cmyc_all, cmyc_coordinators, cmyc_youth]

  - name: "Content Opt-In"
    keywords: ["start content", "content on"]
    description: "Re-adds contact to their programme content group"
    nodes:
      - type: field_router
        field: "@contact.fields.programme.value"
        cases:
          tffp: [add to TFFP groups based on ecce_role]
          cmyc: [add to CMYC groups based on cmyc_role]
```

---

## 10. Limits and Constraints

| Constraint | Detail |
|-----------|--------|
| WhatsApp media size | Image ≤5MB, Video ≤16MB, Document ≤100MB, Audio ≤16MB |
| Google Drive links | Must be set to "Anyone with the link can view" |
| YouTube links | Glific sends as text link (WhatsApp previews it) — not embedded |
| Glific group broadcast | Sends to all contacts in group — filter by consent_given=yes is handled at onboarding (only consenting contacts are added to groups) |
| Apps Script daily limit | 6 min runtime per execution — fine for hundreds of rows |
| Glific API rate limit | ~10 requests/second — Apps Script adds 200ms delay between rows if needed |

---

## 11. Phase Plan

| Phase | Task | Who |
|-------|------|-----|
| 1 | Create Google Sheet with columns and validation | Team |
| 1 | Create Glific groups (TFFP/CMYC) via Glific UI or YAML deploy | Tech |
| 1 | Update onboarding flow JSON to add contacts to groups | Tech |
| 2 | Paste Apps Script, run storeToken + getGroupIds + installTrigger | Tech |
| 2 | Test with one row (today's date, text type) | Tech + Team |
| 3 | Test all media types (image, video, document, audio) | Team |
| 3 | Add sheet validation and protect status/sent_at/error columns | Tech |
| 4 | Train content team on sheet entry | Programme leads |
| 4 | Add opt-out/opt-in flows to Glific | Tech |
