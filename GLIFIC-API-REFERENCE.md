# Glific API Reference — Sauramandala Working Notes

Complete digest of https://glific.github.io/slate/ for building SM flows programmatically.

---

## Authentication (REST)

```
POST /api/v1/session
Content-Type: application/x-www-form-urlencoded

user[phone]=+919XXXXXXXXX&user[password]=YOUR_PASSWORD
```

Response:
```json
{
  "data": {
    "data": {
      "access_token": "TOKEN",
      "renewal_token": "RENEW_TOKEN",
      "token_expiry_time": "2020-07-14T09:34:08.369870Z"
    }
  }
}
```

All subsequent GraphQL requests:
```
POST /api
Content-Type: application/json
Authorization: YOUR_ACCESS_TOKEN
```

Renew token before expiry:
```
POST /api/v1/session/renew
Authorization: YOUR_RENEWAL_TOKEN
```

---

## GraphQL Endpoint

`POST https://api.<your-glific-domain>/api`

All GraphQL requests use this single endpoint with `Authorization: TOKEN` header.

---

## Flow JSON — Key Facts for SM Flows

### Variable Syntax
| Expression | Meaning |
|---|---|
| `@results.X` | Text the user typed for result key X (NOT `.value`) |
| `@contact.fields.X.value` | Stored contact field value (`.value` IS required) |
| `@contact.name` | WhatsApp display name (auto-set, cannot be set via flow) |
| `@input.text` | Current user input (use as router operand) |

### Contact Fields JSON Structure
```json
{
  "field_key": {
    "type": "string",
    "label": "Field Label",
    "value": "actual value",
    "inserted_at": "2020-08-28T15:34:49Z"
  }
}
```

### Results Structure (in webhooks)
```json
{
  "result_key": {
    "input": "user input text",
    "category": "matched category name"
  }
}
```

### Webhook Return → Flow Variables
Webhook returns `{"key1": "value1"}` → accessible as `@results.webhookname.key1`

### Confirmed Action Types
- `send_msg` — send text
- `set_contact_field` — store a contact field
- `add_contact_groups` — add contact to group(s)
- `set_run_result` — save a result
- `call_webhook` — call external URL
- `send_interactive_msg` — send quick-reply/list message
- `enter_flow` — start a sub-flow
- `set_contact_language` — change contact language
- `add_input_labels` — tag a message

**`set_contact_name` does NOT exist in Glific.**

### set_contact_field Format
```json
{
  "uuid": "...",
  "type": "set_contact_field",
  "field": {"key": "field_key", "name": "field_key"},
  "value": "@results.result_key"
}
```

### wait Must Be Inside router
```json
{
  "router": {
    "wait": {"type": "msg"},
    "type": "switch",
    "operand": "@input.text",
    ...
  }
}
```

### UUIDs Must Be Strictly Valid (LEARNED 2026-07-06, the hard way)
Every UUID in a flow JSON (node, action, exit, category, case, flow) must be a
strictly valid v4-shaped UUID: `8-4-4-4-12` hex characters. Our generated
mPowerClub flows had 11 chars in the last segment — Glific **imported and
"published" them without any error**, but the keyword never triggered the flow
and preview did not work either. **Silent failure, no error message anywhere.**

Rule: after generating any flow JSON, validate every UUID:
```bash
grep -oE '[0-9a-f-]{30,40}' file.json | awk -F'-' \
  '{if (length($1)!=8||length($2)!=4||length($3)!=4||length($4)!=4||length($5)!=12) print "BAD:", $0}'
```

### Router Wait timeout — NOT confirmed working in Glific (LEARNED 2026-07-06)
The RapidPro 13.2.0 spec supports
`"wait": {"type": "msg", "timeout": {"seconds": N, "category_uuid": "..."}}`
to auto-advance after N seconds of no reply. **Tested in Glific (smf.glific.com,
July 2026): the timeout did NOT fire.** Flow just waited for a reply.

