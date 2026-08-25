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

@frappe.whitelist()
def ai_extract(transcript, mode="general"):
    """
    Call Claude Haiku to extract structured fields from a voice/text note.
    Requires 'anthropic_api_key' set in site_config.json:
        bench --site yoursite.com set-config anthropic_api_key sk-ant-...
    """
    api_key = frappe.conf.get("anthropic_api_key", "")
    if not api_key:
        frappe.throw(
            _("AI not configured. Ask your admin to run: "
              "bench --site yoursite set-config anthropic_api_key sk-ant-...")
        )

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

    resp = _requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 400,
            "system": system_prompts.get(mode, system_prompts["general"]),
            "messages": [{"role": "user", "content": transcript}],
        },
        timeout=30,
    )

    data = resp.json()
    raw = (data.get("content") or [{}])[0].get("text", "")

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
