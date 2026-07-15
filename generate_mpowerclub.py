"""
Generate CMYC_mPowerClub.json — 7 Glific flows for mPowerClub YF simulation.

F1 Onboard -> F2 Journey -> (enter) F6 Form Club -> back to F2 -> demo Add Member/Attendance/Report
F3 Add Member (addmember), F4 Attendance (attendance), F5 Activity Report (report)
F7 Club Ideas (clubideas) — themed activity push + link/photo submission, standalone entry point
"""
import json

def n(flow, node):
    """Node UUID"""
    return f"{flow:02d}{node:03d}000-0000-4000-8000-{flow:02d}{node:03d}0000000"

def a(flow, node, sub=0):
    """Action UUID"""
    return f"{flow:02d}{node:03d}{sub:03d}-aaaa-4000-8000-{flow:02d}{node:03d}{sub:03d}aaaa"

def e(flow, node, sub=0):
    """Exit UUID"""
    return f"{flow:02d}{node:03d}{sub:03d}-eeee-4000-8000-{flow:02d}{node:03d}{sub:03d}eeee"

def c(flow, node, sub=0):
    """Category UUID"""
    return f"{flow:02d}{node:03d}{sub:03d}-cccc-4000-8000-{flow:02d}{node:03d}{sub:03d}cccc"

def cas(flow, node, sub=0):
    """Case UUID"""
    return f"{flow:02d}{node:03d}{sub:03d}-ca00-4000-8000-{flow:02d}{node:03d}{sub:03d}ca00"

F1 = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1"
F2 = "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2"
F3 = "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3"
F4 = "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"
F5 = "f5f5f5f5-f5f5-4f5f-8f5f-f5f5f5f5f5f5"
F6 = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6"
F7 = "f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f7f7"

INTERACTIVE_TEMPLATES = []
_TEMPLATE_ID_BASE = 9100000

def send(fl, nd, text):
    return {
        "uuid": n(fl, nd),
        "actions": [{
            "uuid": a(fl, nd),
            "type": "send_msg",
            "text": text,
            "quick_replies": [],
            "labels": [],
            "attachments": []
        }],
        "exits": [{"uuid": e(fl, nd), "destination_uuid": n(fl, nd + 1)}]
    }

def wait_any(fl, nd, result_name, dest=None):
    dest = dest or n(fl, nd + 1)
    return {
        "uuid": n(fl, nd),
        "actions": [],
        "router": {
            "wait": {"type": "msg"},
            "type": "switch",
            "result_name": result_name,
            "operand": "@input.text",
            "default_category_uuid": c(fl, nd, 1),
            "categories": [
                {"uuid": c(fl, nd, 1), "name": "Any", "exit_uuid": e(fl, nd, 1)}
            ],
            "cases": []
        },
        "exits": [{"uuid": e(fl, nd, 1), "destination_uuid": dest}]
    }

def wait_timeout(fl, nd, dest=None, seconds=600):
    """Confirmed-working delay: wait_for_time action (router timeout is silently ignored by Glific)."""
    dest = dest or n(fl, nd + 1)
    return {
        "uuid": n(fl, nd),
        "actions": [
            {"uuid": a(fl, nd), "type": "wait_for_time", "delay": str(seconds)}
        ],
        "router": {
            "type": "switch",
            "operand": "@input.text",
            "default_category_uuid": c(fl, nd, 1),
            "categories": [
                {"uuid": c(fl, nd, 1), "name": "Completed", "exit_uuid": e(fl, nd, 1)}
            ],
            "cases": []
        },
        "exits": [{"uuid": e(fl, nd, 1), "destination_uuid": dest}]
    }

def wait_12(fl, nd, result_name, dest_yes, dest_no, dest_retry):
    return {
        "uuid": n(fl, nd),
        "actions": [],
        "router": {
            "wait": {"type": "msg"},
            "type": "switch",
            "result_name": result_name,
            "operand": "@input.text",
            "default_category_uuid": c(fl, nd, 3),
            "categories": [
                {"uuid": c(fl, nd, 1), "name": "Yes", "exit_uuid": e(fl, nd, 1)},
                {"uuid": c(fl, nd, 2), "name": "No", "exit_uuid": e(fl, nd, 2)},
                {"uuid": c(fl, nd, 3), "name": "Other", "exit_uuid": e(fl, nd, 3)}
            ],
            "cases": [
                {"uuid": cas(fl, nd, 1), "type": "has_any_word", "category_uuid": c(fl, nd, 1), "arguments": ["1"]},
                {"uuid": cas(fl, nd, 2), "type": "has_any_word", "category_uuid": c(fl, nd, 2), "arguments": ["2"]}
            ]
        },
        "exits": [
            {"uuid": e(fl, nd, 1), "destination_uuid": dest_yes},
            {"uuid": e(fl, nd, 2), "destination_uuid": dest_no},
            {"uuid": e(fl, nd, 3), "destination_uuid": dest_retry}
        ]
    }

