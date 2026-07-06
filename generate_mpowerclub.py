"""
Generate CMYC_mPowerClub.json — 5 Glific flows for mPowerClub YF simulation.
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

def flow_uuid(f):
    return f"f{f:01d}f{f:01d}f{f:01d}f{f:01d}-f{f:01d}f{f:01d}-4{f:01d}f{f:01d}-8{f:01d}f{f:01d}-f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}f{f:01d}"

F1 = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1"
F2 = "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2"
F3 = "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3"
F4 = "f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4"
F5 = "f5f5f5f5-f5f5-4f5f-8f5f-f5f5f5f5f5f5"

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
        "exits": [{"uuid": e(fl, nd), "destination_uuid": n(fl, nd+1)}]
    }

def send_terminal(fl, nd, text):
    node = send(fl, nd, text)
    node["exits"][0]["destination_uuid"] = None
    return node

def wait_any(fl, nd, result_name, dest=None):
    dest = dest or n(fl, nd+1)
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
    """Confirmed-working delay: wait_for_time action (not router timeout, which Glific ignores)."""
    dest = dest or n(fl, nd+1)
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
        "exits": [
            {"uuid": e(fl, nd, 1), "destination_uuid": dest}
        ]
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
    """1-5 router — all choices go to same destination."""
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
        ] + [{"uuid": e(fl, nd, 6), "destination_uuid": n(fl, nd)}]  # retry on other
    }

def set_fields(fl, nd, fields, dest=None):
    """Node with multiple set_contact_field actions."""
    dest = dest or n(fl, nd+1)
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
        "Lines marked [REAL] show what happens in live deployment.\n\n"
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
        "🚀 Starting your orientation journey...\n\n"
        "[SIMULATION] You will receive tips and prompts every 10 minutes. "
        "Reply to any message to move faster, or just wait."
    ),
    enter_flow(fl, 10, F2, "mPowerClub YF Journey")
]

# Override node 9 exit to point to node 10
onboard_nodes[8]["exits"][0]["destination_uuid"] = n(fl, 10)

# ──────────────────────────────────────────────
# FLOW 2: YF JOURNEY SIMULATION
# ──────────────────────────────────────────────
fl = 2

j_nodes = []

# J1: Welcome overview (immediate on enter)
j_nodes.append(send(fl, 1,
    "🎓 *Welcome to your YF Orientation!*\n\n"
    "Here is what you can do as a Youth Facilitator on WhatsApp:\n\n"
    "📋 *Your keywords (use anytime):*\n"
    "• *addmember* — Register a new club member\n"
    "• *attendance* — Record session attendance\n"
    "• *report* — Submit an activity report\n\n"
    "You will also receive:\n"
    "📌 Facilitation tips\n"
    "📚 Activity ideas and session plans\n"
    "📊 Weekly report prompts\n"
    "🗓 Session reminders from your CC\n\n"
    "[REAL] In live deployment you would also receive calls to action from your Centre Coordinator "
    "and see your club's progress on a dashboard.\n\n"
    "⏳ First tip in 10 minutes... (or reply anything to receive it now)"
))

# J2: Timeout wait → Tip 1
j_nodes.append(wait_timeout(fl, 2, dest=n(fl, 3)))

# J3: Tip 1
j_nodes.append(send(fl, 3,
    "💡 *Tip #1 — The mPowerClub Way*\n\n"
    "mPowerClubs are youth-led spaces. Your job as YF is to:\n\n"
    "1️⃣ *Invite, not recruit* — Let youth choose to join\n"
    "2️⃣ *Facilitate, not teach* — Ask questions, don't lecture\n"
    "3️⃣ *Document, don't just do* — Every session is a data point\n\n"
    "🏆 A strong mPowerClub has:\n"
    "• 8–15 regular members\n"
    "• Weekly or bi-weekly meetings\n"
    "• At least one activity per session\n"
    "• A safe, consistent meeting space\n\n"
    "[REAL] This tip would reach you 2 days after onboarding. "
    "You will get 8 tips over 4 weeks.\n\n"
    "⏳ Next: Setting up your first club... (10 min or reply to continue)"
))

# J4: Timeout wait → Club setup
j_nodes.append(wait_timeout(fl, 4, dest=n(fl, 5)))

# J5: Ask club name
j_nodes.append(send(fl, 5,
    "🏗️ *Let's set up your first mPowerClub!*\n\n"
    "[REAL] Club formation means bringing 8–15 young people together from your community, "
    "holding a first meeting, and choosing a name together.\n\n"
    "[SIMULATION] We will create your club here to show how it works in the system.\n\n"
    "*What will you name your club?*\n"
    "(e.g. \"Rising Stars Club\", \"Green Valley Youth\", \"New Horizon Club\")"
))

# J6: Wait for club name
j_nodes.append(wait_any(fl, 6, "club_name", dest=n(fl, 7)))

# J7: Set club_name, ask area
j_nodes.append({
    "uuid": n(fl, 7),
    "actions": [
        {
            "uuid": a(fl, 7, 0),
            "type": "set_contact_field",
            "field": {"key": "club_name", "name": "club_name"},
            "value": "@results.club_name"
        }
    ],
    "exits": [{"uuid": e(fl, 7), "destination_uuid": n(fl, 8)}]
})

# J8: Ask club area
j_nodes.append(send(fl, 8,
    "Great name! 👏\n\n"
    "*Which community or area is this club based in?*\n"
    "(e.g. \"Mawphlang village\", \"Upper Shillong ward 5\", \"Nongkynmaw\")"
))

# J9: Wait for area
j_nodes.append(wait_any(fl, 9, "club_area_input", dest=n(fl, 10)))

# J10: Set club_area
j_nodes.append(set_fields(fl, 10, [("club_area", "@results.club_area_input")], dest=n(fl, 11)))

# J11: Club confirmed
j_nodes.append(send(fl, 11,
    "✅ *Club Registered!*\n\n"
    "🏆 *Club Name:* @results.club_name\n"
    "📍 *Area:* @results.club_area_input\n"
    "👤 *YF:* @contact.fields.full_name.value\n\n"
    "[REAL] In live deployment, this club would appear on your Centre Coordinator's dashboard. "
    "You would receive a club ID to use in all reports.\n\n"
    "⏳ Tip #2 coming in 10 minutes... (or reply to continue)"
))

# J12: Timeout wait → Tip 2
j_nodes.append(wait_timeout(fl, 12, dest=n(fl, 13)))

# J13: Tip 2
j_nodes.append(send(fl, 13,
    "💡 *Tip #2 — Planning Your First Session*\n\n"
    "A great first session:\n\n"
    "🕐 *Duration:* 60–90 minutes\n"
    "👥 *Opening:* Names game / icebreaker (15 min)\n"
    "🗣️ *Main:* Discussion or activity (30–40 min)\n"
    "📋 *Closing:* Reflections + next meeting date (10 min)\n\n"
    "*3 things to prepare:*\n"
    "1. A simple icebreaker game\n"
    "2. One open discussion question\n"
    "3. A notebook to record attendance\n\n"
    "[REAL] You would receive a full session plan from your CC 3 days before your first session.\n\n"
    "⏳ Next: Adding a club member... (10 min or reply to continue)"
))

# J14: Timeout wait → Member sim
j_nodes.append(wait_timeout(fl, 14, dest=n(fl, 15)))

# J15: Member sim intro + ask name
j_nodes.append(send(fl, 15,
    "👥 *Adding a Club Member*\n\n"
    "[REAL] In live deployment you share the bot number with youth in your community. "
    "They send *smjoin* and register as Club Members — selecting CMYC → Youth Member. "
    "They join your club's WhatsApp group automatically.\n\n"
    "[SIMULATION] We will collect one member's details here to show how it works.\n\n"
    "*Member's full name?*"
))

# J16: Wait for member name
j_nodes.append(wait_any(fl, 16, "member_name_sim", dest=n(fl, 17)))

# J17: Ask age
j_nodes.append(send(fl, 17, "*How old are they?* (e.g. \"17\")"))

# J18: Wait for age
j_nodes.append(wait_any(fl, 18, "member_age_sim", dest=n(fl, 19)))

# J19: Ask WhatsApp — retry node at J19r
j_nodes.append(send(fl, 19,
    "*Do they have WhatsApp?*\n\n"
    "1 - Yes\n"
    "2 - No\n\n"
    "[REAL] If yes, they will be invited to message the bot and register directly. "
    "If no, the YF submits their data."
))

# J19r: Retry node for WhatsApp question (node 35 = retry slot)
# Using node 35 for retry
whatsapp_retry = {
    "uuid": n(fl, 35),
    "actions": [{
        "uuid": a(fl, 35),
        "type": "send_msg",
        "text": "Please reply 1 (Yes) or 2 (No).",
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 35), "destination_uuid": n(fl, 20)}]
}

# J20: 1/2 router for WhatsApp
j_nodes.append(wait_12(fl, 20, "member_whatsapp",
    dest_yes=n(fl, 21),
    dest_no=n(fl, 21),
    dest_retry=n(fl, 35)
))

# J21: Member confirmed
j_nodes.append(send(fl, 21,
    "✅ *Member noted!*\n\n"
    "*Name:* @results.member_name_sim\n"
    "*Age:* @results.member_age_sim\n"
    "*WhatsApp:* @results.member_whatsapp\n\n"
    "[REAL] In deployment this would:\n"
    "• Register them as a contact in the system\n"
    "• Add them to your club's group\n"
    "• Send them a welcome message\n"
    "• Track their attendance over time\n\n"
    "⏳ Attendance recording in 10 minutes... (or reply to continue)"
))

# J22: Timeout wait → Attendance
j_nodes.append(wait_timeout(fl, 22, dest=n(fl, 23)))

# J23: Attendance prompt
j_nodes.append(send(fl, 23,
    "📋 *Session Attendance*\n\n"
    "[SIMULATION] Imagine you just ran your first mPowerClub session!\n\n"
    "[REAL] After every session, you record attendance here. "
    "Your CC sees this in real time and follows up if attendance is low or a member is absent repeatedly.\n\n"
    "*How many youth attended your (simulated) first session?*\n"
    "(Type a number, e.g. \"12\")"
))

# J24: Wait for attendance count
j_nodes.append(wait_any(fl, 24, "attendance_count_sim", dest=n(fl, 25)))

# J25: Attendance confirmed
j_nodes.append(send(fl, 25,
    "✅ *Attendance recorded: @results.attendance_count_sim youth*\n\n"
    "Great work running your first session! 🎉\n\n"
    "[REAL] This data feeds into Sauramandala's monitoring system. "
    "Clubs with consistent attendance receive more resources and facilitator support.\n\n"
    "⏳ Activity report in 10 minutes... (or reply to continue)"
))

# J26: Timeout wait → Activity report
j_nodes.append(wait_timeout(fl, 26, dest=n(fl, 27)))

# J27: Activity type prompt
j_nodes.append(send(fl, 27,
    "📊 *Activity Report*\n\n"
    "[REAL] After each session you submit a short report. "
    "This helps Sauramandala track what activities work best across all clubs.\n\n"
    "*What activity did you do in this session?*\n\n"
    "1 - Icebreaker / introductions\n"
    "2 - Group discussion\n"
    "3 - Creative (art, drama, music)\n"
    "4 - Outdoor / physical\n"
    "5 - Community service / action"
))

# J28: 1-5 router for activity type
j_nodes.append(wait_15(fl, 28, "activity_type_sim", dest=n(fl, 29)))

# J29: Rating prompt
j_nodes.append(send(fl, 29,
    "*How did the session go?*\n\n"
    "1 - 😰 Very challenging\n"
    "2 - 😕 Struggled a bit\n"
    "3 - 😐 It was okay\n"
    "4 - 😊 Went well\n"
    "5 - 🌟 Excellent!"
))

# J30: Wait for rating (any input accepted)
j_nodes.append(wait_any(fl, 30, "activity_rating_sim", dest=n(fl, 31)))

# J31: Ask what worked
j_nodes.append(send(fl, 31,
    "*What was one thing that worked well?*\n\n"
    "(Type freely — this goes directly to the programme team)"
))

# J32: Wait for win
j_nodes.append(wait_any(fl, 32, "activity_win_sim", dest=n(fl, 33)))

# J33: Ask challenge
j_nodes.append(send(fl, 33, "*What was one challenge or difficulty you faced?*"))

# J34: Wait for challenge
j_nodes.append(wait_any(fl, 34, "activity_challenge_sim", dest=n(fl, 36)))

# J35 = whatsapp retry node (added separately)
j_nodes.append(whatsapp_retry)

# J36: Completion
j_nodes.append({
    "uuid": n(fl, 36),
    "actions": [{
        "uuid": a(fl, 36),
        "type": "send_msg",
        "text": (
            "🎉 *Simulation Complete!*\n\n"
            "You have experienced the full mPowerClub YF journey:\n\n"
            "✅ Onboarded as Youth Facilitator\n"
            "✅ Received orientation tips\n"
            "✅ Set up club: @contact.fields.club_name.value\n"
            "✅ Added a club member (simulated)\n"
            "✅ Recorded attendance\n"
            "✅ Submitted activity report\n\n"
            "📋 *Your keywords — use anytime:*\n"
            "• *addmember* — Add a new member\n"
            "• *attendance* — Record a session\n"
            "• *report* — Submit activity report\n\n"
            "[REAL] In live deployment you would also:\n"
            "📅 Receive session reminders from your CC\n"
            "📚 Get 8 tips over 4 weeks\n"
            "📊 Submit weekly summary reports\n"
            "🏆 Track your club's growth over time\n\n"
            "Welcome to mPowerClub, @contact.fields.full_name.value! 🌱\n\n"
            "Sauramandala CMYC Programme"
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 36), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 3: ADD MEMBER  (keyword: addmember)
# ──────────────────────────────────────────────
fl = 3

addmember_nodes = []

# F3N1: Intro
addmember_nodes.append(send(fl, 1,
    "👥 *Register a Club Member*\n\n"
    "[REAL] In live deployment, you share the bot number with youth and they register themselves. "
    "This flow lets you register a member on their behalf — for example if they don't have WhatsApp.\n\n"
    "[SIMULATION] Registering a member for your club: @contact.fields.club_name.value\n\n"
    "*Member's full name?*"
))

# F3N2: Wait for name
addmember_nodes.append(wait_any(fl, 2, "member_name", dest=n(fl, 3)))

# F3N3: Ask age
addmember_nodes.append(send(fl, 3, "*Member's age?* (e.g. \"16\")"))

# F3N4: Wait for age
addmember_nodes.append(wait_any(fl, 4, "member_age", dest=n(fl, 5)))

# F3N5: Ask gender
addmember_nodes.append(send(fl, 5,
    "*Member's gender?*\n\n"
    "1 - Female\n"
    "2 - Male\n"
    "3 - Prefer not to say"
))

# F3N6: 1-2-3 router for gender (all to same destination)
addmember_nodes.append({
    "uuid": n(fl, 6),
    "actions": [],
    "router": {
        "wait": {"type": "msg"},
        "type": "switch",
        "result_name": "member_gender",
        "operand": "@input.text",
        "default_category_uuid": c(fl, 6, 4),
        "categories": [
            {"uuid": c(fl, 6, 1), "name": "Female", "exit_uuid": e(fl, 6, 1)},
            {"uuid": c(fl, 6, 2), "name": "Male", "exit_uuid": e(fl, 6, 2)},
            {"uuid": c(fl, 6, 3), "name": "NotSay", "exit_uuid": e(fl, 6, 3)},
            {"uuid": c(fl, 6, 4), "name": "Other", "exit_uuid": e(fl, 6, 4)}
        ],
        "cases": [
            {"uuid": cas(fl, 6, 1), "type": "has_any_word", "category_uuid": c(fl, 6, 1), "arguments": ["1"]},
            {"uuid": cas(fl, 6, 2), "type": "has_any_word", "category_uuid": c(fl, 6, 2), "arguments": ["2"]},
            {"uuid": cas(fl, 6, 3), "type": "has_any_word", "category_uuid": c(fl, 6, 3), "arguments": ["3"]}
        ]
    },
    "exits": [
        {"uuid": e(fl, 6, 1), "destination_uuid": n(fl, 7)},
        {"uuid": e(fl, 6, 2), "destination_uuid": n(fl, 7)},
        {"uuid": e(fl, 6, 3), "destination_uuid": n(fl, 7)},
        {"uuid": e(fl, 6, 4), "destination_uuid": n(fl, 6)}  # retry
    ]
})

# F3N7: Ask WhatsApp
addmember_nodes.append(send(fl, 7,
    "*Do they have WhatsApp?*\n\n"
    "1 - Yes (they can message the bot directly)\n"
    "2 - No (YF registers on their behalf)"
))

# F3N8: Retry node for WhatsApp
addmember_nodes.append({
    "uuid": n(fl, 8),
    "actions": [{
        "uuid": a(fl, 8),
        "type": "send_msg",
        "text": "Please reply 1 (Yes) or 2 (No).",
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 8), "destination_uuid": n(fl, 9)}]
})

# F3N9: 1/2 router
addmember_nodes.append(wait_12(fl, 9, "member_has_whatsapp",
    dest_yes=n(fl, 10),
    dest_no=n(fl, 10),
    dest_retry=n(fl, 8)
))

# F3N10: Confirmed
addmember_nodes.append({
    "uuid": n(fl, 10),
    "actions": [{
        "uuid": a(fl, 10),
        "type": "send_msg",
        "text": (
            "✅ *Member Registered!*\n\n"
            "👤 *Name:* @results.member_name\n"
            "🎂 *Age:* @results.member_age\n"
            "♀️ *Gender:* @results.member_gender\n"
            "📱 *WhatsApp:* @results.member_has_whatsapp\n"
            "🏆 *Club:* @contact.fields.club_name.value\n\n"
            "[REAL] This member is now added to your club record. "
            "If they have WhatsApp, they will receive a welcome message and can access the programme independently.\n\n"
            "Send *addmember* to register another member."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 10), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 4: ATTENDANCE  (keyword: attendance)
# ──────────────────────────────────────────────
fl = 4

attendance_nodes = []

# F4N1: Intro
attendance_nodes.append(send(fl, 1,
    "📋 *Record Session Attendance*\n\n"
    "Club: @contact.fields.club_name.value\n"
    "YF: @contact.fields.full_name.value\n\n"
    "[REAL] This goes to your Centre Coordinator and Sauramandala's monitoring dashboard in real time.\n\n"
    "*Which session is this?*\n"
    "(e.g. \"Session 1\", \"Week 3 meeting\", \"28 June session\")"
))

# F4N2: Wait for session description
attendance_nodes.append(wait_any(fl, 2, "session_desc", dest=n(fl, 3)))

# F4N3: Ask count
attendance_nodes.append(send(fl, 3, "*How many youth were present?*\n(Type a number)"))

# F4N4: Wait for count
attendance_nodes.append(wait_any(fl, 4, "attendance_count", dest=n(fl, 5)))

# F4N5: Ask notes
attendance_nodes.append(send(fl, 5,
    "*Any notable moments from this session?*\n\n"
    "(e.g. \"New member joined\", \"Discussion got heated but resolved well\", or type *skip* to skip)"
))

# F4N6: Wait for notes
attendance_nodes.append(wait_any(fl, 6, "attendance_notes", dest=n(fl, 7)))

# F4N7: Confirmed
attendance_nodes.append({
    "uuid": n(fl, 7),
    "actions": [{
        "uuid": a(fl, 7),
        "type": "send_msg",
        "text": (
            "✅ *Attendance Recorded!*\n\n"
            "📋 *Session:* @results.session_desc\n"
            "👥 *Present:* @results.attendance_count\n"
            "📝 *Notes:* @results.attendance_notes\n"
            "🏆 *Club:* @contact.fields.club_name.value\n\n"
            "[REAL] Your CC has been notified. "
            "Keep up the consistency — regular attendance builds stronger clubs! 💪\n\n"
            "Send *report* to submit an activity report for this session."
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 7), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# FLOW 5: ACTIVITY REPORT  (keyword: report)
# ──────────────────────────────────────────────
fl = 5

report_nodes = []

# F5N1: Intro
report_nodes.append(send(fl, 1,
    "📊 *Activity Report*\n\n"
    "Club: @contact.fields.club_name.value\n"
    "YF: @contact.fields.full_name.value\n\n"
    "[REAL] This report goes to Sauramandala's programme team. "
    "It helps them understand what is working, send you better resources, and support struggling clubs.\n\n"
    "*What activity did your club do?*\n\n"
    "1 - Icebreaker / introductions\n"
    "2 - Group discussion\n"
    "3 - Creative (art, drama, music)\n"
    "4 - Outdoor / physical\n"
    "5 - Community service / action"
))

# F5N2: 1-5 router for activity
report_nodes.append(wait_15(fl, 2, "report_activity", dest=n(fl, 3)))

# F5N3: Rating
report_nodes.append(send(fl, 3,
    "*How did the session go overall?*\n\n"
    "1 - 😰 Very challenging\n"
    "2 - 😕 Struggled a bit\n"
    "3 - 😐 It was okay\n"
    "4 - 😊 Went well\n"
    "5 - 🌟 Excellent!"
))

# F5N4: Wait rating (any)
report_nodes.append(wait_any(fl, 4, "report_rating", dest=n(fl, 5)))

# F5N5: What worked
report_nodes.append(send(fl, 5,
    "*What was one thing that worked well?*\n\n"
    "(This goes directly to your programme team — be honest and specific)"
))

# F5N6: Wait win
report_nodes.append(wait_any(fl, 6, "report_win", dest=n(fl, 7)))

# F5N7: Challenge
report_nodes.append(send(fl, 7,
    "*What was one challenge or difficulty?*\n\n"
    "(e.g. \"Low turnout\", \"Topic was too complex\", \"Venue issue\")"
))

# F5N8: Wait challenge
report_nodes.append(wait_any(fl, 8, "report_challenge", dest=n(fl, 9)))

# F5N9: Support needed?
report_nodes.append(send(fl, 9,
    "*Do you need any support from your Centre Coordinator?*\n\n"
    "1 - Yes, please contact me\n"
    "2 - No, all good"
))

# F5N10: Wait support (1/2 → same destination)
report_nodes.append(wait_12(fl, 10, "report_support_needed",
    dest_yes=n(fl, 11),
    dest_no=n(fl, 11),
    dest_retry=n(fl, 10)
))

# F5N11: Confirmed
report_nodes.append({
    "uuid": n(fl, 11),
    "actions": [{
        "uuid": a(fl, 11),
        "type": "send_msg",
        "text": (
            "✅ *Report Submitted!*\n\n"
            "📊 *Activity:* @results.report_activity\n"
            "⭐ *Rating:* @results.report_rating\n"
            "💚 *What worked:* @results.report_win\n"
            "⚠️ *Challenge:* @results.report_challenge\n"
            "🆘 *Support needed:* @results.report_support_needed\n\n"
            "[REAL] Your CC and the programme team have received this. "
            "If you requested support, expect a call within 24 hours.\n\n"
            "Keep going — you are building something important. 🌱"
        ),
        "quick_replies": [], "labels": [], "attachments": []
    }],
    "exits": [{"uuid": e(fl, 11), "destination_uuid": None}]
})

# ──────────────────────────────────────────────
# ASSEMBLE
# ──────────────────────────────────────────────
data = {
    "interactive_templates": [],
    "contact_field": [
        "full_name",
        "cmyc_role",
        "centre_name",
        "club_name",
        "club_area",
        "yf_status"
    ],
    "collections": [],
    "flows": [
        {
            "keywords": ["mpowerclub"],
            "definition": {
                "uuid": F1,
                "name": "mPowerClub YF Onboard",
                "type": "messaging",
                "spec_version": "14.3.0",
                "language": "base",
                "expire_after_minutes": 10080,
                "localization": {},
                "_ui": {"nodes": {}, "stickies": {}},
                "vars": [],
                "nodes": onboard_nodes
            }
        },
        {
            "keywords": [],
            "definition": {
                "uuid": F2,
                "name": "mPowerClub YF Journey",
                "type": "messaging",
                "spec_version": "14.3.0",
                "language": "base",
                "expire_after_minutes": 10080,
                "localization": {},
                "_ui": {"nodes": {}, "stickies": {}},
                "vars": [],
                "nodes": j_nodes
            }
        },
        {
            "keywords": ["addmember"],
            "definition": {
                "uuid": F3,
                "name": "mPowerClub Add Member",
                "type": "messaging",
                "spec_version": "14.3.0",
                "language": "base",
                "expire_after_minutes": 10080,
                "localization": {},
                "_ui": {"nodes": {}, "stickies": {}},
                "vars": [],
                "nodes": addmember_nodes
            }
        },
        {
            "keywords": ["attendance"],
            "definition": {
                "uuid": F4,
                "name": "mPowerClub Attendance",
                "type": "messaging",
                "spec_version": "14.3.0",
                "language": "base",
                "expire_after_minutes": 10080,
                "localization": {},
                "_ui": {"nodes": {}, "stickies": {}},
                "vars": [],
                "nodes": attendance_nodes
            }
        },
        {
            "keywords": ["report"],
            "definition": {
                "uuid": F5,
                "name": "mPowerClub Activity Report",
                "type": "messaging",
                "spec_version": "14.3.0",
                "language": "base",
                "expire_after_minutes": 10080,
                "localization": {},
                "_ui": {"nodes": {}, "stickies": {}},
                "vars": [],
                "nodes": report_nodes
            }
        }
    ]
}

output = json.dumps(data, indent=2, ensure_ascii=False)
with open("/home/user/sauramandala-report/CMYC_mPowerClub.json", "w") as f:
    f.write(output)

# Sanity checks
print("Flows generated:")
for flow in data["flows"]:
    d = flow["definition"]
    print(f"  {d['name']}: {len(d['nodes'])} nodes, keywords={flow['keywords']}")

# Check all destination UUIDs exist
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
                errors.append(f"  BROKEN LINK: {node['uuid'][:12]} → {dest[:12]}")
        r = node.get("router", {})
        for cat in r.get("categories", []):
            exit_uuid = cat.get("exit_uuid")
            found = any(ex["uuid"] == exit_uuid for ex in node["exits"])
            if not found:
                errors.append(f"  BROKEN CAT EXIT: node {node['uuid'][:12]} cat {cat['name']} exit {exit_uuid[:12]}")

if errors:
    print("ERRORS:")
    for e in errors:
        print(e)
else:
    print("All UUID references valid ✓")

print(f"Total file size: {len(output):,} bytes")
