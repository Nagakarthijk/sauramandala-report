# Glific Configuration Spec — Sauramandala NGO

**Version:** 1.0  
**Date:** 2026-06-28  
**Author:** Technical spec for Sauramandala (nk@sauramandala.org)  
**Programs covered:** TFFP, CMYC, OESN

---

## Table of Contents

1. [Platform Responsibilities](#1-platform-responsibilities)
2. [Configuration-Driven Architecture](#2-configuration-driven-architecture)
3. [Python Deployment Script](#3-python-deployment-script)
4. [Gupshup WhatsApp Forms](#4-gupshup-whatsapp-forms)
5. [n8n ↔ Glific Integration](#5-n8n--glific-integration)
6. [Flows to Build Per Program](#6-flows-to-build-per-program)
7. [Gupshup Template Approvals](#7-gupshup-template-approvals)
8. [File and Folder Structure](#8-file-and-folder-structure)
9. [Phase Plan](#9-phase-plan)

---

## 1. Platform Responsibilities

Clear separation of concerns across the four platforms in the stack.

| Platform | Owns | Does NOT do |
|---|---|---|
| **Meta** | WhatsApp Business Account identity (WABA ID, phone number verification, display name). Template approval policy — Meta decides what content is approved. | Deliver messages. Run flows. Store contacts. Has no flow builder for conversational automation. |
| **Gupshup** | Message delivery (BSP — Business Solution Provider). WhatsApp Forms (Flow Builder for structured, rich-UI forms). Template submission + approval pipeline (submits on your behalf to Meta). Inbound webhook — every message received from a user is forwarded to Glific. | Store contact profiles long-term. Run multi-step conversation flows. Manage a contact database or inbox. |
| **Glific** | Contact profiles + custom fields. Conversation inbox (PM workspace — reply, tag, assign). Flows (automated multi-step touchpoints — consent, profiling, re-engagement). Groups (segment-based broadcasts). Broadcasts (scheduled or immediate send to a group). GraphQL API for all of the above. | Submit templates to Meta. Build structured form UIs (forms are Gupshup's domain). Replace a data warehouse. |
| **n8n** | Orchestration — connects Google Sheets content calendar to Glific send API. Processes Gupshup form submission webhooks, extracts structured data, writes to Supabase. Triggers Glific flows or messages on a schedule. Bridges systems that do not natively connect. | Store data permanently. Run conversations. Approve templates. |

---

## 2. Configuration-Driven Architecture

### The Problem

Glific's drag-and-drop flow builder is slow for complex flows, has limited branching logic, and as of mid-2026 the JSON import via UI is broken. Building three programs' worth of flows manually in the UI is not maintainable.

### The Solution

Write every program as a YAML config file. Run a Python deployment script that reads the YAML and pushes everything to Glific via its GraphQL API — contact fields, groups, tags, flows, saved replies. The script is idempotent: running it twice creates nothing twice.

```
programs/tffp.yaml  →  deploy.py  →  Glific GraphQL API
```

Re-deploying a changed flow requires deleting it in Glific first (Glific does not support update-in-place via API), then re-running `deploy.py`. This is a known Glific limitation documented in the script.

---

### TFFP Full Config

```yaml
# programs/tffp.yaml

program:
  id: tffp
  name: "Teachers for the Future Pathway"
  glific_label: tffp
  language_options: [english, khasi, garo, pnar]

contact_fields:
  # Consent fields (shared across all programs — deploy once, reuse)
  - name: consent_given
    shortcode: consent_given
    type: boolean
  - name: consent_date
    shortcode: consent_date
    type: date
  - name: consent_language
    shortcode: consent_language
    type: text
  - name: consent_method
    shortcode: consent_method
    type: text
  # Identity
  - name: program
    shortcode: program
    type: text
  - name: language
    shortcode: language
    type: text
  - name: location
    shortcode: location
    type: text
  - name: assigned_pm
    shortcode: assigned_pm
    type: text
  # TFFP-specific profile
  - name: ecce_role
    shortcode: ecce_role
    type: text
    options: [anganwadi_worker, preschool_teacher, parent, home_based]
  - name: experience_years
    shortcode: experience_years
    type: text
  - name: child_dob
    shortcode: child_dob
    type: text
  - name: dev_stage
    shortcode: dev_stage
    type: text
  - name: dev_stage_updated
    shortcode: dev_stage_updated
    type: date
  - name: parent_content_week
    shortcode: parent_content_week
    type: number
  - name: tffp_week
    shortcode: tffp_week
    type: number
  - name: last_content_sent
    shortcode: last_content_sent
    type: date
  - name: last_response_date
    shortcode: last_response_date
    type: date
  - name: streak_weeks
    shortcode: streak_weeks
    type: number
  - name: engagement_level
    shortcode: engagement_level
    type: text
  - name: learning_interest
    shortcode: learning_interest
    type: text

groups:
  - name: TFFP-EastKhasi-Khasi
    region: east_khasi_hills
    language: khasi
  - name: TFFP-WestKhasi-Khasi
    region: west_khasi_hills
    language: khasi
  - name: TFFP-Jaintia-Pnar
    region: jaintia_hills
    language: pnar
  - name: TFFP-WestGaro-Garo
    region: west_garo_hills
    language: garo
  - name: TFFP-EastGaro-Garo
    region: east_garo_hills
    language: garo
  - name: TFFP-Urban-English
    region: urban
    language: english

tags:
  - tffp
  - language-khasi
  - language-garo
  - language-pnar
  - language-english
  - active
  - inactive
  - new
  - parent-track
  - needs-followup
  - milestone-reached
  - escalate-to-coordinator

flows:
  - id: tffp_consent
    name: "TFFP Consent Flow"
    trigger: first_message
    keywords: []
    steps:
      - id: language_select
        type: quick_reply
        text: "Welcome to Sauramandala's TFFP learning programme.\n\nPlease choose your language:"
        options:
          - label: English
            value: english
          - label: Khasi
            value: khasi
          - label: Garo
            value: garo
          - label: Pnar
            value: pnar
        save_to: language

      - id: consent_message
        type: send_message
        text_by_language:
          english: |
            Hello! 👋

            The Teachers for the Future Pathway (TFFP) shares weekly learning content on early childhood care and education.

            To do this, we will:
            ✅ Save your name and phone number
            ✅ Send you weekly content on WhatsApp
            ✅ Record which content you have received
            ✅ If you are a parent: save your child's birth month and year

            We will NOT share your details with anyone outside Sauramandala.

            You can stop at any time by typing STOP.

            Do you agree to join?
          khasi: "[Khasi translation — to be provided by team]"
          garo: "[Garo translation — to be provided by team]"
          pnar: "[Pnar translation — to be provided by team]"
        wait_for_keyword: true
        timeout_hours: 72

      - id: consent_branch
        type: branch
        branches:
          - condition: message_contains_any([YES, yes, Yes, ✅, 👍])
            steps:
              - type: set_contact_field
                field: consent_given
                value: "true"
              - type: set_contact_field
                field: consent_date
                value: "{{today}}"
              - type: set_contact_field
                field: consent_language
                value: "{{contact.language}}"
              - type: set_contact_field
                field: consent_method
                value: whatsapp_optin
              - type: set_contact_field
                field: program
                value: tffp
              - type: add_tag
                tag: tffp
              - type: add_tag
                tag: "language-{{contact.language}}"
              - type: send_message
                text: "Great! Welcome to TFFP 🌱 We have 3 quick questions to send you the most useful content."
              - type: trigger_flow
                flow_id: tffp_profile_session1
              - type: notify_staff
                message: "New TFFP contact: {{contact.name}} ({{contact.language}}, {{contact.phone}})"

          - condition: message_contains_any([NO, no, No, 🙅])
            steps:
              - type: set_contact_field
                field: consent_given
                value: "false"
              - type: send_message
                text: "No problem at all. If you change your mind, just message us again. 🙏"

          - condition: message_contains_any([STOP, stop, Stop])
            steps:
              - type: set_contact_field
                field: consent_given
                value: "false"
              - type: remove_from_all_groups
              - type: send_message
                text: "You have been unsubscribed from TFFP. We won't message you again. Text JOIN if you'd like to re-join."

  - id: tffp_profile_session1
    name: "TFFP Profile — Session 1"
    trigger: flow_trigger
    steps:
      - id: ask_role
        type: quick_reply
        text: "What best describes your role?"
        options:
          - label: Anganwadi Worker
            value: anganwadi_worker
          - label: Preschool Teacher
            value: preschool_teacher
          - label: Parent
            value: parent
          - label: Home-based Caregiver
            value: home_based
        save_to: ecce_role

      - id: ask_district
        type: wait_for_response
        text: "Which district are you in? (type your district name)"
        save_to: location

      - id: role_branch
        type: branch
        branches:
          - condition: contact.ecce_role == parent
            steps:
              - type: wait_for_response
                text: "What is your child's birth month and year? (e.g. March 2023)"
                save_to: child_dob
              - type: add_tag
                tag: parent-track
              - type: trigger_flow
                flow_id: tffp_compute_dev_stage
              - type: trigger_flow
                flow_id: tffp_add_to_group

          - condition: default
            steps:
              - type: quick_reply
                text: "How many years have you worked with young children?"
                options:
                  - label: "0–2 years"
                    value: "0-2"
                  - label: "3–5 years"
                    value: "3-5"
                  - label: "6–10 years"
                    value: "6-10"
                  - label: "10+ years"
                    value: "10+"
                save_to: experience_years
              - type: trigger_flow
                flow_id: tffp_add_to_group
              - type: send_message
                text: "Thank you! Your first learning content is on its way. 📚"

  - id: tffp_add_to_group
    name: "TFFP Add to Region Group"
    trigger: flow_trigger
    steps:
      - id: add_group
        type: add_to_group_by_field
        logic: "match contact.location to group by region, contact.language to group by language"
        fallback_group: "TFFP-Urban-English"

  - id: tffp_inactivity
    name: "TFFP Inactivity Re-engagement"
    trigger: scheduled
    condition: "last_response_date < 21 days ago AND consent_given = true"
    steps:
      - type: send_message
        text: "Hi {{contact.name}} 👋 We've missed you in the TFFP community! How are things going with you and the children?"
      - type: add_tag
        tag: needs-followup
      - type: notify_staff
        message: "{{contact.name}} has been inactive for 21+ days. Follow up?"

  - id: tffp_milestone
    name: "TFFP Streak Milestone"
    trigger: flow_trigger
    steps:
      - type: branch
        branches:
          - condition: contact.streak_weeks == 4
            steps:
              - type: send_message
                text: "You've been learning with TFFP for 4 weeks! 🎉 That's consistency — and it shows in the children you work with."
          - condition: contact.streak_weeks == 12
            steps:
              - type: send_message
                text: "3 months with TFFP! 🌟 You're part of a community of educators making a real difference."
          - condition: contact.streak_weeks == 26
            steps:
              - type: send_message
                text: "6 months! 🏆 You've completed the TFFP pathway. Your certificate is on its way."

keyword_triggers:
  - keyword: STOP
    flow_id: tffp_consent
  - keyword: JOIN
    flow_id: tffp_consent
  - keyword: LIBRARY
    flow_id: tffp_library_menu
  - keyword: RESOURCES
    flow_id: tffp_library_menu

saved_replies:
  - shortcode: welcome_en
    text: "Welcome to TFFP! We're glad you're here. 🌱"
  - shortcode: welcome_kha
    text: "[Khasi welcome — to be provided by team]"
  - shortcode: thankyou_en
    text: "Thank you for sharing! Your experience helps the whole community. 🙏"
  - shortcode: followup_en
    text: "We'll get back to you soon. In the meantime, feel free to share more."
```

---

### CMYC Config (snippet)

```yaml
# programs/cmyc.yaml

program:
  id: cmyc
  name: "Community & Mobile Youth Centre"
  glific_label: cmyc
  language_options: [english, khasi, garo]

contact_fields:
  # Consent fields (same shortcodes as TFFP — shared across org)
  - name: consent_given
    shortcode: consent_given
    type: boolean
  - name: consent_date
    shortcode: consent_date
    type: date
  - name: consent_language
    shortcode: consent_language
    type: text
  - name: consent_method
    shortcode: consent_method
    type: text
  # Identity
  - name: program
    shortcode: program
    type: text
  - name: language
    shortcode: language
    type: text
  - name: location
    shortcode: location
    type: text
  - name: assigned_pm
    shortcode: assigned_pm
    type: text
  # CMYC-specific
  - name: centre_name
    shortcode: centre_name
    type: text
  - name: centre_type
    shortcode: centre_type
    type: text
    options: [community_centre, mobile_unit]
  - name: last_report_date
    shortcode: last_report_date
    type: date
  - name: reporting_streak
    shortcode: reporting_streak
    type: number

groups:
  - name: CMYC-EastKhasi
    region: east_khasi_hills
  - name: CMYC-WestKhasi
    region: west_khasi_hills
  - name: CMYC-Jaintia
    region: jaintia_hills
  - name: CMYC-Garo
    region: garo_hills

tags:
  - cmyc
  - cmyc-coordinator
  - cmyc-volunteer
  - report-submitted
  - report-overdue
  - escalate-to-coordinator

flows:
  - id: cmyc_consent
    name: "CMYC Consent Flow"
    trigger: first_message
    steps:
      - id: language_select
        type: quick_reply
        text: "Welcome to Sauramandala's CMYC network.\n\nPlease choose your language:"
        options:
          - label: English
            value: english
          - label: Khasi
            value: khasi
          - label: Garo
            value: garo
        save_to: language
      # ... consent message and branch same structure as TFFP

  - id: cmyc_weekly_reminder
    name: "CMYC Weekly Report Reminder"
    trigger: scheduled
    schedule: "every Monday at 09:00 IST"
    condition: "consent_given = true AND program = cmyc"
    steps:
      - type: send_message
        text: "Good morning! 👋 It's time to submit your weekly centre report for {{this_week}}.\n\nTap here to fill the form: {{gupshup_form_link_cmyc_report}}\n\nTakes about 3 minutes."
      - type: add_tag
        tag: report-overdue

  - id: cmyc_issue_alert
    name: "CMYC Issue Alert"
    trigger: keyword
    keyword: ISSUE
    steps:
      - type: add_tag
        tag: escalate-to-coordinator
      - type: notify_staff
        message: "URGENT: {{contact.name}} at {{contact.centre_name}} has flagged an issue. Check inbox now."
      - type: send_message
        text: "We've flagged this to your coordinator. Someone will respond within 24 hours. 🙏"
```

---

### OESN Config (snippet)

```yaml
# programs/oesn.yaml

program:
  id: oesn
  name: "One-stop Entrepreneur Support Network"
  glific_label: oesn
  language_options: [english, khasi, garo]

contact_fields:
  # Consent fields (shared)
  - name: consent_given
    shortcode: consent_given
    type: boolean
  - name: consent_date
    shortcode: consent_date
    type: date
  - name: consent_language
    shortcode: consent_language
    type: text
  - name: consent_method
    shortcode: consent_method
    type: text
  # Identity
  - name: program
    shortcode: program
    type: text
  - name: language
    shortcode: language
    type: text
  - name: location
    shortcode: location
    type: text
  - name: assigned_pm
    shortcode: assigned_pm
    type: text
  # OESN-specific
  - name: business_name
    shortcode: business_name
    type: text
  - name: business_stage
    shortcode: business_stage
    type: text
    options: [idea, started, growing]
  - name: business_sector
    shortcode: business_sector
    type: text
  - name: top_challenge
    shortcode: top_challenge
    type: text
  - name: referral_status
    shortcode: referral_status
    type: text
    options: [pending, in_progress, completed, not_eligible]
  - name: intake_date
    shortcode: intake_date
    type: date
  - name: last_session_date
    shortcode: last_session_date
    type: date

groups:
  - name: OESN-Doorstep-Khasi
    region: east_khasi_hills
    language: khasi
  - name: OESN-Doorstep-Garo
    region: garo_hills
    language: garo
  - name: OESN-Urban-English
    region: urban
    language: english

tags:
  - oesn
  - intake-done
  - referral-pending
  - referral-active
  - referral-closed
  - needs-followup

flows:
  - id: oesn_consent
    name: "OESN Consent Flow"
    trigger: first_message
    steps:
      - id: language_select
        type: quick_reply
        text: "Welcome to Sauramandala's OESN programme for entrepreneurs in Meghalaya.\n\nChoose your language:"
        options:
          - label: English
            value: english
          - label: Khasi
            value: khasi
          - label: Garo
            value: garo
        save_to: language
      # ... consent branch same structure

  - id: oesn_intake_trigger
    name: "OESN Intake Form Trigger"
    trigger: flow_trigger
    steps:
      - type: send_message
        text: "Hi {{contact.name}}! To support you better, we'd like to know a bit about your business.\n\nTap here to fill a short form (5 minutes): {{gupshup_form_link_oesn_intake}}"
      - type: add_tag
        tag: intake-done
      - type: set_contact_field
        field: intake_date
        value: "{{today}}"

  - id: oesn_referral_status_update
    name: "OESN Referral Status Update"
    trigger: flow_trigger
    steps:
      - type: branch
        branches:
          - condition: contact.referral_status == in_progress
            steps:
              - type: send_message
                text: "Update on your referral 📋 — your application is currently being reviewed. We'll update you when there's progress."
          - condition: contact.referral_status == completed
            steps:
              - type: send_message
                text: "Great news! 🎉 Your referral has been completed. Please check your email or speak to your coordinator for next steps."
          - condition: contact.referral_status == not_eligible
            steps:
              - type: send_message
                text: "We've reviewed your referral. Unfortunately, this particular scheme isn't a fit right now — but let's talk about other options. Your coordinator will be in touch."
```

---

## 3. Python Deployment Script

Save as `deploy.py` in the root of the `glific-config/` repository.

```python
#!/usr/bin/env python3
"""
deploy.py — Deploy a Sauramandala program config to Glific via GraphQL API.

Usage:
  python deploy.py --program tffp
  python deploy.py --program cmyc --dry-run
  python deploy.py --program oesn --verbose

Environment variables required:
  GLIFIC_API_URL   — defaults to https://api.prod.glific.com/api
  GLIFIC_API_KEY   — required, obtain from Glific Settings > API Access

Idempotency: this script checks before creating. Running it twice will not
duplicate anything. To re-deploy a changed flow, delete it in Glific UI first.
"""

import argparse
import json
import os
import sys
import yaml
import requests
from pathlib import Path
from typing import Any

GLIFIC_API_URL = os.environ.get("GLIFIC_API_URL", "https://api.prod.glific.com/api")
GLIFIC_API_KEY = os.environ.get("GLIFIC_API_KEY", "")

if not GLIFIC_API_KEY:
    print("ERROR: GLIFIC_API_KEY environment variable is not set.")
    sys.exit(1)

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {GLIFIC_API_KEY}"
}


def gql(query: str, variables: dict = None, dry_run: bool = False) -> dict:
    """Execute a Glific GraphQL mutation or query."""
    if dry_run:
        print(f"  [DRY RUN] Would execute: {query.strip()[:100]}...")
        return {"data": {}}
    resp = requests.post(
        GLIFIC_API_URL,
        headers=HEADERS,
        json={"query": query, "variables": variables or {}}
    )
    resp.raise_for_status()
    result = resp.json()
    if "errors" in result:
        raise RuntimeError(f"GraphQL error: {result['errors']}")
    return result


def create_contact_field(field: dict, dry_run: bool) -> str:
    """
    Create a contact field in Glific.
    Returns 'created' or 'skipped' (if shortcode already exists).
    Always does the existence check even in dry_run mode.
    """
    check = gql("""
        query ListContactFields {
          contactFields { id name shortcode }
        }
    """)
    existing = {
        f["shortcode"]
        for f in check.get("data", {}).get("contactFields", [])
    }
    if field["shortcode"] in existing:
        return "skipped"

    type_map = {
        "boolean": "BOOLEAN",
        "date": "DATE",
        "text": "TEXT",
        "number": "NUMBER",
    }
    value_type = type_map.get(field["type"], "TEXT")

    gql("""
        mutation CreateContactField($input: ContactFieldInput!) {
          createContactField(input: $input) {
            contactField { id name shortcode valueType }
            errors { key message }
          }
        }
    """, {
        "input": {
            "name": field["name"],
            "shortcode": field["shortcode"],
            "valueType": value_type,
            "scope": "CONTACT"
        }
    }, dry_run)
    return "created"


def create_group(group: dict, dry_run: bool) -> str:
    """
    Create a Glific collection/group.
    Returns 'created' or 'skipped'.
    """
    check = gql("query { groups { id label } }")
    existing = {g["label"] for g in check.get("data", {}).get("groups", [])}
    if group["name"] in existing:
        return "skipped"

    gql("""
        mutation CreateGroup($input: GroupInput!) {
          createGroup(input: $input) {
            group { id label }
            errors { key message }
          }
        }
    """, {
        "input": {
            "label": group["name"],
            "isRestricted": False
        }
    }, dry_run)
    return "created"


def create_tag(tag_name: str, dry_run: bool) -> str:
    """
    Create a Glific tag/label.
    Returns 'created' or 'skipped'.
    """
    check = gql("query { tags { id label } }")
    existing = {t["label"] for t in check.get("data", {}).get("tags", [])}
    if tag_name in existing:
        return "skipped"

    gql("""
        mutation CreateTag($input: TagInput!) {
          createTag(input: $input) {
            tag { id label }
            errors { key message }
          }
        }
    """, {
        "input": {
            "label": tag_name,
            "description": "Auto-created by deploy.py",
            "colorCode": "#0C976D"
        }
    }, dry_run)
    return "created"


def yaml_flow_to_rapidpro(flow_spec: dict, program_id: str) -> dict:
    """
    Convert a YAML flow spec to RapidPro flow JSON format that Glific accepts
    via its importFlow mutation.

    This is a structural converter — it maps the YAML node types to RapidPro
    action and router primitives. Complex branching (branch type) is converted
    to a switch router. The output JSON is stored in flows/ for inspection.

    Glific accepts RapidPro format version 13.1.0.
    """
    nodes = []
    flow_uuid = f"sauramandala-{program_id}-{flow_spec['id']}"

    def make_uuid(suffix: str) -> str:
        return f"{flow_uuid}-{suffix}"

    steps = flow_spec.get("steps", [])

    for i, step in enumerate(steps):
        node_uuid = make_uuid(f"node-{i:03d}")
        step_type = step.get("type", "send_message")

        if step_type == "quick_reply":
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "send_msg",
                "text": step.get("text", ""),
                "quick_replies": [opt["label"] for opt in step.get("options", [])]
            }]
            # One exit per option plus a default timeout exit
            exits = [
                {
                    "uuid": make_uuid(f"exit-{i:03d}-{j}"),
                    "destination_uuid": None,
                    "name": opt["label"]
                }
                for j, opt in enumerate(step.get("options", []))
            ]
            exits.append({
                "uuid": make_uuid(f"exit-{i:03d}-default"),
                "destination_uuid": None,
                "name": "Other"
            })
            # Build a switch router on the result
            router = {
                "type": "switch",
                "operand": "@input.text",
                "default_category_uuid": make_uuid(f"cat-{i:03d}-default"),
                "categories": [
                    {
                        "uuid": make_uuid(f"cat-{i:03d}-{j}"),
                        "name": opt["label"],
                        "exit_uuid": make_uuid(f"exit-{i:03d}-{j}")
                    }
                    for j, opt in enumerate(step.get("options", []))
                ] + [{
                    "uuid": make_uuid(f"cat-{i:03d}-default"),
                    "name": "Other",
                    "exit_uuid": make_uuid(f"exit-{i:03d}-default")
                }],
                "cases": [
                    {
                        "uuid": make_uuid(f"case-{i:03d}-{j}"),
                        "type": "has_any_word",
                        "arguments": [opt["value"], opt["label"].lower()],
                        "category_uuid": make_uuid(f"cat-{i:03d}-{j}")
                    }
                    for j, opt in enumerate(step.get("options", []))
                ],
                "result_name": step.get("save_to", "result")
            }
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": router
            })

        elif step_type == "send_message":
            # Use English text as base; multi-language handled at PM level or
            # via separate language-specific flows triggered by contact.language
            text = step.get("text") or \
                   step.get("text_by_language", {}).get("english", "")
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "send_msg",
                "text": text,
                "quick_replies": []
            }]
            exits = [{
                "uuid": make_uuid(f"exit-{i:03d}"),
                "destination_uuid": None,
                "name": ""
            }]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None
            })

        elif step_type == "wait_for_response":
            # Send the prompt then wait — RapidPro uses a wait on the node
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "send_msg",
                "text": step.get("text", ""),
                "quick_replies": []
            }]
            exits = [{
                "uuid": make_uuid(f"exit-{i:03d}"),
                "destination_uuid": None,
                "name": ""
            }]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None,
                "wait": {
                    "type": "msg",
                    "result_name": step.get("save_to", "response")
                }
            })

        elif step_type == "set_contact_field":
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "set_contact_field",
                "field": {
                    "key": step["field"],
                    "name": step["field"].replace("_", " ").title()
                },
                "value": step.get("value", "")
            }]
            exits = [{
                "uuid": make_uuid(f"exit-{i:03d}"),
                "destination_uuid": None,
                "name": ""
            }]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None
            })

        elif step_type == "add_tag":
            # Glific tag application — represented as add_contact_groups action
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "add_contact_groups",
                "groups": [{"name": step.get("tag", "")}]
            }]
            exits = [{
                "uuid": make_uuid(f"exit-{i:03d}"),
                "destination_uuid": None,
                "name": ""
            }]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None
            })

        elif step_type == "trigger_flow":
            # Represented as a transfer_to_flow action in RapidPro
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "enter_flow",
                "flow": {
                    "uuid": f"sauramandala-{program_id}-{step.get('flow_id', '')}",
                    "name": step.get("flow_id", "").replace("_", " ").title()
                }
            }]
            exits = [
                {"uuid": make_uuid(f"exit-{i:03d}-completed"), "destination_uuid": None, "name": "completed"},
                {"uuid": make_uuid(f"exit-{i:03d}-expired"), "destination_uuid": None, "name": "expired"}
            ]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None
            })

        elif step_type == "branch":
            # Branch node — build a switch router with one category per branch
            # Conditions are stored as-is in the category name for documentation;
            # the actual routing logic needs manual verification in Glific UI.
            branches = step.get("branches", [])
            exits = [
                {
                    "uuid": make_uuid(f"exit-{i:03d}-{j}"),
                    "destination_uuid": None,
                    "name": b.get("condition", f"branch-{j}")
                }
                for j, b in enumerate(branches)
            ]
            router = {
                "type": "switch",
                "operand": "@contact.fields",
                "default_category_uuid": make_uuid(f"cat-{i:03d}-{len(branches)-1}"),
                "categories": [
                    {
                        "uuid": make_uuid(f"cat-{i:03d}-{j}"),
                        "name": b.get("condition", f"branch-{j}"),
                        "exit_uuid": make_uuid(f"exit-{i:03d}-{j}")
                    }
                    for j, b in enumerate(branches)
                ],
                "cases": [],
                "result_name": "branch_result"
            }
            nodes.append({
                "uuid": node_uuid,
                "actions": [],
                "exits": exits,
                "router": router
            })

        else:
            # Passthrough placeholder for unmapped types
            actions = [{
                "uuid": make_uuid(f"act-{i:03d}"),
                "type": "send_msg",
                "text": f"[{step_type} — manual configuration required in Glific UI]",
                "quick_replies": []
            }]
            exits = [{
                "uuid": make_uuid(f"exit-{i:03d}"),
                "destination_uuid": None,
                "name": ""
            }]
            nodes.append({
                "uuid": node_uuid,
                "actions": actions,
                "exits": exits,
                "router": None
            })

    # Wire exits sequentially: each node's first exit points to the next node
    for i in range(len(nodes) - 1):
        if nodes[i]["exits"]:
            nodes[i]["exits"][0]["destination_uuid"] = nodes[i + 1]["uuid"]

    return {
        "version": "13.1.0",
        "flows": [{
            "uuid": flow_uuid,
            "name": flow_spec["name"],
            "language": "base",
            "type": "messaging",
            "nodes": nodes,
            "metadata": {
                "revision": 1,
                "expires": 10080,
                "program": program_id
            },
            "localization": {}
        }]
    }


def deploy_flow(flow_spec: dict, program_id: str, dry_run: bool) -> str:
    """
    Deploy a flow to Glific via importFlow mutation.
    Returns a status string.

    Glific does not support update-in-place via API. If a flow with this name
    already exists, it is skipped. Delete it in the Glific UI to redeploy.
    """
    check = gql("query { flows { id name } }")
    existing = {f["name"] for f in check.get("data", {}).get("flows", [])}
    if flow_spec["name"] in existing:
        return "skipped (exists — delete in Glific UI to redeploy)"

    flow_json = yaml_flow_to_rapidpro(flow_spec, program_id)

    # Save generated JSON to flows/ directory for reference
    flows_dir = Path("flows")
    flows_dir.mkdir(exist_ok=True)
    json_path = flows_dir / f"{flow_spec['id']}.json"
    with open(json_path, "w") as f:
        json.dump(flow_json, f, indent=2)

    gql("""
        mutation ImportFlow($flow: String!) {
          importFlow(flow: $flow) {
            success
            errors { key message }
          }
        }
    """, {"flow": json.dumps(flow_json)}, dry_run)
    return "deployed"


def create_saved_reply(reply: dict, dry_run: bool) -> str:
    """
    Create a Glific saved search / canned response.
    Note: Glific's saved reply API uses interactiveTemplates or savedSearches
    depending on version. Verify the correct mutation for your instance schema.
    """
    check = gql("query { savedSearches { id shortcode } }")
    existing = {
        s.get("shortcode", "")
        for s in check.get("data", {}).get("savedSearches", [])
    }
    if reply.get("shortcode") in existing:
        return "skipped"

    # Adjust mutation to match your Glific instance's schema
    gql("""
        mutation CreateSavedSearch($input: SavedSearchInput!) {
          createSavedSearch(input: $input) {
            savedSearch { id shortcode }
            errors { key message }
          }
        }
    """, {
        "input": {
            "label": reply["shortcode"],
            "shortcode": reply["shortcode"],
            "args": json.dumps({"body": reply["text"]})
        }
    }, dry_run)
    return "created"


def deploy_keyword_trigger(trigger: dict, dry_run: bool) -> str:
    """Register a keyword → flow mapping in Glific."""
    # Glific keyword triggers are set on the flow object itself.
    # This function documents the intent; the actual API call depends on
    # whether you update the flow's keywords field after creation.
    # For now, print the mapping and return a note.
    if dry_run:
        print(f"  [DRY RUN] Keyword '{trigger['keyword']}' → flow '{trigger['flow_id']}'")
    return "note: set keyword on flow object in Glific UI"


def deploy_program(program_id: str, dry_run: bool = False, verbose: bool = False):
    config_path = Path(f"programs/{program_id}.yaml")
    if not config_path.exists():
        print(f"ERROR: Config file not found: {config_path}")
        sys.exit(1)

    with open(config_path) as f:
        config = yaml.safe_load(f)

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Deploying: {config['program']['name']}")
    print("=" * 60)

    # 1. Contact fields
    print("\nContact fields:")
    created_count = skipped_count = 0
    for field in config.get("contact_fields", []):
        result = create_contact_field(field, dry_run)
        if result == "created":
            created_count += 1
        else:
            skipped_count += 1
        if verbose or result == "created":
            print(f"  {result:50s}  {field['shortcode']}")
    if not verbose:
        print(f"  {created_count} created, {skipped_count} skipped")

    # 2. Groups
    print("\nGroups:")
    created_count = skipped_count = 0
    for group in config.get("groups", []):
        result = create_group(group, dry_run)
        if result == "created":
            created_count += 1
        else:
            skipped_count += 1
        if verbose or result == "created":
            print(f"  {result:50s}  {group['name']}")
    if not verbose:
        print(f"  {created_count} created, {skipped_count} skipped")

    # 3. Tags
    print("\nTags:")
    created_count = skipped_count = 0
    for tag in config.get("tags", []):
        result = create_tag(tag, dry_run)
        if result == "created":
            created_count += 1
        else:
            skipped_count += 1
        if verbose or result == "created":
            print(f"  {result:50s}  {tag}")
    if not verbose:
        print(f"  {created_count} created, {skipped_count} skipped")

    # 4. Flows
    print("\nFlows:")
    for flow in config.get("flows", []):
        result = deploy_flow(flow, program_id, dry_run)
        print(f"  {result:50s}  {flow['name']}")

    # 5. Saved replies
    print("\nSaved replies:")
    created_count = skipped_count = 0
    for reply in config.get("saved_replies", []):
        result = create_saved_reply(reply, dry_run)
        if result == "created":
            created_count += 1
        else:
            skipped_count += 1
        if verbose or result == "created":
            print(f"  {result:50s}  {reply['shortcode']}")
    if not verbose:
        print(f"  {created_count} created, {skipped_count} skipped")

    # 6. Keyword triggers (informational)
    if config.get("keyword_triggers"):
        print("\nKeyword triggers (set on flow objects in Glific UI):")
        for trigger in config.get("keyword_triggers", []):
            result = deploy_keyword_trigger(trigger, dry_run)
            print(f"  {trigger['keyword']:20s} → {trigger['flow_id']}")

    print(f"\nDone: {config['program']['name']}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy a Sauramandala program config to Glific."
    )
    parser.add_argument(
        "--program",
        required=True,
        choices=["tffp", "cmyc", "oesn"],
        help="Program to deploy"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without making API calls"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print all items, not just newly created ones"
    )
    args = parser.parse_args()
    deploy_program(args.program, dry_run=args.dry_run, verbose=args.verbose)
```

---

## 4. Gupshup WhatsApp Forms

WhatsApp Forms are built in Gupshup's Flow Builder (separate from Glific's flow builder). They render as structured UI screens inside WhatsApp — radio buttons, checkboxes, text inputs — not as conversational messages. The user taps a link in a WhatsApp message, fills the form, submits, and Gupshup fires a webhook with the structured response.

### TFFP Weekly Check-in Form

**Form name:** `tffp_weekly_checkin`  
**Trigger:** Sent as a link inside the weekly TFFP content message (n8n schedules the send via Glific GraphQL)

| Field | Type | Options / Validation |
|---|---|---|
| Did you try this week's activity? | RadioButton (required) | Yes, tried it / Tried but had challenges / Did not try yet |
| If you tried it — what did you notice? | TextInput (optional) | Max 300 chars |
| Would you like to share anything with the group? | TextInput (optional) | Max 300 chars |
| How useful was this week's content? | RadioButton (required) | Very useful / Somewhat useful / Not useful |

**Response handling:**

```
Gupshup fires POST webhook → n8n webhook trigger node
  ↓
n8n: extract fields from response body
  { phone, activity_tried, observation, share_with_group, usefulness_rating }
  ↓
n8n: write row to Supabase table `tffp_checkins`
  { contact_phone, week_number, submitted_at, activity_tried, observation,
    share_with_group, usefulness_rating }
  ↓
n8n: update Glific contact fields via updateContact mutation
  { last_response_date: today, engagement_level: derived from activity_tried }
  ↓
n8n: if share_with_group not empty → post to TFFP WhatsApp group via Glific broadcast
```

---

### CMYC Weekly Report Form

**Form name:** `cmyc_weekly_report`  
**Trigger:** Sent every Monday 09:00 IST by CMYC Weekly Reminder flow

| Field | Type | Options / Validation |
|---|---|---|
| Centre name | TextInput (pre-filled from contact field, read-only) | Auto-populated |
| Reporting week | DatePicker (required) | Current week default |
| Sessions held this week | NumberInput (required) | Min 0, Max 14 |
| Total attendance this week | NumberInput (required) | Min 0 |
| Activities completed | CheckboxGroup (required, multi-select) | Nook / Library / Sports / Mental Health / Career Counselling |
| Main learning or highlight this week | TextInput (required) | Max 500 chars |
| Any blockers or issues? | TextInput (optional) | Max 300 chars |
| Expenses this week — any claims? | RadioButton (required) | Yes / No |

**Note on receipts:** If "Yes" to expenses, a follow-up WhatsApp message is sent automatically asking them to photograph and send the receipt as a WhatsApp image. n8n listens for the inbound media message and stores the Gupshup media URL in Supabase.

**Response handling:**

```
Gupshup fires POST webhook → n8n webhook trigger node
  ↓
n8n: extract fields from response body
  { phone, centre_name, reporting_week, sessions_held, total_attendance,
    activities_completed[], highlight, blockers, has_expenses }
  ↓
n8n: write row to Supabase table `cmyc_weekly_reports`
  ↓
n8n: update Glific contact fields
  { last_report_date: reporting_week, reporting_streak: increment }
  ↓
n8n: remove tag `report-overdue`, add tag `report-submitted`
  ↓
n8n: if blockers not empty → trigger cmyc_issue_alert flow in Glific
  ↓
n8n: send auto-summary back to contact via Glific sendMessage mutation
  "Thanks! Week of {date}: {sessions_held} sessions, {total_attendance} attendees. Report received ✅"
```

---

### OESN Intake Form

**Form name:** `oesn_intake`  
**Trigger:** Triggered by `oesn_intake_trigger` flow when a contact is added to a Doorstep group

| Field | Type | Options / Validation |
|---|---|---|
| Your name | TextInput (required) | Pre-filled from WhatsApp display name if available |
| Business name | TextInput (required) | Max 100 chars |
| What do you sell or make? | TextInput (required) | Max 200 chars |
| Business stage | RadioButton (required) | Just an idea / Started but small / Growing |
| District | TextInput (required) | Free text — Meghalaya districts |
| Top challenge right now | CheckboxGroup (required, select up to 3) | Money / Finding customers / Making the product / Paperwork and licences / Finding reliable suppliers / Understanding costs |
| Have you worked with a government scheme before? | RadioButton (required) | Yes / No / Not sure |

**Response handling:**

```
Gupshup fires POST webhook → n8n webhook trigger node
  ↓
n8n: extract fields from response body
  { phone, full_name, business_name, business_sector, business_stage,
    location, top_challenges[], prior_scheme_exposure }
  ↓
n8n: write row to Supabase table `oesn_intakes`
  ↓
n8n: update Glific contact fields via updateContact mutation
  { business_name, business_stage, business_sector, location, top_challenge,
    intake_date: today }
  ↓
n8n: add Glific tag `intake-done`
  ↓
n8n: notify assigned PM via Glific saved message or direct message
  "New OESN intake: {name}, {business_name} ({business_stage}), {location}"
```

---

## 5. n8n ↔ Glific Integration

All n8n → Glific communication uses the Glific GraphQL API via HTTP Request nodes. Set `Authorization: Bearer {GLIFIC_API_KEY}` on all requests.

### Send an Individual Message

```javascript
// n8n HTTP Request node — POST to Glific GraphQL endpoint
// POST https://your-glific-instance.glific.com/api
// Header: Authorization: Bearer {GLIFIC_API_KEY}

{
  "query": "mutation SendMessage($input: MessageInput!) { createAndSendMessage(input: $input) { message { id body } errors { key message } } }",
  "variables": {
    "input": {
      "body": "Hello {{contact.name}}, your Week {{contact.tffp_week}} content:\n\n{content_text}",
      "type": "TEXT",
      "flow": "OUTBOUND",
      "receiverId": "{contact_glific_id}",
      "senderId": "{org_glific_id}"
    }
  }
}
```

### Trigger a Flow for a Contact

```javascript
{
  "query": "mutation StartContactFlow($flowId: ID!, $contactId: ID!) { startContactFlow(flowId: $flowId, contactId: $contactId) { success errors { key message } } }",
  "variables": {
    "flowId": "{flow_uuid}",
    "contactId": "{contact_id}"
  }
}
```

### Create a Broadcast to Groups

```javascript
{
  "query": "mutation CreateBroadcast($input: BroadcastInput!) { createBroadcast(input: $input) { id status } }",
  "variables": {
    "input": {
      "label": "TFFP Week 3 — Anganwadi Workers",
      "templateId": "{gupshup_template_id}",
      "groupIds": ["{group_id_1}", "{group_id_2}"],
      "scheduledAt": "2026-06-25T09:00:00+05:30"
    }
  }
}
```

### Update Contact Fields

```javascript
{
  "query": "mutation UpdateContact($id: ID!, $input: ContactInput!) { updateContact(id: $id, input: $input) { contact { id fields } errors { key message } } }",
  "variables": {
    "id": "{contact_id}",
    "input": {
      "fields": "{\"tffp_week\": {\"value\": \"4\", \"type\": \"string\", \"inserted_at\": \"2026-06-25T00:00:00Z\"}}"
    }
  }
}
```

**Important:** Glific stores contact fields as a JSON string inside the `fields` key. Each field entry must include `value`, `type`, and `inserted_at`. Construct this string in n8n using a Function node before passing it to the HTTP Request node.

### Look Up a Contact by Phone

```javascript
{
  "query": "query GetContact($filter: ContactFilter!) { contacts(filter: $filter) { id name phone fields } }",
  "variables": {
    "filter": {
      "phone": "{phone_number_with_country_code}"
    }
  }
}
```

### Add a Contact to a Group

```javascript
{
  "query": "mutation CreateContactGroup($input: ContactGroupInput!) { createContactGroup(input: $input) { contactGroup { id } errors { key message } } }",
  "variables": {
    "input": {
      "contactId": "{contact_id}",
      "groupId": "{group_id}"
    }
  }
}
```

---

## 6. Flows to Build Per Program

Priority legend: **P1** = Phase 1 (Weeks 1–3), **P2** = Phase 2 (Weeks 4–6), **P3** = Phase 3 (Weeks 7–10)

| Program | Flow Name | Trigger | What It Does | Priority |
|---|---|---|---|---|
| TFFP | Consent + Language | First inbound message | Language selection → consent text → yes/no/stop branch → set fields + tags | P1 |
| TFFP | Profile — Session 1 | Flow trigger (post-consent) | Ask role, ask district; branch parent vs. educator | P1 |
| TFFP | Profile — Session 2 | Flow trigger (post-session-1) | Ask child DOB (parents) or experience years (educators); set learning_interest | P1 |
| TFFP | Profile — Session 3 | Flow trigger (post-session-2) | Ask preferred content time; confirm setup complete; set engagement_level = new | P1 |
| TFFP | Add to Region Group | Flow trigger | Match location + language to correct group; fallback to Urban-English | P1 |
| TFFP | Parent Dev Stage Compute | Flow trigger (post child_dob set) | Calculate developmental stage from DOB; set dev_stage + dev_stage_updated | P1 |
| TFFP | Inactivity Re-engagement | Scheduled (daily check) | If last_response_date > 21 days and consent active → send re-engagement + tag needs-followup | P2 |
| TFFP | Streak Milestone | Flow trigger (called by n8n after streak update) | Branch on streak_weeks 4/12/26 → send milestone message | P2 |
| TFFP | CTA Submission Router | Keyword / flow trigger | Receive check-in form submission confirmation; update streak; trigger milestone check | P2 |
| TFFP | Library Menu | Keyword (LIBRARY or RESOURCES) | Show quick-reply menu of resource categories; send relevant content link on selection | P3 |
| CMYC | Consent | First inbound message | Same structure as TFFP consent; sets program = cmyc | P1 |
| CMYC | Weekly Report Reminder | Scheduled (Monday 09:00 IST) | Send Gupshup form link; add tag report-overdue | P1 |
| CMYC | Attendance Summary | Flow trigger (post form webhook) | n8n triggers this after writing report to Supabase; sends auto-summary to centre | P2 |
| CMYC | Issue Alert | Keyword (ISSUE) | Add tag escalate-to-coordinator; notify PM via Glific; send acknowledgement to contact | P2 |
| OESN | Consent | First inbound message | Same structure; sets program = oesn | P1 |
| OESN | Intake Form Trigger | Flow trigger (on add to Doorstep group) | Send Gupshup intake form link; set intake_date | P1 |
| OESN | Session Reminder | Scheduled (weekly, per agent) | Remind field agent to log session notes for their assigned entrepreneurs | P2 |
| OESN | Referral Status Update | Flow trigger (called by n8n on Supabase row update) | Branch on referral_status value → send appropriate status message to entrepreneur | P2 |

---

## 7. Gupshup Template Approvals

Templates must be submitted in Gupshup and approved by Meta before any broadcast can use them. Allow **2–5 business days** per template. Submit all Phase 1 templates on Day 1 of the project.

Templates must not contain prohibited content (no guarantees of outcomes, no misleading claims). Variable placeholders use `{{1}}`, `{{2}}` format.

| Template Name | Program | Message Body (first 160 chars) | Variables | Priority |
|---|---|---|---|---|
| `sauramandala_tffp_welcome` | TFFP | "Welcome to the Teachers for the Future Pathway by Sauramandala! 🌱 You'll receive weekly learning content on early childhood care. Reply YES to join." | None | P1 |
| `sauramandala_tffp_weekly_content` | TFFP | "Hi {{1}}! Your TFFP Week {{2}} content is here 📚\n\n{{3}}\n\nTap to share your reflection: {{4}}" | contact name, week number, content teaser, form link | P1 |
| `sauramandala_tffp_reengagement` | TFFP | "Hi {{1}} 👋 We've missed you in TFFP! The learning community is still here whenever you're ready. Reply LIBRARY to browse past content." | contact name | P2 |
| `sauramandala_tffp_milestone_4wk` | TFFP | "You've been learning with TFFP for 4 weeks! 🎉 That's consistency — and it shows in the children you work with. Keep going, {{1}}!" | contact name | P2 |
| `sauramandala_tffp_milestone_12wk` | TFFP | "3 months with TFFP, {{1}}! 🌟 You're part of a community of educators making a real difference in Meghalaya." | contact name | P2 |
| `sauramandala_tffp_milestone_26wk` | TFFP | "6 months completed, {{1}}! 🏆 You've finished the TFFP pathway. Your certificate of completion is on its way." | contact name | P3 |
| `sauramandala_cmyc_welcome` | CMYC | "Welcome to Sauramandala's CMYC network! 👋 You'll receive weekly report reminders and updates here. Reply YES to confirm." | None | P1 |
| `sauramandala_cmyc_report_reminder` | CMYC | "Good morning! It's time to submit your weekly centre report for {{1}}. Tap here: {{2}} — takes about 3 minutes. Thank you! 🙏" | week date range, form link | P1 |
| `sauramandala_cmyc_report_received` | CMYC | "Report received ✅ Week of {{1}}: {{2}} sessions, {{3}} attendees at {{4}}. Thank you for submitting on time!" | week date, sessions, attendance, centre name | P2 |
| `sauramandala_oesn_welcome` | OESN | "Welcome to Sauramandala's OESN! 🤝 We support entrepreneurs in Meghalaya with guidance, connections, and resources. Reply YES to begin." | None | P1 |
| `sauramandala_oesn_intake_form` | OESN | "Hi {{1}}! To support you better, please fill a short form about your business (5 minutes): {{2}} — your information is confidential." | contact name, form link | P1 |
| `sauramandala_oesn_referral_update` | OESN | "Update on your referral, {{1}}: {{2}}. For questions, speak to your coordinator or reply to this message." | contact name, status message | P2 |

---

## 8. File and Folder Structure

```
/glific-config/
  programs/
    tffp.yaml              # Full TFFP program config
    cmyc.yaml              # Full CMYC program config
    oesn.yaml              # Full OESN program config
  deploy.py                # Deployment script (reads YAML, pushes to Glific API)
  requirements.txt         # pyyaml, requests
  .env.example             # Template for environment variables
  README.md                # How to run deploy.py
  flows/                   # Generated RapidPro JSON files (created by deploy.py)
    tffp_consent.json
    tffp_profile_session1.json
    tffp_profile_session2.json
    tffp_profile_session3.json
    tffp_add_to_group.json
    tffp_compute_dev_stage.json
    tffp_inactivity.json
    tffp_milestone.json
    tffp_library_menu.json
    cmyc_consent.json
    cmyc_weekly_reminder.json
    cmyc_attendance_summary.json
    cmyc_issue_alert.json
    oesn_consent.json
    oesn_intake_trigger.json
    oesn_session_reminder.json
    oesn_referral_status_update.json
```

**requirements.txt:**

```
pyyaml>=6.0
requests>=2.31.0
```

**.env.example:**

```bash
# Copy to .env and fill in values. Never commit .env to git.
GLIFIC_API_URL=https://your-instance.glific.com/api
GLIFIC_API_KEY=your_api_key_here
```

**Running the script:**

```bash
# Install dependencies
pip install -r requirements.txt

# Copy and fill environment variables
cp .env.example .env
# edit .env

# Export environment variables
export $(cat .env | xargs)

# Deploy TFFP (dry run first)
python deploy.py --program tffp --dry-run

# Deploy TFFP for real
python deploy.py --program tffp

# Deploy all programs
python deploy.py --program tffp && python deploy.py --program cmyc && python deploy.py --program oesn

# Deploy with verbose output (shows all items, not just new ones)
python deploy.py --program tffp --verbose
```

---

## 9. Phase Plan

### Phase 1 — Weeks 1–3: Foundation

**Goal:** Glific is live, TFFP contacts can opt in and be profiled, PMs have a working inbox.

- [ ] Gupshup account connected to Glific (webhook URL configured in Gupshup dashboard pointing to Glific)
- [ ] Glific connected to Gupshup BSP (BSP credentials entered in Glific Settings)
- [ ] GLIFIC_API_KEY obtained and stored in `.env`
- [ ] `python deploy.py --program tffp` run — contact fields, groups, tags created
- [ ] TFFP Consent + Language flow deployed and tested with a test number
- [ ] TFFP Profile Sessions 1, 2, 3 deployed
- [ ] TFFP Add to Region Group flow deployed
- [ ] TFFP Parent Dev Stage Compute flow deployed
- [ ] CMYC and OESN configs deployed (`--program cmyc`, `--program oesn`)
- [ ] PMs given Glific login and trained on inbox (assign, tag, reply, quick filters)
- [ ] All Phase 1 templates submitted to Gupshup for Meta approval (allow 2–5 business days)
- [ ] Keyword triggers (STOP, JOIN, LIBRARY) confirmed working

**Acceptance test:** A new test number sends "Hi" → receives language selector → selects language → receives consent message → replies YES → receives profile questions → is added to correct group → PM sees contact in inbox with correct tags and fields filled.

---

### Phase 2 — Weeks 4–6: Forms, Automation, All Programs Live

**Goal:** Gupshup forms built, n8n pipeline live, CMYC reporting and OESN intake operational.

- [ ] TFFP Weekly Check-in Form built in Gupshup Flow Builder and tested
- [ ] CMYC Weekly Report Form built and tested
- [ ] OESN Intake Form built and tested
- [ ] Gupshup webhook endpoints configured in n8n (one workflow per form)
- [ ] n8n → Supabase writes confirmed for each form type
- [ ] n8n → Glific contact field updates confirmed (updateContact mutation)
- [ ] TFFP content scheduler live: n8n reads Google Sheet → sends weekly content via Glific sendMessage → includes check-in form link
- [ ] CMYC Weekly Reminder flow scheduled and firing every Monday
- [ ] CMYC Attendance Summary flow (auto-reply after report submit) live
- [ ] OESN Intake Trigger flow live
- [ ] TFFP Inactivity Re-engagement flow deployed and scheduled
- [ ] TFFP Streak Milestone flow deployed; n8n calls it after updating streak_weeks
- [ ] Phase 2 templates approved and in use

**Acceptance test:** A CMYC coordinator receives Monday reminder → taps form link → submits report → receives auto-summary confirmation → PM sees updated Supabase row and Glific contact field `last_report_date` updated.

---

### Phase 3 — Weeks 7–10: Content Machine + Advanced Flows

**Goal:** Full content machine live, library menu operational, milestone tracking complete.

- [ ] TFFP CTA Submission Router flow deployed (processes check-in webhook confirmation from n8n)
- [ ] Streak increment logic in n8n (reads current streak_weeks, increments, writes back, triggers milestone flow if threshold reached)
- [ ] TFFP Library Menu flow deployed (keyword LIBRARY → content category quick reply → sends resource link)
- [ ] OESN Session Reminder workflow in n8n (per-agent schedule, triggers Glific message)
- [ ] OESN Referral Status Update flow deployed; n8n triggers it on Supabase `referral_status` column update (via Supabase webhook or polling)
- [ ] Content machine integration: social content publish pipeline sends approved content to Glific broadcast for relevant TFFP groups
- [ ] Phase 3 templates approved and in use
- [ ] Full end-to-end test across all three programs with real PM users
- [ ] Monitoring: n8n error alert workflow live (notify on failed Glific API call or failed Supabase write)

**Acceptance test:** A TFFP contact completes their 4th weekly check-in → n8n increments streak to 4 → triggers tffp_milestone flow → contact receives 4-week milestone message. A TFFP educator sends LIBRARY → receives category menu → selects category → receives resource link.
