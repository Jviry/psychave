"""Amazon SES transactional email service.

Same shape as ``CognitoService``: one boto3 client, configuration from
``common.settings``, no database coupling.

While SES is not provisioned yet (``SES_FROM_EMAIL`` unset), ``send_email``
logs and returns instead of calling AWS. This lets the booking flow run in
development without a verified domain.
"""

from __future__ import annotations

import logging
from datetime import date, time
from html import escape
from typing import Any, Literal, Sequence

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from common.settings import settings

logger = logging.getLogger(__name__)

SlotTime = tuple[date, time, time | None]
Recipient = Literal["client", "psychologist"]


class SesService:
    def __init__(self) -> None:
        self.client = boto3.client("sesv2", region_name=settings.AWS_REGION)
        self.from_email = settings.SES_FROM_EMAIL
        self.from_name = settings.SES_FROM_NAME
        self.reply_to = settings.SES_REPLY_TO
        self.frontend_base_url = settings.FRONTEND_BASE_URL
    # ----- delivery -----

    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        """Send one transactional email. Never raises.

        Email is best-effort: callers must not fail a booking because a
        notification could not be delivered.
        """
        if not self.from_email:
            logger.info(
                "email skipped (SES_FROM_EMAIL unset): %s -> %s", subject, to
            )
            return

        kwargs: dict[str, Any] = {
            "FromEmailAddress": f"{self.from_name} <{self.from_email}>",
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
            logger.exception("failed to send email: %s -> %s", subject, to)

    # ----- booking emails -----

    def send_booking_received(self, to: str, appointment_id: str) -> None:
        subject = "We received your session request"
        link = f"{self.frontend_base_url}/bookings"
        text = (
            "Hi,\n\n"
            "We received your session request. A verified psychologist will "
            "review it and propose three possible session times.\n\n"
            f"Booking reference: {appointment_id}\n"
            f"View your bookings: {link}\n\n"
            "We will email you again once the times are ready.\n\n"
            "PsychAvenuePH"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">We received your session request. A verified
psychologist will review it and propose three possible session times.</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">View your bookings</a></p>
<p style="margin:0;">We will email you again once the times are ready.</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_proposal_ready(
        self,
        to: str,
        appointment_id: str,
        slots: Sequence[SlotTime],
        price: float,
    ) -> None:
        subject = "Your session times are ready"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        slot_lines = "\n".join(
            f"  - {self._format_slot(slot)}" for slot in slots)
        fee = self._format_price(price)
        text = (
            "Hi,\n\n"
            "Your psychologist proposed three session times. Choose the one "
            "that works for you and complete payment to confirm the session.\n\n"
            f"Session fee: {fee}\n"
            f"Proposed times:\n{slot_lines}\n\n"
            f"Choose a time and pay: {link}\n\n"
            "The session is only confirmed once payment succeeds.\n\n"
            "PsychAvenuePH"
        )
        slots_html = "".join(
            f'<li style="margin:0 0 6px;">{
                escape(self._format_slot(slot))}</li>'
            for slot in slots
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your psychologist proposed three session times.
Choose the one that works for you and complete payment to confirm the session.</p>
<p style="margin:0 0 8px;"><strong>Session fee:</strong> {escape(fee)}</p>
<ul style="margin:0 0 16px;padding-left:20px;">{slots_html}</ul>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">Choose a time and pay</a></p>
<p style="margin:0;">The session is only confirmed once payment succeeds.</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_payment_confirmed(
        self,
        to: str,
        appointment_id: str,
        recipient: Recipient,
    ) -> None:
        if recipient == "psychologist":
            subject = "A session has been confirmed"
            lead = (
                "A client completed payment for a session with you. The booking "
                "is now confirmed, and the client's contact details are available "
                "in your schedule."
            )
            link = f"{self.frontend_base_url}/psych/schedule"
            cta = "View your schedule"
        else:
            subject = "Your session is confirmed"
            lead = (
                "Your payment was received and your session is confirmed. Your "
                "psychologist's contact details are now available in your bookings."
            )
            link = f"{self.frontend_base_url}/bookings"
            cta = "View your booking"

        text = (
            "Hi,\n\n"
            f"{lead}\n\n"
            f"Booking reference: {appointment_id}\n"
            f"{cta}: {link}\n\n"
            "PsychAvenuePH"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">{escape(lead)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">{escape(cta)}</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    # ----- formatting -----

    @staticmethod
    def _format_slot(slot: SlotTime) -> str:
        session_date, start_time, end_time = slot
        day = session_date.strftime("%A, %d %B %Y")
        start = start_time.strftime("%I:%M %p").lstrip("0")
        if end_time is None:
            return f"{day} - {start}"
        end = end_time.strftime("%I:%M %p").lstrip("0")
        return f"{day} - {start} to {end}"

    @staticmethod
    def _format_price(price: float) -> str:
        return f"PHP {price:,.2f}"

    @staticmethod
    def _wrap_html(heading: str, body: str) -> str:
        return f"""\
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f7f5;font-family:Arial,Helvetica,sans-serif;color:#25372d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:24px;">
        <h1 style="margin:0 0 16px;font-size:20px;">{escape(heading)}</h1>
        {body}
        <p style="margin:24px 0 0;font-size:12px;color:#5d8b69;">PsychAvenuePH</p>
      </td></tr>
    </table>
  </body>
</html>
"""