Glific's own answer for delays is the **"Wait for time" node in the flow
editor UI**. We have not yet captured its JSON export. Method to learn any
UI-only node's JSON: build a tiny flow in the editor with just that node,
then `exportFlow` via GraphQL and inspect the definition. Do this before
hand-writing such nodes into generated JSON.

Alternative for scheduled/timed sends: **Triggers** (GraphQL `createTrigger`)
start a flow for a group at a fixed time / repeating schedule (daily, weekly,
etc.). Good for drip content; minimum granularity is not seconds/minutes.

### Google Sheets Integration (native in Glific)
Glific can read a row from a published Google Sheet inside a flow:
1. Glific UI → **Sheets** screen → *Add Sheet* → paste the sheet's published link.
2. In the flow editor add a **"Link Google Sheet"** node, pick the sheet.
3. Set a **row key** — a value (e.g. `@calendar.day` or a contact field) matched
   against the sheet's **first column**.
4. Set a result name, e.g. `linked_sheet`. Columns become variables:
   column `tip_text` → `@results.linked_sheet.tip_text`.
Writing to sheets is also supported (row append) in newer Glific versions.
JSON action type not yet captured — build one in the editor and export to learn
the exact JSON before generating it programmatically.
Docs: https://glific.org/integrating-google-sheets-in-glific/

### Debugging Checklist When a Keyword Doesn't Start a Flow
1. Validate all UUIDs in the JSON (see above) — malformed UUIDs fail silently.
2. Flow published? Drafts respond in simulator only, never in live chat.
3. Keyword saved on the flow (Flows → edit → keywords) and not claimed by another flow.
4. Contact status VALID and opted in (opt-out locks the contact).
5. Check Flows → flow → Runs tab, and contact's Activity history.

---

## Flows — GraphQL Operations

### List All Flows
```graphql
query flows($filter: FlowFilter, $opts: Opts) {
  flows(filter: $filter, opts: $opts) {
    id
    name
    uuid
    keywords
    flowType
    isActive
    lastPublishedAt
    lastChangedAt
    versionNumber
  }
}
```

### Get Flow by ID
```graphql
query flow($id: ID!) {
  flow(id: $id) {
    flow {
      id
      name
      uuid
      keywords
    }
  }
}
```

### Count Flows
```graphql
query countFlows($filter: FlowFilter) {
  countFlows(filter: $filter)
}
```

### Create Flow
```graphql
mutation createFlow($input: FlowInput!) {
  createFlow(input: $input) {
    flow { id name keywords }
    errors { key message }
  }
}
```
FlowInput: `{ name, keywords, ignoreKeywords, isActive, isBackground }`

### Update Flow
```graphql
mutation updateFlow($id: ID!, $input: FlowInput!) {
  updateFlow(id: $id, input: $input) {
    flow { id name keywords }
    errors { key message }
  }
}
```

### Delete Flow
```graphql
mutation deleteFlow($id: ID!) {
  deleteFlow(id: $id) {
    errors { key message }
  }
}
```

### Import Flow (primary deploy method)
```graphql
mutation importFlow($flow: JSON!) {
  importFlow(flow: $flow) {
    success
    errors { key message }
  }
}
```
Variables: `{ "flow": <entire flow JSON object> }`

### Export Flow
```graphql
query exportFlow($id: ID!) {
  exportFlow(id: $id) {
    export_data
  }
}
```

### Publish Flow
```graphql
mutation publishFlow($uuid: UUID4!) {
  publishFlow(uuid: $uuid) {
    success
    errors { key message }
  }
}
```

### Start Flow for a Contact
```graphql
mutation startContactFlow($flowId: ID!, $contactId: ID!) {
  startContactFlow(flowId: $flowId, contactId: $contactId) {
    success
    errors { key message }
  }
}
```

