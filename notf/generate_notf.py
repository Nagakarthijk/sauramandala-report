"""
Generate NOTF_Flow.json — event opt-in + ground reporting flow.
Keyword: notf / NOTF (both registered — case-sensitivity of Glific keyword
matching is unconfirmed, so we cover both explicitly).

Reports are pushed to Supabase via call_webhook (a standard REST POST — this
is the most reliable integration path since call_webhook's shape is confirmed
in GLIFIC-API-REFERENCE.md, unlike Google Sheets WRITE mode which is not yet
captured from a real Glific export).

REQUIRES before import: fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TABLE
below with real values.
"""
import json

SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
SUPABASE_ANON_KEY = "YOUR-ANON-OR-SERVICE-KEY"
SUPABASE_TABLE = "notf_reports"

def n(nd): return f"90{nd:04d}00-0000-4000-8000-90{nd:04d}000000"
def a(nd, sub=0): return f"90{nd:04d}{sub:02d}-aaaa-4000-8000-90{nd:04d}{sub:02d}aaaa"
def e(nd, sub=0): return f"90{nd:04d}{sub:02d}-eeee-4000-8000-90{nd:04d}{sub:02d}eeee"
def c(nd, sub=0): return f"90{nd:04d}{sub:02d}-cccc-4000-8000-90{nd:04d}{sub:02d}cccc"
def cas(nd, sub=0): return f"90{nd:04d}{sub:02d}-ca00-4000-8000-90{nd:04d}{sub:02d}ca00"

FLOW_UUID = "90909090-9090-4909-8909-909090909090"

INTERACTIVE_TEMPLATES = []

def send(nd, text, dest=None):
    return {
        "uuid": n(nd),
        "actions": [{
            "uuid": a(nd), "type": "send_msg", "text": text,
            "quick_replies": [], "labels": [], "attachments": []
        }],
        "exits": [{"uuid": e(nd), "destination_uuid": dest if dest is not None else n(nd + 1)}]
    }

def wait_any(nd, result_name, dest=None):
    dest = dest or n(nd + 1)
    return {
        "uuid": n(nd), "actions": [],
        "router": {
            "wait": {"type": "msg"}, "type": "switch", "result_name": result_name,
            "operand": "@input.text", "default_category_uuid": c(nd, 1),
            "categories": [{"uuid": c(nd, 1), "name": "Any", "exit_uuid": e(nd, 1)}],
            "cases": []
        },
        "exits": [{"uuid": e(nd, 1), "destination_uuid": dest}]
    }

def interactive_quick_reply(nd, label, header, text, options, result_name, option_dests, other_dest=None):
    template_id = 9200000 + nd
    content = {
        "type": "quick_reply",
        "content": {"type": "text", "header": header, "text": text},
        "options": [{"type": "text", "title": o} for o in options]
    }
    INTERACTIVE_TEMPLATES.append({
        "source_id": template_id, "type": "quick_reply", "label": label,
        "language_id": 1, "send_with_title": False,
        "interactive_content": content, "translations": {"1": content}
    })
    msg_node = {
        "uuid": n(nd),
        "actions": [{
            "uuid": a(nd), "type": "send_interactive_msg", "id": template_id, "name": label,
            "text": json.dumps(content, ensure_ascii=False),
            "labels": [], "attachment_url": "", "attachment_type": ""
        }],
        "exits": [{"uuid": e(nd), "destination_uuid": n(nd + 1)}]
    }
    other_dest = other_dest or n(nd)
    categories, cases, exits = [], [], []
    for i, (opt, dest) in enumerate(zip(options, option_dests), start=1):
        categories.append({"uuid": c(nd + 1, i), "name": opt, "exit_uuid": e(nd + 1, i)})
        cases.append({"uuid": cas(nd + 1, i), "type": "has_only_phrase", "category_uuid": c(nd + 1, i), "arguments": [opt]})
        exits.append({"uuid": e(nd + 1, i), "destination_uuid": dest})
    other_i = len(options) + 1
    categories.append({"uuid": c(nd + 1, other_i), "name": "Other", "exit_uuid": e(nd + 1, other_i)})
    exits.append({"uuid": e(nd + 1, other_i), "destination_uuid": other_dest})
    router_node = {
        "uuid": n(nd + 1),
        "router": {
            "wait": {"type": "msg"}, "type": "switch", "result_name": result_name,
            "operand": "@input.text", "default_category_uuid": c(nd + 1, other_i),
            "categories": categories, "cases": cases
        },
        "exits": exits, "actions": []
    }
    return [msg_node, router_node]

nodes = []

# N1: Welcome + explain both purposes
nodes.append(send(1,
    "👋 Thanks for reaching out about the event!\n\n"
    "*NOTF* is your line to Sauramandala for this event — you can:\n"
    "📢 Get updates about what's happening\n"
    "📝 Report something from the ground any time (an issue, a photo, feedback)\n\n"
    "First — want future event updates sent to you here on WhatsApp?"
))
nodes += interactive_quick_reply(
    2, "NOTF Updates Optin", "Stay updated?",
    "Want future event updates sent here on WhatsApp?",
    ["Yes, keep me posted", "No thanks"],
    "notf_optin_choice",
    [n(4), n(4)]
)
# nodes 2,3 consumed; node 4 next

# N4: set contact field from opt-in choice
nodes.append({
    "uuid": n(4),
    "actions": [{
        "uuid": a(4), "type": "set_contact_field",
        "field": {"key": "notf_optin", "name": "notf_optin"},
        "value": "@results.notf_optin_choice"
    }],
    "exits": [{"uuid": e(4), "destination_uuid": n(5)}]
})

