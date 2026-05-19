"""Thin wrapper around the Twilio WhatsApp API."""
import os
from typing import Optional

from twilio.rest import Client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(
            os.environ["TWILIO_ACCOUNT_SID"],
            os.environ["TWILIO_AUTH_TOKEN"],
        )
    return _client


FROM = lambda: os.environ["TWILIO_WHATSAPP_NUMBER"]  # noqa: E731


def send(to: str, body: str, media_url: Optional[str] = None):
    """Send a WhatsApp message. `to` must be in whatsapp:+<number> format."""
    kwargs: dict = {"from_": FROM(), "to": to, "body": body}
    if media_url:
        kwargs["media_url"] = [media_url]
    get_client().messages.create(**kwargs)


def send_admin(body: str):
    admin = os.getenv("ADMIN_PHONE", "")
    if admin:
        send(admin, f"[BOT ALERT] {body}")