### Resume Flow for a Contact
```graphql
mutation resumeContactFlow($flowId: ID!, $contactId: ID!, $result: JSON!) {
  startContactFlow(flowId: $flowId, contactId: $contactId, result: $result) {
    success
    errors { key message }
  }
}
```

### Start Flow for a Group (all contacts)
```graphql
mutation startGroupFlow($flowId: ID!, $groupId: ID!) {
  startGroupFlow(flowId: $flowId, groupId: $groupId) {
    success
    errors { key message }
  }
}
```

### Terminate All Flows for a Contact
```graphql
mutation terminateContactFlows($contactId: ID!) {
  terminateContactFlows(contactId: $contactId) {
    success
    errors { key message }
  }
}
```

### Copy a Flow
```graphql
mutation copyFlow($id: ID!, $input: FlowInput!) {
  copyFlow(id: $id, input: $input) {
    flow { id name keywords }
    errors { key message }
  }
}
```

### Flow Filter Options
```
name          String  — match by name
nameOrKeyword String  — match name or keywords
keyword       String  — match keyword
uuid          UUID4
isActive      Boolean
isBackground  Boolean
status        String  — draft/archived/published
```

---

## Contacts — GraphQL Operations

### List Contacts
```graphql
query contacts($filter: ContactFilter, $opts: Opts) {
  contacts(filter: $filter, opts: $opts) {
    id
    name
    phone
    status
    bspStatus
    fields
    language { label }
    lastMessageAt
  }
}
```

### Get Contact by ID
```graphql
query contact($id: ID!) {
  contact(id: $id) {
    contact {
      id
      name
      phone
      fields
      settings
      bspStatus
      status
      optinTime
      optoutTime
      language { label }
      tags { label }
      history {
        eventType
        eventLabel
        eventMeta
      }
    }
  }
}
```

Contact `fields` is a JSON string:
```json
"{\"field_key\":{\"value\":\"v\",\"type\":\"string\",\"label\":\"l\",\"inserted_at\":\"...\"}}"
```

### Create Contact
```graphql
mutation createContact($input: ContactInput!) {
  createContact(input: $input) {
    contact { id name phone }
    errors { key message }
  }
}
```

### Update Contact
```graphql
mutation updateContact($id: ID!, $input: ContactInput!) {
  updateContact(id: $id, input: $input) {
    contact { id name fields language { label } }
    errors { key message }
  }
}
```

ContactInput:
```
name       String
phone      String
languageId ID
bspStatus  ContactProviderStatusEnum
status     ContactStatusEnum
fields     Json   (JSON string of contact fields object)
settings   Json
```

### Block / Unblock Contact
```graphql
mutation updateContact($id: ID!, $input: ContactInput!) {
  updateContact(id: $id, input: $input) {
    contact { name phone status }
    errors { key message }
  }
}
# Block: input: { status: BLOCKED }
# Unblock: input: { status: VALID }
```

### Delete Contact
```graphql
mutation deleteContact($id: ID!) {
  deleteContact(id: $id) {
    errors { key message }
  }
}
```

### Optin a Contact
```graphql
mutation optinContact($phone: String!, $name: String) {
  optinContact(phone: $phone, name: $name) {
    contact { id name phone bspStatus optinTime }
    errors { key message }
  }
}
```

### Get Contact Location
```graphql
query contactLocation($id: ID!) {
  contactLocation(id: $id) {
    latitude
    longitude
  }
}
```

### Count Contacts
```graphql
query countContacts($filter: ContactFilter) {
  countContacts(filter: $filter)
}
```

### Get Contact History
```graphql
query contactHistory($filter: contactHistoryFilter, $opts: Opts) {
  contactHistory(filter: $filter, opts: $opts) {
    id
    eventType
    eventLabel
    eventMeta
    eventDatetime
  }
}
```