def wait_15(fl, nd, result_name, dest):
    """1-5 numbered router — all choices go to same destination. Used where a scale exceeds the
    3-option cap of interactive quick replies."""
    return {
        "uuid": n(fl, nd),
        "actions": [],
        "router": {
            "wait": {"type": "msg"},
            "type": "switch",
            "result_name": result_name,
            "operand": "@input.text",
            "default_category_uuid": c(fl, nd, 6),
            "categories": [
                {"uuid": c(fl, nd, i), "name": str(i), "exit_uuid": e(fl, nd, i)} for i in range(1, 6)
            ] + [{"uuid": c(fl, nd, 6), "name": "Other", "exit_uuid": e(fl, nd, 6)}],
            "cases": [
                {"uuid": cas(fl, nd, i), "type": "has_any_word", "category_uuid": c(fl, nd, i), "arguments": [str(i)]} for i in range(1, 6)
            ]
        },
        "exits": [
            {"uuid": e(fl, nd, i), "destination_uuid": dest} for i in range(1, 6)
        ] + [{"uuid": e(fl, nd, 6), "destination_uuid": n(fl, nd)}]
    }

def set_fields(fl, nd, fields, dest=None):
    dest = dest or n(fl, nd + 1)
    actions = []
    for i, (key, val) in enumerate(fields):
        actions.append({
            "uuid": a(fl, nd, i),
            "type": "set_contact_field",
            "field": {"key": key, "name": key},
            "value": val
        })
    return {
        "uuid": n(fl, nd),
        "actions": actions,
        "exits": [{"uuid": e(fl, nd), "destination_uuid": dest}]
    }

def enter_flow(fl, nd, target_uuid, target_name):
    return {
        "uuid": n(fl, nd),
        "actions": [{
            "uuid": a(fl, nd),
            "type": "enter_flow",
            "flow": {"uuid": target_uuid, "name": target_name}
        }],
        "exits": [{"uuid": e(fl, nd), "destination_uuid": None}]
    }

def enter_flow_and_wait(fl, nd, target_uuid, target_name, dest_after):
    """enter_flow + a @child.status router (confirmed pattern) so the parent flow
    resumes once the sub-flow completes, instead of ending silently."""
    enter_node = {
        "uuid": n(fl, nd),
        "actions": [{
            "uuid": a(fl, nd),
            "type": "enter_flow",
            "flow": {"uuid": target_uuid, "name": target_name}
        }],
        "exits": [{"uuid": e(fl, nd), "destination_uuid": n(fl, nd + 1)}]
    }
    status_node = {
        "uuid": n(fl, nd + 1),
        "router": {
            "type": "switch",
            "operand": "@child.status",
            "default_category_uuid": c(fl, nd + 1, 1),
            "categories": [
                {"uuid": c(fl, nd + 1, 1), "name": "Complete", "exit_uuid": e(fl, nd + 1, 1)}
            ],
            "cases": [
                {"uuid": cas(fl, nd + 1, 1), "type": "has_only_text", "category_uuid": c(fl, nd + 1, 1), "arguments": ["completed"]}
            ]
        },
        "exits": [{"uuid": e(fl, nd + 1, 1), "destination_uuid": dest_after}],
        "actions": []
    }
    return [enter_node, status_node]

def interactive_quick_reply(fl, nd, label, header, text, options, result_name, option_dests, other_dest=None):
    """
    Confirmed shape from real Glific export (test_list.json).
    options: list of option titles (max 3).
    option_dests: list of destination node uuids, same length as options.
    other_dest: fallback destination if reply doesn't match any option (defaults to retry same node).
    Returns [msg_node, router_node] — reserves node slots nd and nd+1.
    """
    template_id = _TEMPLATE_ID_BASE + fl * 1000 + nd
    interactive_content = {
        "type": "quick_reply",
        "content": {"type": "text", "header": header, "text": text},
        "options": [{"type": "text", "title": o} for o in options]
    }
    INTERACTIVE_TEMPLATES.append({
        "source_id": template_id,
        "type": "quick_reply",
        "label": label,
        "language_id": 1,
        "send_with_title": False,
        "interactive_content": interactive_content,
        "translations": {"1": interactive_content}
    })
    msg_node = {
        "uuid": n(fl, nd),
        "actions": [{
            "uuid": a(fl, nd),
            "type": "send_interactive_msg",
            "id": template_id,
            "name": label,
            "text": json.dumps(interactive_content, ensure_ascii=False),
            "labels": [],
            "attachment_url": "",
            "attachment_type": ""
        }],
        "exits": [{"uuid": e(fl, nd), "destination_uuid": n(fl, nd + 1)}]
    }
    other_dest = other_dest or n(fl, nd)
    categories = []
    cases = []
    exits = []
    for i, (opt, dest) in enumerate(zip(options, option_dests), start=1):
        categories.append({"uuid": c(fl, nd + 1, i), "name": opt, "exit_uuid": e(fl, nd + 1, i)})
        cases.append({"uuid": cas(fl, nd + 1, i), "type": "has_only_phrase", "category_uuid": c(fl, nd + 1, i), "arguments": [opt]})
        exits.append({"uuid": e(fl, nd + 1, i), "destination_uuid": dest})
    other_i = len(options) + 1
    categories.append({"uuid": c(fl, nd + 1, other_i), "name": "Other", "exit_uuid": e(fl, nd + 1, other_i)})
    exits.append({"uuid": e(fl, nd + 1, other_i), "destination_uuid": other_dest})
    router_node = {
        "uuid": n(fl, nd + 1),
        "router": {
            "wait": {"type": "msg"},
            "type": "switch",
            "result_name": result_name,
            "operand": "@input.text",
            "default_category_uuid": c(fl, nd + 1, other_i),
            "categories": categories,
            "cases": cases
        },
        "exits": exits,
        "actions": []
    }
    return [msg_node, router_node]

