"""
DRIVE API — REST endpoints called by the field agent PWA.

All endpoints require authentication via ERPNext API token.
Each user must have an API Key + Secret generated in their ERPNext profile.

PWA calls: GET/POST https://your-erp-site.com/api/method/drive.drive.drive.api.<function>
Headers:   Authorization: token <api_key>:<api_secret>
"""

import frappe
import json
import requests as _requests
from frappe import _


def _company():
    """Current user's default company."""
    return frappe.defaults.get_user_default("Company")


# ── Entrepreneurs ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_entrepreneurs():
    return frappe.get_list("Entrepreneur",
        fields=["name", "entrepreneur_name", "phone", "business_name",
                "sector", "entity_type", "location", "stage", "last_contact",
                "assigned_to", "creation", "modified"],
        filters={"company": _company()},
        order_by="modified desc",
        limit_page_length=1000
    )


@frappe.whitelist()
def get_entrepreneur(name):
    doc = frappe.get_doc("Entrepreneur", name)
    frappe.has_permission("Entrepreneur", doc=doc, throw=True)
    return doc.as_dict()


@frappe.whitelist()
def add_entrepreneur(data):
    if isinstance(data, str):
        data = json.loads(data)
    doc = frappe.get_doc({
        "doctype": "Entrepreneur",
        "company": _company(),
        "entrepreneur_name": data.get("name") or data.get("entrepreneur_name"),
        "phone":             data.get("phone"),
        "business_name":     data.get("business_name") or data.get("biz"),
        "sector":            data.get("sector"),
        "entity_type":       data.get("entity_type"),
        "location":          data.get("location"),
        "consent_given":     data.get("consent_given", 0),
        "stage":             "lead",
        "assigned_to":       frappe.session.user,
    })
    doc.insert()
    frappe.db.commit()
    return doc.as_dict()


# ── Need Journeys ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_need_journeys(entrepreneur):
    return frappe.get_list("Need Journey",
        fields=["name", "need", "stage", "aspiration", "confidence",
                "payment", "observations", "referral", "deferred_reason", "modified"],
        filters={"entrepreneur": entrepreneur},
        order_by="need asc"
    )


@frappe.whitelist()
def upsert_need_journey(entrepreneur, need, data):
    if isinstance(data, str):
        data = json.loads(data)
    existing = frappe.get_value("Need Journey",
        {"entrepreneur": entrepreneur, "need": need}, "name")

    if existing:
        doc = frappe.get_doc("Need Journey", existing)
        doc.update({k: v for k, v in data.items()
                    if k in ("stage", "aspiration", "confidence", "payment",
                             "observations", "deferred_reason", "referral")})
        doc.save()
    else:
        doc = frappe.get_doc({
            "doctype": "Need Journey",
            "entrepreneur": entrepreneur,
            "need": need,
            "stage": data.get("stage", "observed"),
            "aspiration": data.get("aspiration"),
            "confidence": data.get("confidence"),
            "payment": data.get("payment"),
            "observations": data.get("observations", ""),
        })
        doc.insert()
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist()
def add_need_observation(entrepreneur, need, text):
    existing = frappe.get_value("Need Journey",
        {"entrepreneur": entrepreneur, "need": need}, ["name", "observations"],
        as_dict=True)

    from frappe.utils import now
    timestamp = frappe.utils.format_datetime(now(), "dd MMM yyyy, HH:mm")
    new_line = f"[{timestamp}] {text}"

    if existing:
        current = existing.observations or ""
        updated = (current + "\n" + new_line).strip()
        frappe.db.set_value("Need Journey", existing.name, "observations", updated)
    else:
        doc = frappe.get_doc({
            "doctype": "Need Journey",
            "entrepreneur": entrepreneur,
            "need": need,
            "stage": "observed",
            "observations": new_line,
        })
        doc.insert()
    frappe.db.commit()
    return {"ok": True}