### ContactFilter Options
```
name          String  — match name
phone         String  — match phone
bspStatus     ContactProviderStatusEnum
status        ContactStatusEnum
includeTags   [id]    — filter by tag IDs
includeGroups [id]    — filter by group IDs
```

### ContactStatusEnum Values
`FAILED | INVALID | PROCESSING | VALID | BLOCKED`

### ContactProviderStatusEnum Values
`NONE | SESSION | SESSION_AND_HSM | HSM`

---

## Groups — GraphQL Operations

### List All Groups
```graphql
query groups($filter: GroupFilter, $opts: Opts) {
  groups(filter: $filter, opts: $opts) {
    id
    label
    isRestricted
    contactsCount
    usersCount
  }
}
```

### Get Group by ID
```graphql
query group($id: ID!) {
  group(id: $id) {
    group {
      id
      label
      isRestricted
      contacts { name }
      users { name }
    }
  }
}
```

### Get Group Info (contact breakdown by BSP status)
```graphql
query groupInfo($id: ID!) {
  groupInfo(id: $id)
}
# Returns: "{\"total\":2,\"session_and_hsm\":1,\"session\":1}"
```

### Create Group
```graphql
mutation createGroup($input: GroupInput!) {
  createGroup(input: $input) {
    group { id label }
    errors { key message }
  }
}
# GroupInput: { label, isRestricted, description }
```

### Update Group
```graphql
mutation updateGroup($id: ID!, $input: GroupInput!) {
  updateGroup(id: $id, input: $input) {
    group { id label isRestricted }
    errors { key message }
  }
}
```

### Delete Group
```graphql
mutation deleteGroup($id: ID!) {
  deleteGroup(id: $id) {
    errors { key message }
  }
}
```

### Add/Remove Contacts from Group
```graphql
mutation updateGroupContacts($input: GroupContactsInput!) {
  updateGroupContacts(input: $input) {
    groupContacts { id contact { name } group { label } }
    numberDeleted
  }
}
# GroupContactsInput: { groupId, addContactIds: [Id], deleteContactIds: [Id] }
```

### Add/Remove Groups from Contact
```graphql
mutation updateContactGroups($input: ContactGroupsInput!) {
  updateContactGroups(input: $input) {
    contactGroups { id group { label } contact { name } }
    numberDeleted
  }
}
# ContactGroupsInput: { contactId, addGroupIds: [Id], deleteGroupIds: [Id] }
```

---

## Tags — GraphQL Operations

### List Tags
```graphql
query tags($filter: TagFilter, $opts: Opts) {
  tags(filter: $filter, opts: $opts) {
    id
    label
    shortcode
    isActive
    keywords
    language { id label }
  }
}
```

### Create Tag
```graphql
mutation createTag($input: TagInput!) {
  createTag(input: $input) {
    tag { id label description }
    errors { key message }
  }
}
# TagInput: { label, description, color_code, isActive, isReserved, keywords, languageId, parentId }
```

### Add Tag to Contact
```graphql
mutation createContactTag($input: ContactTagInput!) {
  createContactTag(input: $input) {
    contactTag { id contact { name } tag { label } }
    errors { key message }
  }
}
# ContactTagInput: { contactId, tagId }
```

### Bulk Update Contact Tags
```graphql
mutation updateContactTags($input: ContactTagsInput!) {
  updateContactTags(input: $input) {
    contactTags { id tag { label } contact { name } }
    numberDeleted
  }
}
# ContactTagsInput: { contactId, addTagIds: [Id]!, deleteTagIds: [Id]! }
```

---

## Messages — GraphQL Operations

### Send a Message
```graphql
mutation createAndSendMessage($input: MessageInput!) {
  createAndSendMessage(input: $input) {
    message { id body receiver { id name } }
    errors { key message }
  }
}
# MessageInput: { body, type, flow, receiver_id, sender_id, template_id, media_id, send_at }
```

