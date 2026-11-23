"""Brevo transactional email service.

Subclasses ``BaseEmailService`` for shared email templates and sends
via Brevo's HTTP API (``POST https://api.brevo.com/v3/smtp/email``).

While ``EMAIL_FROM_EMAIL`` or ``BREVO_API_KEY`` is unset, ``send_email``
logs and returns instead of calling Brevo. This lets local development and
ephemeral PR environments run without sending real emails.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from common.settings import settings
from services.email.base import BaseEmailService

logger = logging.getLogger(__name__)


class BrevoService(BaseEmailService):
    endpoint = "https://api.brevo.com/v3/smtp/email"

    def __init__(self) -> None:
        super().__init__()
        self.api_key = settings.BREVO_API_KEY.strip()
        self.from_email = self.from_email.strip()
        self.from_name = self.from_name.strip()
        self.reply_to = self.reply_to.strip()

    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        """Send one transactional email via Brevo. Never raises."""
        if not to:
            return
        if not self.from_email or not self.api_key:
            logger.info(
                "email skipped (EMAIL_FROM_EMAIL or BREVO_API_KEY unset): %s -> %s",
                subject,
                to,
            )
            return

        sender: dict[str, str] = {"email": self.from_email}
        if self.from_name:
            sender["name"] = self.from_name

        payload: dict[str, Any] = {
            "sender": sender,
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html,
            "textContent": text,
        }
        if self.reply_to:
            payload["replyTo"] = {"email": self.reply_to}

        try:
            response = httpx.post(
                self.endpoint,
                headers={
                    "api-key": self.api_key,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=10.0,
            )
            response.raise_for_status()
            logger.info("email sent via Brevo: %s -> %s", subject, to)
        except httpx.HTTPStatusError as exc:
            logger.error(
                "failed to send email via Brevo (%s): %s -> %s | response=%s",
                exc.response.status_code,
                subject,
                to,
                exc.response.text,
            )
        except httpx.HTTPError:
            logger.exception("failed to send email via Brevo: %s -> %s", subject, to)
