"""Amazon SES transactional email service.

Subclasses ``BaseEmailService`` for shared email templates and sends
via Amazon SES (``sesv2``).

While SES is not provisioned yet (``EMAIL_FROM_EMAIL`` unset), ``send_email``
logs and returns instead of calling AWS. This lets the booking flow run in
development without a verified domain.
"""

from __future__ import annotations

import logging
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from common.settings import settings
from services.email.base import BaseEmailService, Recipient, SlotTime

logger = logging.getLogger(__name__)

__all__ = ["SesService", "Recipient", "SlotTime"]


class SesService(BaseEmailService):
    def __init__(self) -> None:
        super().__init__()
        self.client = boto3.client(
            "sesv2",
            region_name=settings.AWS_REGION or "ap-southeast-1",
        )

    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        """Send one transactional email via Amazon SES. Never raises.

        Email is best-effort: callers must not fail a booking because a
        notification could not be delivered.
        """
        if not to:
            return
        if not self.from_email:
            logger.info(
                "email skipped (EMAIL_FROM_EMAIL unset): %s -> %s", subject, to
            )
            return

        from_address = (
            f"{self.from_name} <{self.from_email}>"
            if self.from_name
            else self.from_email
        )
        kwargs: dict[str, Any] = {
            "FromEmailAddress": from_address,
            "Destination": {"ToAddresses": [to]},
            "Content": {
                "Simple": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html, "Charset": "UTF-8"},
                        "Text": {"Data": text, "Charset": "UTF-8"},
                    },
                }
            },
        }
        if self.reply_to:
            kwargs["ReplyToAddresses"] = [self.reply_to]

        try:
            self.client.send_email(**kwargs)
        except (ClientError, BotoCoreError):
            logger.exception("failed to send email via SES: %s -> %s", subject, to)