### Send HSM (Template) Message
```graphql
mutation sendHsmMessage($templateId: ID!, $receiverId: ID!, $parameters: [String]!) {
  sendHsmMessage(templateId: $templateId, receiverId: $receiverId, parameters: $parameters) {
    message { id body isHsm }
    errors { key message }
  }
}
```

### Send Template Message to Group
```graphql
mutation sendHsmMessageToGroup($templateId: ID!, $groupId: ID!, $parameters: [String]!) {
  sendHsmMessageToGroup(templateId: $templateId, groupId: $groupId, parameters: $parameters) {
    success
    contactIds
    errors { key message }
  }
}
```

### Send Message to Group (Session)
```graphql
mutation createAndSendMessageToGroup($input: MessageInput!, $groupId: [ID]!) {
  createAndSendMessageToGroup(input: $input, groupId: $groupId) {
    success
    contactIds
    errors { key message }
  }
}
```

### Mark Contact Messages as Read
```graphql
mutation markContactMessagesAsRead($contactId: Gid!) {
  markContactMessagesAsRead(contactId: $contactId)
}
```

### Clear All Messages for Contact
```graphql
mutation clearMessages($contactId: ID!) {
  clearMessages(contactId: $contactId) {
    success
    errors { key message }
  }
}
```

### MessageTypesEnum Values
`AUDIO | CONTACT | DOCUMENT | HSM | IMAGE | LOCATION | TEXT | VIDEO | STICKER`

---

## Session Templates (HSM Templates)

### List Templates
```graphql
query sessionTemplates($filter: SessionTemplateFilter, $opts: Opts) {
  sessionTemplates(filter: $filter, opts: $opts) {
    id
    label
    body
    type
    isHsm
    isActive
    status
    language { id label }
    translations
  }
}
```

### Create Template
```graphql
mutation createSessionTemplate($input: SessionTemplateInput!) {
  createSessionTemplate(input: $input) {
    sessionTemplate { id label body type }
    errors { key message }
  }
}
```

SessionTemplateInput:
```
body          String
label         String
languageId    ID
type          MessageTypesEnum
isHsm         Boolean
isActive      Boolean
category      String      (ACCOUNT_UPDATE | PAYMENT_UPDATE | ALERT_UPDATE | AUTO_REPLY | etc.)
example       String
translations  Json
shortcode     String
hasButtons    Boolean
buttonType    TemplateButtonTypeEnum
buttons       Json
```

### HSM Categories
`ACCOUNT_UPDATE | PAYMENT_UPDATE | PERSONAL_FINANCE_UPDATE | SHIPPING_UPDATE | RESERVATION_UPDATE | ISSUE_RESOLUTION | APPOINTMENT_UPDATE | TRANSPORTATION_UPDATE | TICKET_UPDATE | ALERT_UPDATE | AUTO_REPLY`

### Update Template
```graphql
mutation updateSessionTemplate($id: ID!, $input: SessionTemplateInput!) {
  updateSessionTemplate(id: $id, input: $input) {
    sessionTemplate { id label body }
    errors { key message }
  }
}
```

### Delete Template
```graphql
mutation deleteSessionTemplate($id: ID!) {
  deleteSessionTemplate(id: $id) {
    errors { key message }
  }
}
```

---

## Bulk Contact Import

```graphql
mutation importContacts($groupLabel: String!, $data: String!, $id: Id!, $type: ImportContactEnum!) {
  importContacts(groupLabel: $groupLabel, data: $data, id: $id, type: $type) {
    status
  }
}
```

CSV format:
```
name,phone,Language,opt_in,delete
Karthik,917012345678,english,2024-01-01
OldUser,917087654321,hindi,2024-01-01,1
```

---

## Media Upload

```graphql
mutation uploadMedia($media: Upload!, $extension: String!) {
  uploadMedia(media: $media, extension: $extension)
}
# Returns GCS URL string
```

---

## Languages