# ── Referrals ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_referrals(entrepreneur=None, status=None, provider=None):
    filters = {"company": _company()}
    if entrepreneur: filters["entrepreneur"] = entrepreneur
    if status:       filters["status"]       = status
    if provider:     filters["provider"]     = provider

    return frappe.get_list("Referral",
        fields=["name", "entrepreneur", "provider", "service", "status",
                "commission", "commission_status", "deadline", "escalated",
                "notes", "creation", "modified",
                "entrepreneur.entrepreneur_name as entrepreneur_name",
                "entrepreneur.location as entrepreneur_location"],
        filters=filters,
        order_by="creation desc",
        limit_page_length=500
    )


@frappe.whitelist()
def add_referral(data):
    if isinstance(data, str):
        data = json.loads(data)
    doc = frappe.get_doc({
        "doctype": "Referral",
        "entrepreneur":  data.get("entrepreneur_id") or data.get("entrepreneur"),
        "provider":      data.get("provider_id") or data.get("provider") or None,
        "service":       data.get("service"),
        "commission":    data.get("commission", 0),
        "deadline":      data.get("deadline") or None,
        "notes":         data.get("notes") or None,
        "intake_notes":  data.get("intake_notes") or None,
        "status":        "PENDING",
    })
    doc.insert()
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist()
def update_referral(name, updates):
    if isinstance(updates, str):
        updates = json.loads(updates)
    allowed = ("status", "notes", "commission_status", "commission_paid_on",
               "escalated", "deadline")
    doc = frappe.get_doc("Referral", name)
    frappe.has_permission("Referral", doc=doc, throw=True)
    for k, v in updates.items():
        if k in allowed:
            setattr(doc, k, v)
    doc.save()
    frappe.db.commit()
    return doc.as_dict()


# ── Providers ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_providers(service=None):
    filters = {"company": _company(), "active": 1}
    if service:
        filters["service"] = service
    return frappe.get_list("Provider",
        fields=["name", "provider_name", "service", "phone",
                "location", "commission_rate", "sla_days"],
        filters=filters,
        order_by="provider_name asc"
    )


# ── Conversation Notes ─────────────────────────────────────────────────────────
# Notes live as ERPNext Comments on the Entrepreneur timeline — no custom DocType needed.

@frappe.whitelist()
def get_conversation_notes(entrepreneur):
    return frappe.get_list("Comment",
        fields=["name", "content", "comment_type", "creation", "owner"],
        filters={
            "reference_doctype": "Entrepreneur",
            "reference_name": entrepreneur,
            "comment_type": ["in", ["Comment", "Info"]],
        },
        order_by="creation desc",
        limit_page_length=100
    )


@frappe.whitelist()
def add_conversation_note(entrepreneur, note_type="visit", content=""):
    doc = frappe.get_doc({
        "doctype": "Comment",
        "comment_type": "Comment",
        "reference_doctype": "Entrepreneur",
        "reference_name": entrepreneur,
        "content": f"[{note_type.upper()}] {content}",
    })
    doc.insert(ignore_permissions=True)
    # Update last_contact
    frappe.db.set_value("Entrepreneur", entrepreneur, "last_contact", frappe.utils.now())
    frappe.db.commit()
    return doc.as_dict()


# ── AI Extraction ─────────────────────────────────────────────────────────────
#
# Configurable via site_config.json — change provider without touching code:
#
#   bench --site <site> set-config ai_provider openrouter   # or: anthropic | google | groq | ollama
#   bench --site <site> set-config ai_api_key  <your-key>
#   bench --site <site> set-config ai_model    "google/gemini-flash-1.5-8b:free"  # optional
#
# Free options:
#   openrouter  — https://openrouter.ai          many free models, unified API
#   google      — https://aistudio.google.com    Gemini Flash free tier (1M tokens/day)
#   groq        — https://console.groq.com       Llama 3.3 free tier, very fast
#   ollama      — self-hosted on this server      completely free, no key needed
#   anthropic   — https://console.anthropic.com  Claude Haiku (~₹0.08/note), best quality

_AI_DEFAULT_MODELS = {
    "openrouter": "meta-llama/llama-3.1-8b-instruct:free",
    "anthropic":  "claude-haiku-4-5-20251001",
    "google":     "gemini-1.5-flash-8b",
    "groq":       "llama-3.3-70b-versatile",
    "ollama":     "llama3.2",
}