# N5: ask what they want to report
nodes.append(send(5,
    "Got it ✅\n\n"
    "Now — do you have something to report? Type it out below (an issue, a moment, "
    "feedback — anything). Or type *skip* if you just wanted updates for now."
))

# N6: wait for report text
nodes.append(wait_any(6, "notf_report_text", dest=n(7)))

# N7: branch on skip vs real report
nodes.append({
    "uuid": n(7), "actions": [],
    "router": {
        "wait": {"type": "msg"}, "type": "switch", "result_name": "",
        "operand": "@results.notf_report_text", "default_category_uuid": c(7, 2),
        "categories": [
            {"uuid": c(7, 1), "name": "Skip", "exit_uuid": e(7, 1)},
            {"uuid": c(7, 2), "name": "Report", "exit_uuid": e(7, 2)}
        ],
        "cases": [
            {"uuid": cas(7, 1), "type": "has_only_phrase", "category_uuid": c(7, 1), "arguments": ["skip"]}
        ]
    },
    "exits": [
        {"uuid": e(7, 1), "destination_uuid": n(20)},
        {"uuid": e(7, 2), "destination_uuid": n(8)}
    ]
})

# N8: call_webhook -> Supabase REST insert
nodes.append({
    "uuid": n(8),
    "actions": [{
        "uuid": a(8),
        "type": "call_webhook",
        "url": f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}",
        "method": "POST",
        "result_name": "notf_push",
        "headers": {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        "body": json.dumps({
            "contact_name": "@contact.name",
            "phone": "@contact.phone",
            "report_text": "@results.notf_report_text",
            "reported_at": "@(NOW())"
        })
    }],
    "exits": [{"uuid": e(8), "destination_uuid": n(9)}]
})

# N9: check webhook status (confirmed pattern: @webhook.status 200-299 = Success)
nodes.append({
    "uuid": n(9), "actions": [],
    "router": {
        "type": "switch", "result_name": "", "operand": "@webhook.status",
        "default_category_uuid": c(9, 2),
        "categories": [
            {"uuid": c(9, 1), "name": "Success", "exit_uuid": e(9, 1)},
            {"uuid": c(9, 2), "name": "Failure", "exit_uuid": e(9, 2)}
        ],
        "cases": [
            {"uuid": cas(9, 1), "type": "has_number_between", "category_uuid": c(9, 1), "arguments": ["200", "299"]}
        ]
    },
    "exits": [
        {"uuid": e(9, 1), "destination_uuid": n(10)},
        {"uuid": e(9, 2), "destination_uuid": n(11)}
    ]
})

# N10: success confirmation
nodes.append({
    "uuid": n(10),
    "actions": [{
        "uuid": a(10), "type": "send_msg",
        "text": (
            "✅ *Got it — thank you!*\n\n"
            "Your report has been logged with the Sauramandala team. "
            "Send *NOTF* any time to report something else or ask for updates."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(10), "destination_uuid": None}]
})

# N11: failure fallback — still acknowledge, tag for manual follow-up
nodes.append({
    "uuid": n(11),
    "actions": [
        {
            "uuid": a(11, 0), "type": "add_input_labels",
            "labels": [{"name": "notf_webhook_failed"}]
        },
        {
            "uuid": a(11, 1), "type": "send_msg",
            "text": (
                "✅ *Thanks — noted!*\n\n"
                "We've recorded that you reached out. If you don't hear back and it's urgent, "
                "please follow up directly with your Sauramandala contact.\n\n"
                "Send *NOTF* any time to reach us again."
            ),
            "quick_replies": [], "labels": [], "attachments": []
        }
    ],
    "exits": [{"uuid": e(11), "destination_uuid": None}]
})

# N20: skip path — just confirm opt-in choice was saved
nodes.append({
    "uuid": n(20),
    "actions": [{
        "uuid": a(20), "type": "send_msg",
        "text": (
            "👍 No worries — you're set for updates.\n\n"
            "Send *NOTF* any time you want to report something or check in."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(20), "destination_uuid": None}]
})

data = {
    "interactive_templates": INTERACTIVE_TEMPLATES,
    "contact_field": ["notf_optin"],
    "collections": [],
    "flows": [{
        "keywords": ["notf", "NOTF"],
        "definition": {
            "uuid": FLOW_UUID,
            "name": "NOTF Event Updates & Reporting",
            "type": "messaging",
            "spec_version": "14.3.0",
            "language": "base",
            "expire_after_minutes": 10080,
            "localization": {},
            "_ui": {"nodes": {}, "stickies": {}},
            "vars": [],
            "nodes": nodes
        }
    }]
}

output = json.dumps(data, indent=2, ensure_ascii=False)
with open("/home/user/sauramandala-report/notf/NOTF_Flow.json", "w") as f:
    f.write(output)

print(f"NOTF flow: {len(nodes)} nodes, keywords={data['flows'][0]['keywords']}")
print(f"Interactive templates: {len(INTERACTIVE_TEMPLATES)}")

all_uuids = {node["uuid"] for node in nodes}
errors = []
for node in nodes:
    for ex in node["exits"]:
        dest = ex.get("destination_uuid")
        if dest and dest not in all_uuids:
            errors.append(f"BROKEN LINK: {node['uuid'][:12]} -> {dest[:12]}")
print("All UUID references valid ✓" if not errors else "\n".join(errors))

import re
bad = 0
for m in re.finditer(r'[0-9a-f-]{30,40}', output):
    parts = m.group(0).split("-")
    if len(parts) == 5 and not (len(parts[0]) == 8 and len(parts[1]) == 4 and len(parts[2]) == 4 and len(parts[3]) == 4 and len(parts[4]) == 12):
        bad += 1
print(f"Malformed UUID segments: {bad}")
print(f"File size: {len(output):,} bytes")