### List Languages
```graphql
query languages($filter: LanguageFilter, $opts: Opts) {
  languages(filter: $filter, opts: $opts) {
    id
    label
    locale
    isActive
  }
}
```

### Create Language
```graphql
mutation createLanguage($input: LanguageInput!) {
  createLanguage(input: $input) {
    language { id label locale }
    errors { key message }
  }
}
```

---

## Organization

### Get Organization Info
```graphql
query organization($id: ID) {
  organization(id: $id) {
    organization {
      id
      name
      shortcode
      email
      isActive
      isApproved
      defaultLanguage { label }
    }
  }
}
```

### Update Organization
```graphql
mutation updateOrganization($id: ID!, $input: OrganizationInput!) {
  updateOrganization(id: $id, input: $input) {
    organization { id name }
    errors { key message }
  }
}
```

---

## Users

### Get Current User
```graphql
query currentUser {
  currentUser {
    user {
      id
      name
      phone
      roles
      language { label }
    }
  }
}
```

### List Users
```graphql
query users($filter: UserFilter, $opts: Opts) {
  users(filter: $filter, opts: $opts) {
    id
    name
    phone
    roles
  }
}
```

---

## Search

### Search Contacts + Conversations
```graphql
query search($filter: SearchFilter, $messageOpts: Opts, $contactOpts: Opts) {
  search(filter: $filter, messageOpts: $messageOpts, contactOpts: $contactOpts) {
    contact { name }
    messages { id body tags { label } }
  }
}
```

SearchFilter fields:
```
term          String
status        String  (Unread / Not replied / Not Responded / Optout)
includeTags   [Gid]
includeGroups [Gid]
includeUsers  [Gid]
dateRange     [DateRange]
```

---

## Subscriptions (WebSocket)

Glific supports GraphQL subscriptions for real-time events:

- `sentMessage` — outbound message sent
- `receivedMessage` — inbound message received
- `update_message_status` — message delivery status change
- `sent_group_message` — group message sent
- `cleared_messages` — contact messages cleared
- `createdContactTag` / `deletedContactTag` — tag events
- `createdMessageTag` / `deletedMessageTag` — message tag events

---

## Error Format

```json
{
  "data": {
    "mutationName": {
      "errors": [
        { "key": "field_name", "message": "error description" }
      ]
    }
  }
}
```

HTTP error codes: `400 401 403 404 429 500 503`

---

## Scalars

| Scalar | Description |
|---|---|
| `Boolean` | true/false |
| `DateTime` | ISO8601 UTC string |
| `Time` | ISO8601 time (no microseconds) |
| `Gid` | Glific ID — JSON String, backend treats as integer |
| `ID` | Unique identifier — string or int both accepted as input |
| `Int` | Signed whole number |
| `Json` | Generic JSON object/string |
| `String` | UTF-8 text |
| `UUID4` | UUID4 string |

---

## Opts (Pagination + Sorting)

```graphql
opts: {
  limit: 10,
  offset: 0,
  order: ASC,        # or DESC
  order_with: "name" # field to sort by
}
```

---

## SM Deployment Checklist

1. **Auth**: `POST /api/v1/session` → get `access_token`
2. **Import flow**: `importFlow(flow: $flowJson)` → `success: true`
3. **Publish**: `publishFlow(uuid: $flowUuid)` → `success: true`
4. **Verify keyword**: `flows(filter: { keyword: "smjoin" })` — should return SM Onboard
5. **Test**: Start flow manually or send `smjoin` from test number

### SM Onboard Flow
- **Keyword**: `smjoin`
- **Flow UUID**: `3fa22108-f464-41e5-81d9-d8a298854444` (placeholder — update after first import)
- **Contact fields used**: `preferred_language`, `consent_given`, `programme`, `ecce_role`, `cmyc_role`, `oesn_role`, `core_role`, `child_dob`, `region`, `full_name`

---

*Last updated: 2026-07-04. Source: https://glific.github.io/slate/*