# ──────────────────────────────────────────────
# FLOW 1: YF ONBOARD  (keyword: mpowerclub)
# ──────────────────────────────────────────────
fl = 1
onboard_nodes = [
    send(fl, 1,
        "🌱 *mPowerClub — Youth Facilitator Simulation*\n\n"
        "This flow simulates the digital journey of a Youth Facilitator (YF) in Sauramandala's CMYC programme.\n\n"
        "👤 *Who is a Youth Facilitator?*\n"
        "A YF is a trained community youth worker who:\n"
        "• Forms and runs mPowerClubs in their community\n"
        "• Recruits young people (14–25 yrs) as club members\n"
        "• Plans and conducts activities (discussions, games, skills)\n"
        "• Reports to a Centre Coordinator (CC)\n\n"
        "🎭 *You are playing the role of a YF.*\n"
        "Lines marked [REAL] show what happens in live deployment. Lines marked [SIMULATION] "
        "show what this test flow is standing in for.\n\n"
        "🧑‍🤝‍🧑 A reminder: mPowerClubs are *real, in-person* youth groups. Everything here — the "
        "club, the members, the sessions — represents real community work. WhatsApp is just how "
        "you and Sauramandala stay coordinated between meetings.\n\n"
        "Reply anything to begin 👇"
    ),
    wait_any(fl, 2, "ready_confirm"),
    send(fl, 3, "Let's set up your YF profile.\n\nWhat is your full name?"),
    wait_any(fl, 4, "yf_name"),
    set_fields(fl, 5, [("full_name", "@results.yf_name")]),
    send(fl, 6,
        "Which CMYC centre are you attached to?\n\n"
        "(Type the name, e.g. \"Mawlai Centre\" or \"Nongthymmai Centre\")\n\n"
        "[REAL] In deployment, your Centre Coordinator would already have registered the centre "
        "and invited you as a YF before you onboard."
    ),
    wait_any(fl, 7, "centre_input"),
    set_fields(fl, 8, [
        ("centre_name", "@results.centre_input"),
        ("cmyc_role", "youth_facilitator"),
        ("yf_status", "active")
    ]),
    send(fl, 9,
        "✅ *YF Profile saved!*\n\n"
        "👤 *Name:* @results.yf_name\n"
        "🏢 *Centre:* @results.centre_input\n"
        "🎯 *Role:* Youth Facilitator\n\n"
        "You are now registered as an mPowerClub Youth Facilitator.\n\n"
        "🚀 Let's form your first club..."
    ),
    enter_flow(fl, 10, F2, "mPowerClub YF Journey")
]
onboard_nodes[8]["exits"][0]["destination_uuid"] = n(fl, 10)

# ──────────────────────────────────────────────
# FLOW 2: YF JOURNEY  (orchestrator — enters Form Club, then demos the toolkit)
# ──────────────────────────────────────────────
fl = 2
j_nodes = []

j_nodes.append(send(fl, 1,
    "🎓 *Welcome to your YF Orientation!*\n\n"
    "First, let's form your mPowerClub — the real, in-person group you'll be running. "
    "Everything after that (adding members, attendance, reports) happens on top of a club that "
    "actually exists in your community.\n\n"
    "Reply anything to start forming your club 👇"
))
j_nodes.append(wait_any(fl, 2, "ready_form", dest=n(fl, 3)))
j_nodes += enter_flow_and_wait(fl, 3, F6, "mPowerClub Form Club", dest_after=n(fl, 5))
# nodes 3,4 consumed by enter_flow_and_wait; node 5 continues

j_nodes.append(send(fl, 5,
    "🎉 Club formed! Here's your toolkit — use these keywords *any time*, not just now:\n\n"
    "📋 *Your keywords:*\n"
    "• *addmember* — Register a new club member\n"
    "• *attendance* — Record session attendance\n"
    "• *clubideas* — Get a themed activity idea for your club, and share what you made\n"
    "• *report* — Submit a session report\n\n"
    "[REAL] You'd also get reminders from your CC and periodic tips. This orientation shows you "
    "each keyword once so you know what to expect.\n\n"
    "⏳ In 2 minutes, let's try adding your first club member... (or reply now to skip ahead)"
))
j_nodes.append(wait_timeout(fl, 6, dest=n(fl, 7), seconds=120))
j_nodes.append(send(fl, 7,
    "👥 *Let's simulate adding a member.*\n\n"
    "[REAL] In live deployment you'd share the bot number directly with a young person in your "
    "community and they'd register themselves by sending *smjoin*. This flow (*addmember*) is for "
    "when a member doesn't have WhatsApp and you're registering them on their behalf.\n\n"
    "Send *addmember* now to try it, or reply anything to continue this orientation without it."
))
j_nodes.append(wait_any(fl, 8, "member_orient_ack", dest=n(fl, 9)))
j_nodes.append(send(fl, 9,
    "👍 Whenever you're ready, here's the rest of the toolkit:\n\n"
    "*attendance* — after every real session, log how many showed up. Takes under a minute.\n\n"
    "*clubideas* — when you need a fresh activity, ask here first. It's themed to your club "
    "and gives you something to actually run, not just read.\n\n"
    "*report* — after you run an idea, tell us how it went and share a link or photo if you have one.\n\n"
    "🎉 *That's the full mPowerClub toolkit.* Nothing here is graded — it exists so your on-the-ground "
    "work is visible to your CC and the programme team, and so you get useful ideas back, not just "
    "forms to fill.\n\n"
    "Welcome to mPowerClub, @contact.fields.full_name.value! 🌱"
))
j_nodes[-1]["exits"][0]["destination_uuid"] = None