_AI_ENDPOINTS = {
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "google":     "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    "groq":       "https://api.groq.com/openai/v1/chat/completions",
}


def _ai_call(system_prompt, user_content):
    """Route an AI call to whichever provider is configured in site_config."""
    provider = frappe.conf.get("ai_provider", "openrouter")
    # support legacy anthropic_api_key for backwards compat
    api_key = frappe.conf.get("ai_api_key") or frappe.conf.get("anthropic_api_key", "")
    model = frappe.conf.get("ai_model") or _AI_DEFAULT_MODELS.get(provider, "google/gemini-flash-1.5-8b:free")

    if not api_key and provider != "ollama":
        frappe.throw(_(
            "AI not configured. Set ai_provider and ai_api_key in site config:\n"
            "  bench --site {site} set-config ai_provider openrouter\n"
            "  bench --site {site} set-config ai_api_key sk-or-...\n"
            "Free options: openrouter (many free models), google (Gemini), groq (Llama)."
        ))

    if provider == "anthropic":
        resp = _requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 400,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_content}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        return (resp.json().get("content") or [{}])[0].get("text", "")

    # OpenAI-compatible: openrouter, google, groq, ollama
    if provider == "ollama":
        base = frappe.conf.get("ollama_url", "http://localhost:11434")
        endpoint = base.rstrip("/") + "/v1/chat/completions"
    else:
        endpoint = _AI_ENDPOINTS.get(provider, _AI_ENDPOINTS["openrouter"])

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://sauramandala.org"
        headers["X-Title"] = "DRIVE Field App"

    resp = _requests.post(endpoint, headers=headers, json={
        "model": model,
        "max_tokens": 400,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


@frappe.whitelist()
def ai_extract(transcript, mode="general"):
    """Extract structured fields from a voice/text note using the configured AI provider."""
    system_prompts = {
        "entrepreneur": (
            "You extract structured data from a field agent's spoken notes about "
            "an entrepreneur they just met. Return ONLY valid JSON with these exact "
            "keys (omit any you cannot determine):\n"
            '{"name":"full name","phone":"10-digit mobile, digits only",'
            '"business_name":"business name","sector":"one of: food_processing|'
            'handicrafts|agriculture|textile|beauty_wellness|carpentry|printing|'
            'energy|services|other","entity_type":"one of: individual|shg|'
            'partnership|company","location":"village or town"}\n'
            "Rules: Raw JSON only, no markdown."
        ),
        "observation": (
            "You extract a clean field observation from a spoken/typed note. "
            "Return ONLY valid JSON:\n"
            '{"observation":"1-3 sentence note in third person",'
            '"aspiration":"low|medium|high|very_high",'
            '"confidence":"low|medium|high",'
            '"stage_hint":"observed|qualifying|referred|active|resolved|deferred"}'
            "\nRules: Raw JSON only."
        ),
        "general": (
            "Summarise a field agent note about a micro-entrepreneur visit. "
            "Return ONLY valid JSON:\n"
            '{"summary":"2-4 sentence summary",'
            '"key_points":["point 1","point 2"],'
            '"suggested_needs":["need 1"],'
            '"next_steps":["step 1"]}'
            "\nRules: Raw JSON only."
        ),
    }

    raw = _ai_call(system_prompts.get(mode, system_prompts["general"]), transcript)

    try:
        fields = json.loads(raw)
    except Exception:
        import re
        m = re.search(r"\{[\s\S]*\}", raw)
        fields = json.loads(m.group()) if m else {"summary": raw}

    return {"fields": fields}


# ── Session helper ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_session_info():
    """Called by the PWA on startup to get user role and company."""
    user = frappe.session.user
    roles = frappe.get_roles(user)
    drive_role = next(
        (r for r in ("DRIVE Programme Officer", "DRIVE Agent", "DRIVE Provider")
         if r in roles), None
    )
    company = frappe.defaults.get_user_default("Company")
    full_name = frappe.db.get_value("User", user, "full_name")
    return {
        "user": user,
        "full_name": full_name,
        "drive_role": drive_role,
        "company": company,
    }


def on_login(login_manager):
    pass  # hook placeholder — extend here for login-time actions
