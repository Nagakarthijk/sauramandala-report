"""Role + age-group definitions and signup flow helpers."""

ROLES: dict[str, dict] = {
    "1": {"key": "parent",    "label": "Parent / Caregiver",    "emoji": "👨‍👩‍👧"},
    "2": {"key": "teacher",   "label": "Teacher",                "emoji": "📚"},
    "3": {"key": "anganwadi", "label": "Anganwadi Worker",       "emoji": "🌸"},
    "4": {"key": "volunteer", "label": "Community Volunteer",    "emoji": "🤝"},
    "5": {"key": "learner",   "label": "Young Learner (teen)",   "emoji": "🌱"},
}

AGE_GROUPS: dict[str, dict] = {
    "1": {"key": "toddler", "label": "Toddlers (2–4 yrs)",        "emoji": "🐣"},
    "2": {"key": "early",   "label": "Early childhood (5–7 yrs)", "emoji": "🌻"},
    "3": {"key": "primary", "label": "Primary (8–10 yrs)",        "emoji": "📖"},
    "4": {"key": "upper",   "label": "Upper primary (11–13 yrs)", "emoji": "🔭"},
    "5": {"key": "mixed",   "label": "Mixed / All ages",          "emoji": "🌈"},
}

# Human-readable descriptions used in AI prompts
ROLE_DESCRIPTIONS = {
    "parent":    "a parent or caregiver at home",
    "teacher":   "a school teacher",
    "anganwadi": "an Anganwadi early-childhood care worker",
    "volunteer": "a community volunteer running informal learning sessions",
    "learner":   "a young learner reading independently",
}

AGE_DESCRIPTIONS = {
    "toddler": "toddlers aged 2–4",
    "early":   "children aged 5–7",
    "primary": "children aged 8–10",
    "upper":   "young people aged 11–13",
    "mixed":   "a mixed age group (2–13 years)",
}


def role_menu() -> str:
    lines = ["Who are you? Reply with the number:"]
    for num, r in ROLES.items():
        lines.append(f"{num}. {r['emoji']} {r['label']}")
    return "\n".join(lines)


def age_menu() -> str:
    lines = ["What age group do you mainly work with?"]
    for num, a in AGE_GROUPS.items():
        lines.append(f"{num}. {a['emoji']} {a['label']}")
    return "\n".join(lines)


def welcome_message(name: str, role_key: str, age_key: str, total_stories: int) -> str:
    role = next((r for r in ROLES.values() if r["key"] == role_key), ROLES["1"])
    age = next((a for a in AGE_GROUPS.values() if a["key"] == age_key), AGE_GROUPS["5"])
    return (
        f"🌟 You're all set, {name}!\n\n"
        f"{role['emoji']} *Role:* {role['label']}\n"
        f"{age['emoji']} *Age group:* {age['label']}\n\n"
        f"You'll get *2 stories a week* (Mon & Thu), each with activities tailored for you.\n"
        f"We have *{total_stories} stories* waiting — plus activities, videos & bonus tips.\n\n"
        f"*Commands:*\n"
        f"• NEXT — get your next story now\n"
        f"• LIST — browse all stories\n"
        f"• SCORE — see your points & badges\n"
        f"• HELP — all commands\n\n"
        f"Reply *NEXT* to get your first story right now! 🚀"
    )