# ──────────────────────────────────────────────
# FLOW 3: ADD MEMBER  (keyword: addmember) — interactive gender + WhatsApp
# ──────────────────────────────────────────────
fl = 3
addmember_nodes = []
addmember_nodes.append(send(fl, 1,
    "👥 *Register a Club Member*\n\n"
    "[REAL] Youth with WhatsApp register themselves by sending *smjoin*. Use this flow for members "
    "who don't have WhatsApp, or to keep your own roster.\n\n"
    "[SIMULATION] Registering a member for your club: @contact.fields.club_name.value\n\n"
    "*Member's full name?*"
))
addmember_nodes.append(wait_any(fl, 2, "member_name", dest=n(fl, 3)))
addmember_nodes.append(send(fl, 3, "*Member's age?* (e.g. \"16\")"))
addmember_nodes.append(wait_any(fl, 4, "member_age", dest=n(fl, 5)))
addmember_nodes += interactive_quick_reply(
    fl, 5, "Member Gender", "Member Gender",
    "Member's gender?",
    ["Female", "Male", "Prefer not to say"],
    "member_gender",
    [n(fl, 7), n(fl, 7), n(fl, 7)]
)
# nodes 5,6 consumed; node 7 next
addmember_nodes += interactive_quick_reply(
    fl, 7, "Member WhatsApp", "Does this member have WhatsApp?",
    "Do they have WhatsApp? If yes, they can register themselves next time by sending *smjoin*.",
    ["Yes", "No"],
    "member_has_whatsapp",
    [n(fl, 9), n(fl, 9)]
)
# nodes 7,8 consumed; node 9 next
addmember_nodes.append({
    "uuid": n(fl, 9),
    "actions": [{
        "uuid": a(fl, 9),
        "type": "send_msg",
        "text": (
            "✅ *Member Registered!*\n\n"
            "👤 *Name:* @results.member_name\n"
            "🎂 *Age:* @results.member_age\n"
            "♀️ *Gender:* @results.member_gender\n"
            "📱 *WhatsApp:* @results.member_has_whatsapp\n"
            "🏆 *Club:* @contact.fields.club_name.value\n\n"
            "[REAL] This member is now part of your club record. If they have WhatsApp, they'd be "
            "invited to join your club's WhatsApp group directly.\n\n"
            "Send *addmember* to register another member."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 9), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 4: ATTENDANCE  (keyword: attendance)
# ──────────────────────────────────────────────
fl = 4
attendance_nodes = []
attendance_nodes.append(send(fl, 1,
    "📋 *Record Session Attendance*\n\n"
    "Club: @contact.fields.club_name.value\n"
    "YF: @contact.fields.full_name.value\n\n"
    "[REAL] This goes to your Centre Coordinator in real time — a quick log, not a form to dread.\n\n"
    "*Which session is this?*\n(e.g. \"Session 1\", \"Week 3 meeting\")"
))
attendance_nodes.append(wait_any(fl, 2, "session_desc", dest=n(fl, 3)))
attendance_nodes.append(send(fl, 3, "*How many youth were present?*\n(Type a number)"))
attendance_nodes.append(wait_any(fl, 4, "attendance_count", dest=n(fl, 5)))
attendance_nodes += interactive_quick_reply(
    fl, 5, "Session Notable", "Anything notable?",
    "Anything worth flagging from this session?",
    ["New member joined", "Something came up", "All routine"],
    "attendance_flag",
    [n(fl, 7), n(fl, 7), n(fl, 7)]
)
# nodes 5,6 consumed; node 7 next
attendance_nodes.append(send(fl, 7, "Tell us more in a line or two (or type *skip*):"))
attendance_nodes.append(wait_any(fl, 8, "attendance_notes", dest=n(fl, 9)))
attendance_nodes.append({
    "uuid": n(fl, 9),
    "actions": [{
        "uuid": a(fl, 9),
        "type": "send_msg",
        "text": (
            "✅ *Attendance Recorded!*\n\n"
            "📋 *Session:* @results.session_desc\n"
            "👥 *Present:* @results.attendance_count\n"
            "🏷️ *Flag:* @results.attendance_flag\n"
            "📝 *Notes:* @results.attendance_notes\n"
            "🏆 *Club:* @contact.fields.club_name.value\n\n"
            "Your CC has been notified. Keep it up — regular attendance builds stronger clubs 💪\n\n"
            "Want a fresh activity? Send *clubideas*."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 9), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 5: ACTIVITY REPORT  (keyword: report) — + link/photo submission, interactive support
# ──────────────────────────────────────────────
fl = 5
report_nodes = []
report_nodes.append(send(fl, 1,
    "📊 *Activity Report*\n\n"
    "Club: @contact.fields.club_name.value\n"
    "YF: @contact.fields.full_name.value\n\n"
    "[REAL] This helps the programme team see what's working on the ground and get you better "
    "ideas and resources — not just paperwork.\n\n"
    "*What activity did your club do?*\n\n"
    "1 - Icebreaker / introductions\n"
    "2 - Group discussion\n"
    "3 - Creative (art, drama, music)\n"
    "4 - Outdoor / physical\n"
    "5 - Community service / action\n"
    "6 - An idea from *clubideas*"
))
report_nodes.append({
    "uuid": n(fl, 2),
    "actions": [],
    "router": {
        "wait": {"type": "msg"}, "type": "switch", "result_name": "report_activity",
        "operand": "@input.text", "default_category_uuid": c(fl, 2, 7),
        "categories": [{"uuid": c(fl, 2, i), "name": str(i), "exit_uuid": e(fl, 2, i)} for i in range(1, 7)]
                      + [{"uuid": c(fl, 2, 7), "name": "Other", "exit_uuid": e(fl, 2, 7)}],
        "cases": [{"uuid": cas(fl, 2, i), "type": "has_any_word", "category_uuid": c(fl, 2, i), "arguments": [str(i)]} for i in range(1, 7)]
    },
    "exits": [{"uuid": e(fl, 2, i), "destination_uuid": n(fl, 3)} for i in range(1, 7)]
             + [{"uuid": e(fl, 2, 7), "destination_uuid": n(fl, 2)}]
})
report_nodes.append(send(fl, 3,
    "*How did the session go overall?*\n\n"
    "1 - 😰 Very challenging\n2 - 😕 Struggled a bit\n3 - 😐 It was okay\n4 - 😊 Went well\n5 - 🌟 Excellent!"
))
report_nodes.append(wait_15(fl, 4, "report_rating", dest=n(fl, 5)))
report_nodes.append(send(fl, 5, "*What was one thing that worked well?*\n\n(Be honest and specific — it goes to the programme team)"))
report_nodes.append(wait_any(fl, 6, "report_win", dest=n(fl, 7)))
report_nodes.append(send(fl, 7, "*What was one challenge or difficulty?*\n(e.g. \"Low turnout\", \"Topic was too complex\")"))
report_nodes.append(wait_any(fl, 8, "report_challenge", dest=n(fl, 9)))
report_nodes.append(send(fl, 9,
    "📸 *Got a link or photo from this session?*\n\n"
    "Paste a link to a reel/post you made, or send a photo now. Type *skip* if you don't have one.\n\n"
    "[REAL] These get shared (with consent) to show other clubs what's possible."
))
report_nodes.append(wait_any(fl, 10, "report_media", dest=n(fl, 11)))
report_nodes += interactive_quick_reply(
    fl, 11, "Support Needed", "Need support?",
    "Do you need any support from your Centre Coordinator?",
    ["Yes, contact me", "No, all good"],
    "report_support_needed",
    [n(fl, 13), n(fl, 13)]
)
# nodes 11,12 consumed; node 13 final
report_nodes.append({
    "uuid": n(fl, 13),
    "actions": [{
        "uuid": a(fl, 13),
        "type": "send_msg",
        "text": (
            "✅ *Report Submitted!*\n\n"
            "📊 *Activity:* @results.report_activity\n"
            "⭐ *Rating:* @results.report_rating\n"
            "💚 *What worked:* @results.report_win\n"
            "⚠️ *Challenge:* @results.report_challenge\n"
            "📸 *Link/photo:* @results.report_media\n"
            "🆘 *Support needed:* @results.report_support_needed\n\n"
            "[REAL] Your CC and the programme team have this now. If you asked for support, expect "
            "a call within 24 hours.\n\n"
            "Keep going — you're building something real. 🌱"
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 13), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 6: FORM CLUB  (entered from Journey; not keyword-triggered)
# ──────────────────────────────────────────────
fl = 6
form_nodes = []
form_nodes.append(send(fl, 1,
    "🏗️ *Let's form your mPowerClub!*\n\n"
    "[REAL] Club formation means bringing 8–15 young people together from your community, holding "
    "a first meeting, and choosing a name and focus together. It's real, in-person work — this flow "
    "just helps you register what you've built so Sauramandala can support it.\n\n"
    "First — every mPowerClub has a theme that shapes the kind of activities it runs. What fits your "
    "group best?"
))
form_nodes[-1]["exits"][0]["destination_uuid"] = n(fl, 2)
form_nodes += interactive_quick_reply(
    fl, 2, "Club Theme", "Club Theme",
    "Pick your club's theme:",
    ["Arts & Culture", "Sports & Wellness", "Community Action"],
    "club_theme_choice",
    [n(fl, 4), n(fl, 4), n(fl, 4)]
)
# nodes 2,3 consumed; node 4 next
form_nodes.append(set_fields(fl, 4, [("club_theme", "@results.club_theme_choice")], dest=n(fl, 5)))
form_nodes.append(send(fl, 5,
    "*What will you name your club?*\n(e.g. \"Rising Stars Club\", \"Green Valley Youth\")"
))
form_nodes.append(wait_any(fl, 6, "club_name", dest=n(fl, 7)))
form_nodes.append(set_fields(fl, 7, [("club_name", "@results.club_name")], dest=n(fl, 8)))
form_nodes.append(send(fl, 8, "*Which community or area is this club based in?*\n(e.g. \"Mawphlang village\", \"Nongkynmaw\")"))
form_nodes.append(wait_any(fl, 9, "club_area_input", dest=n(fl, 10)))
form_nodes.append(set_fields(fl, 10, [("club_area", "@results.club_area_input")], dest=n(fl, 11)))
form_nodes += interactive_quick_reply(
    fl, 11, "Club Size", "How big is your club?",
    "Roughly how many young people are involved so far?",
    ["1–8", "9–15", "16+"],
    "club_size_choice",
    [n(fl, 13), n(fl, 13), n(fl, 13)]
)
# nodes 11,12 consumed; node 13 next
form_nodes.append(set_fields(fl, 13, [("club_size", "@results.club_size_choice")], dest=n(fl, 14)))

# Theme-branch router → tailored first-session kit
form_nodes.append({
    "uuid": n(fl, 14),
    "actions": [],
    "router": {
        "type": "switch", "operand": "@contact.fields.club_theme.value",
        "default_category_uuid": c(fl, 14, 4),
        "categories": [
            {"uuid": c(fl, 14, 1), "name": "Arts", "exit_uuid": e(fl, 14, 1)},
            {"uuid": c(fl, 14, 2), "name": "Sports", "exit_uuid": e(fl, 14, 2)},
            {"uuid": c(fl, 14, 3), "name": "Community", "exit_uuid": e(fl, 14, 3)},
            {"uuid": c(fl, 14, 4), "name": "Other", "exit_uuid": e(fl, 14, 4)}
        ],
        "cases": [
            {"uuid": cas(fl, 14, 1), "type": "has_only_phrase", "category_uuid": c(fl, 14, 1), "arguments": ["Arts & Culture"]},
            {"uuid": cas(fl, 14, 2), "type": "has_only_phrase", "category_uuid": c(fl, 14, 2), "arguments": ["Sports & Wellness"]},
            {"uuid": cas(fl, 14, 3), "type": "has_only_phrase", "category_uuid": c(fl, 14, 3), "arguments": ["Community Action"]}
        ]
    },
    "exits": [
        {"uuid": e(fl, 14, 1), "destination_uuid": n(fl, 15)},
        {"uuid": e(fl, 14, 2), "destination_uuid": n(fl, 16)},
        {"uuid": e(fl, 14, 3), "destination_uuid": n(fl, 17)},
        {"uuid": e(fl, 14, 4), "destination_uuid": n(fl, 15)}
    ]
})
form_nodes.append(send(fl, 15,
    "🎨 *First Session Kit — Arts & Culture*\n\n"
    "Try this for your first meeting: each member brings one object that represents \"home\" "
    "(a photo, a small item, even a drawing) and tells its story in 2 minutes. Close by picking "
    "your first group project — a mural, a short skit, or a photo series.\n\n"
    "⏭️ Continuing your orientation..."
))
form_nodes[-1]["exits"][0]["destination_uuid"] = n(fl, 18)
form_nodes.append(send(fl, 16,
    "🏃 *First Session Kit — Sports & Wellness*\n\n"
    "Try this for your first meeting: a simple team game everyone can play regardless of skill "
    "(tag variants work well), followed by a group check-in — one word for how everyone's feeling. "
    "Close by agreeing on a regular practice day and time.\n\n"
    "⏭️ Continuing your orientation..."
))
form_nodes[-1]["exits"][0]["destination_uuid"] = n(fl, 18)
form_nodes.append(send(fl, 17,
    "🤝 *First Session Kit — Community Action*\n\n"
    "Try this for your first meeting: map one real problem in your area everyone cares about "
    "(water, waste, safety — anything), and brainstorm one small action the club could take in "
    "the next month. Close by picking who does what.\n\n"
    "⏭️ Continuing your orientation..."
))
form_nodes[-1]["exits"][0]["destination_uuid"] = n(fl, 18)
form_nodes.append({
    "uuid": n(fl, 18),
    "actions": [{
        "uuid": a(fl, 18),
        "type": "send_msg",
        "text": (
            "✅ *Club Registered!*\n\n"
            "🏆 *Name:* @contact.fields.club_name.value\n"
            "🎨 *Theme:* @contact.fields.club_theme.value\n"
            "📍 *Area:* @contact.fields.club_area.value\n"
            "👥 *Size:* @contact.fields.club_size.value\n"
            "🧑‍🏫 *YF:* @contact.fields.full_name.value\n\n"
            "[REAL] Your Centre Coordinator would now set up a WhatsApp group for your club's "
            "members, so you can broadcast ideas straight to them via *clubideas*. Until that group "
            "exists, *clubideas* sends suggestions to you directly."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 18), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 7: CLUB IDEAS  (keyword: clubideas) — themed idea push + proof-of-work loop
# ──────────────────────────────────────────────
fl = 7
CI_IDEAS = {
    "Arts & Culture": [
        ("A 2-minute story circle", "Each member tells a 2-minute true story about a moment that changed them. No feedback, just listening. End by asking: what's one story worth turning into a skit?"),
        ("Found-object photo challenge", "Everyone photographs one object in their home/neighbourhood that tells a story about your community. Share and discuss as a group next session."),
    ],
    "Sports & Wellness": [
        ("Peer-led warmup rotation", "Each session, a different member leads the warmup game. Builds leadership and keeps energy fresh. Rotate through the whole club over a month."),
        ("Community fitness challenge", "Design a simple weekly challenge (steps, a stretch routine) the whole club tracks together, not individually — win or lose as a team."),
    ],
    "Community Action": [
        ("Micro-survey", "In pairs, ask 5 neighbours one question about a local issue your club cares about. Bring answers back next session to spot patterns."),
        ("One-day clean-up or fix-up", "Pick one small, doable local task (a shared space, a path, a wall) your club can complete together in a single afternoon."),
    ],
}

ci_nodes = []
ci_nodes.append(send(fl, 1,
    "💡 *Club Ideas*\n\n"
    "[REAL] Ideally your CC pushes ideas straight to your club's WhatsApp group. Since your club's "
    "group isn't set up yet, this comes to you directly — pass it on to your members however works "
    "for your club.\n\n"
    "Finding an idea for: @contact.fields.club_name.value (@contact.fields.club_theme.value)"
))
ci_nodes[-1]["exits"][0]["destination_uuid"] = n(fl, 2)

# Theme router -> picks idea set
ci_nodes.append({
    "uuid": n(fl, 2),
    "actions": [],
    "router": {
        "type": "switch", "operand": "@contact.fields.club_theme.value",
        "default_category_uuid": c(fl, 2, 4),
        "categories": [
            {"uuid": c(fl, 2, 1), "name": "Arts", "exit_uuid": e(fl, 2, 1)},
            {"uuid": c(fl, 2, 2), "name": "Sports", "exit_uuid": e(fl, 2, 2)},
            {"uuid": c(fl, 2, 3), "name": "Community", "exit_uuid": e(fl, 2, 3)},
            {"uuid": c(fl, 2, 4), "name": "Other", "exit_uuid": e(fl, 2, 4)}
        ],
        "cases": [
            {"uuid": cas(fl, 2, 1), "type": "has_only_phrase", "category_uuid": c(fl, 2, 1), "arguments": ["Arts & Culture"]},
            {"uuid": cas(fl, 2, 2), "type": "has_only_phrase", "category_uuid": c(fl, 2, 2), "arguments": ["Sports & Wellness"]},
            {"uuid": cas(fl, 2, 3), "type": "has_only_phrase", "category_uuid": c(fl, 2, 3), "arguments": ["Community Action"]}
        ]
    },
    "exits": [
        {"uuid": e(fl, 2, 1), "destination_uuid": n(fl, 3)},
        {"uuid": e(fl, 2, 2), "destination_uuid": n(fl, 3)},
        {"uuid": e(fl, 2, 3), "destination_uuid": n(fl, 3)},
        {"uuid": e(fl, 2, 4), "destination_uuid": n(fl, 3)}
    ]
})

# Node 3: present idea #1 of the (arbitrary, theme-agnostic default) Community Action set as the
# baseline text — theme-specific text is delivered via three parallel branches below instead,
# since @results interpolation can't index into a Python dict at runtime.
title_arts, body_arts = CI_IDEAS["Arts & Culture"][0]
title_sport, body_sport = CI_IDEAS["Sports & Wellness"][0]
title_comm, body_comm = CI_IDEAS["Community Action"][0]

# Re-route theme node directly to theme-specific idea nodes instead of shared node 3.
ci_nodes[-1]["exits"] = [
    {"uuid": e(fl, 2, 1), "destination_uuid": n(fl, 10)},
    {"uuid": e(fl, 2, 2), "destination_uuid": n(fl, 20)},
    {"uuid": e(fl, 2, 3), "destination_uuid": n(fl, 30)},
    {"uuid": e(fl, 2, 4), "destination_uuid": n(fl, 30)}
]

def idea_branch(base, title_a, body_a, title_b, body_b):
    """Two ideas for one theme with 'try / see other / skip' quick replies."""
    nodes = []
    nodes.append(send(fl, base, f"🎯 *Idea: {title_a}*\n\n{body_a}"))
    nodes[-1]["exits"][0]["destination_uuid"] = n(fl, base + 1)
    nodes += interactive_quick_reply(
        fl, base + 1, f"Idea Action {base}", "What now?",
        "What would you like to do?",
        ["Try this idea", "See another idea", "Skip for now"],
        "idea_action",
        [n(fl, base + 9), n(fl, base + 3), n(fl, base + 9)]
    )
    # base+1, base+2 consumed
    nodes.append(send(fl, base + 3, f"🎯 *Idea: {title_b}*\n\n{body_b}"))
    nodes[-1]["exits"][0]["destination_uuid"] = n(fl, base + 4)
    nodes += interactive_quick_reply(
        fl, base + 4, f"Idea Action {base}b", "What now?",
        "What would you like to do?",
        ["Try this idea", "Skip for now", "Skip for now"],
        "idea_action_2",
        [n(fl, base + 9), n(fl, base + 9), n(fl, base + 9)]
    )
    # base+4, base+5 consumed; converge on base+9
    nodes.append({
        "uuid": n(fl, base + 9),
        "actions": [{
            "uuid": a(fl, base + 9),
            "type": "send_msg",
            "text": (
                "Got it! When you've run it with your club:\n\n"
                "📊 Send *report* to log how it went and share a link or photo\n"
                "👥 Send *addmember* if anyone new joined in\n\n"
                "Come back to *clubideas* any time you need a fresh one."
            ),
            "quick_replies": [], "labels": [], "attachments": []
        }],
        "exits": [{"uuid": e(fl, base + 9), "destination_uuid": None}]
    })
    return nodes

ci_nodes += idea_branch(10, title_arts, body_arts, *CI_IDEAS["Arts & Culture"][1])
ci_nodes += idea_branch(20, title_sport, body_sport, *CI_IDEAS["Sports & Wellness"][1])
ci_nodes += idea_branch(30, title_comm, body_comm, *CI_IDEAS["Community Action"][1])

# ──────────────────────────────────────────────
# ASSEMBLE
# ──────────────────────────────────────────────
data = {
    "interactive_templates": INTERACTIVE_TEMPLATES,
    "contact_field": [
        "full_name", "cmyc_role", "centre_name",
        "club_name", "club_area", "club_theme", "club_size", "yf_status"
    ],
    "collections": [],
    "flows": [
        {"keywords": ["mpowerclub"], "definition": {
            "uuid": F1, "name": "mPowerClub YF Onboard", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": onboard_nodes
        }},
        {"keywords": [], "definition": {
            "uuid": F2, "name": "mPowerClub YF Journey", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": j_nodes
        }},
        {"keywords": ["addmember"], "definition": {
            "uuid": F3, "name": "mPowerClub Add Member", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": addmember_nodes
        }},
        {"keywords": ["attendance"], "definition": {
            "uuid": F4, "name": "mPowerClub Attendance", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": attendance_nodes
        }},
        {"keywords": ["report"], "definition": {
            "uuid": F5, "name": "mPowerClub Activity Report", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": report_nodes
        }},
        {"keywords": [], "definition": {
            "uuid": F6, "name": "mPowerClub Form Club", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": form_nodes
        }},
        {"keywords": ["clubideas"], "definition": {
            "uuid": F7, "name": "mPowerClub Club Ideas", "type": "messaging", "spec_version": "14.3.0",
            "language": "base", "expire_after_minutes": 10080, "localization": {},
            "_ui": {"nodes": {}, "stickies": {}}, "vars": [], "nodes": ci_nodes
        }}
    ]
}

output = json.dumps(data, indent=2, ensure_ascii=False)
with open("/home/user/sauramandala-report/CMYC_mPowerClub.json", "w") as f:
    f.write(output)

print("Flows generated:")
for flow in data["flows"]:
    d = flow["definition"]
    print(f"  {d['name']}: {len(d['nodes'])} nodes, keywords={flow['keywords']}")
print(f"Interactive templates: {len(INTERACTIVE_TEMPLATES)}")

all_node_uuids = set()
for flow in data["flows"]:
    for node in flow["definition"]["nodes"]:
        all_node_uuids.add(node["uuid"])

errors = []
for flow in data["flows"]:
    for node in flow["definition"]["nodes"]:
        for ex in node["exits"]:
            dest = ex.get("destination_uuid")
            if dest and dest not in all_node_uuids:
                errors.append(f"  BROKEN LINK: {node['uuid'][:12]} -> {dest[:12]} (flow {flow['definition']['name']})")
        r = node.get("router", {})
        for cat in r.get("categories", []):
            exit_uuid = cat.get("exit_uuid")
            found = any(ex["uuid"] == exit_uuid for ex in node["exits"])
            if not found:
                errors.append(f"  BROKEN CAT EXIT: node {node['uuid'][:12]} cat {cat['name']}")

if errors:
    print("ERRORS:")
    for err in errors:
        print(err)
else:
    print("All UUID references valid ✓")

# UUID shape validation
import re
bad_uuids = 0
for match in re.finditer(r'[0-9a-f-]{30,40}', output):
    parts = match.group(0).split("-")
    if len(parts) == 5 and not (len(parts[0]) == 8 and len(parts[1]) == 4 and len(parts[2]) == 4 and len(parts[3]) == 4 and len(parts[4]) == 12):
        bad_uuids += 1
print(f"Malformed UUID segments: {bad_uuids}")

print(f"Total file size: {len(output):,} bytes")
