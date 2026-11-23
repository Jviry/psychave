"""Shared transactional email templates and base class.

Concrete providers (``BrevoService``, ``SesService``) subclass
``BaseEmailService`` and implement ``send_email``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, time
from html import escape
from typing import Literal, Sequence

from common.settings import settings

SlotTime = tuple[date, time, time | None]
Recipient = Literal["client", "psychologist"]

INQUIRY_EMAIL = "psychaveph.info@gmail.com"
TEXT_FOOTER = (
    "PsychAvenuePH\n"
    "---\n"
    "This is an automated message — please do not reply directly to this email.\n"
    f"For inquiries or assistance, contact us at {INQUIRY_EMAIL}."
)


class BaseEmailService(ABC):
    def __init__(self) -> None:
        self.from_email = settings.EMAIL_FROM_EMAIL
        self.from_name = settings.EMAIL_FROM_NAME
        self.reply_to = settings.EMAIL_REPLY_TO
        self.frontend_base_url = settings.FRONTEND_BASE_URL.rstrip("/")

    # ----- delivery hook (implemented by each provider) -----

    @abstractmethod
    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        """Send one transactional email. Must never raise."""
        ...

    # ----- booking & client-first scheduling emails -----

    def send_booking_received(
        self,
        to: str,
        appointment_id: str,
        slots: Sequence[SlotTime] = (),
    ) -> None:
        subject = "We received your session request"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        slot_lines = (
            "\n".join(f"  - {self._format_slot(slot)}" for slot in slots)
            if slots
            else ""
        )
        slots_text_block = (
            f"Your preferred schedules:\n{slot_lines}\n\n" if slot_lines else ""
        )
        text = (
            "Hi,\n\n"
            "We received your session request. A verified psychologist will "
            "review your preferred schedules and either accept one of your "
            "times or offer the nearest available alternative.\n\n"
            f"{slots_text_block}"
            f"Booking reference: {appointment_id}\n"
            f"View your booking: {link}\n\n"
            "We will email you once a psychologist responds.\n\n"
            f"{TEXT_FOOTER}"
        )
        slots_html_block = ""
        if slots:
            items = "".join(
                f'<li style="margin:0 0 6px;">{escape(self._format_slot(slot))}</li>'
                for slot in slots
            )
            slots_html_block = (
                '<p style="margin:0 0 8px;"><strong>Your preferred schedules:</strong></p>'
                f'<ul style="margin:0 0 16px;padding-left:20px;">{items}</ul>'
            )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">We received your session request. A verified
psychologist will review your preferred schedules and either accept one of your
times or offer the nearest available alternative.</p>
{slots_html_block}<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">View your booking</a></p>
<p style="margin:0;">We will email you once a psychologist responds.</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_schedule_accepted(
        self,
        to: str,
        appointment_id: str,
        slot: SlotTime,
        price: float,
    ) -> None:
        subject = "Your session schedule is agreed — complete payment to confirm"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        formatted_slot = self._format_slot(slot)
        fee = self._format_price(price)
        text = (
            "Hi,\n\n"
            "Your session schedule has been agreed. Complete payment before the "
            "deadline to lock in the session and unlock your psychologist's "
            "contact details.\n\n"
            f"Agreed schedule: {formatted_slot}\n"
            f"Session fee: {fee}\n\n"
            f"Complete payment: {link}\n\n"
            "The session is only confirmed once payment succeeds.\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your session schedule has been agreed. Complete
payment before the deadline to lock in the session and unlock your
psychologist's contact details.</p>
<p style="margin:0 0 8px;"><strong>Agreed schedule:</strong> {escape(formatted_slot)}</p>
<p style="margin:0 0 16px;"><strong>Session fee:</strong> {escape(fee)}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">Complete payment</a></p>
<p style="margin:0;">The session is only confirmed once payment succeeds.</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_counter_offer(
        self,
        to: str,
        appointment_id: str,
        slot: SlotTime,
        price: float,
    ) -> None:
        subject = "Your psychologist offered an alternative session time"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        formatted_slot = self._format_slot(slot)
        fee = self._format_price(price)
        text = (
            "Hi,\n\n"
            "Your psychologist reviewed your preferred schedules and offered "
            "the nearest available alternative time. You can accept this time "
            "or submit a new set of preferred schedules.\n\n"
            f"Proposed alternative time: {formatted_slot}\n"
            f"Session fee: {fee}\n\n"
            f"Respond to proposed schedule: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your psychologist reviewed your preferred schedules
and offered the nearest available alternative time. You can accept this time or
submit a new set of preferred schedules.</p>
<p style="margin:0 0 8px;"><strong>Proposed alternative time:</strong> {escape(formatted_slot)}</p>
<p style="margin:0 0 16px;"><strong>Session fee:</strong> {escape(fee)}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">Respond to proposed schedule</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_preferences_updated(
        self,
        to: str,
        appointment_id: str,
        slots: Sequence[SlotTime],
    ) -> None:
        subject = "A client submitted new preferred session schedules"
        link = f"{self.frontend_base_url}/psych/schedule"
        slot_lines = "\n".join(
            f"  - {self._format_slot(slot)}" for slot in slots
        )
        text = (
            "Hi,\n\n"
            "A client submitted a new set of preferred schedules for an "
            "appointment assigned to you. Please accept one of the preferred "
            "times or offer an alternative schedule.\n\n"
            f"Booking reference: {appointment_id}\n"
            f"Preferred schedules:\n{slot_lines}\n\n"
            f"Review schedule: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        slots_html = "".join(
            f'<li style="margin:0 0 6px;">{escape(self._format_slot(slot))}</li>'
            for slot in slots
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">A client submitted a new set of preferred schedules
for an appointment assigned to you. Please accept one of the preferred times or
offer an alternative schedule.</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
<ul style="margin:0 0 16px;padding-left:20px;">{slots_html}</ul>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">Review schedule</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    # unused, this was supposed to be used for when it was psychologists send 3 scheds instead of the client
    def send_proposal_ready(
        self,
        to: str,
        appointment_id: str,
        slots: Sequence[SlotTime],
        price: float,
    ) -> None:
        if len(slots) == 1:
            self.send_counter_offer(to, appointment_id, slots[0], price)
            return

        subject = "Your session times are ready"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        slot_lines = "\n".join(
            f"  - {self._format_slot(slot)}" for slot in slots
        )
        fee = self._format_price(price)
        text = (
            "Hi,\n\n"
            "Your psychologist proposed session times. Choose the one "
            "that works for you and complete payment to confirm the session.\n\n"
            f"Session fee: {fee}\n"
            f"Proposed times:\n{slot_lines}\n\n"
            f"Choose a time and pay: {link}\n\n"
            "The session is only confirmed once payment succeeds.\n\n"
            f"{TEXT_FOOTER}"
        )
        slots_html = "".join(
            f'<li style="margin:0 0 6px;">{escape(self._format_slot(slot))}</li>'
            for slot in slots
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your psychologist proposed session times.
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
                "psychologist's contact details are now available in your booking."
            )
            link = f"{self.frontend_base_url}/proposal/{appointment_id}"
            cta = "View your booking"

        text = (
            "Hi,\n\n"
            f"{lead}\n\n"
            f"Booking reference: {appointment_id}\n"
            f"{cta}: {link}\n\n"
            f"{TEXT_FOOTER}"
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

    def send_psychologist_invitation(
        self,
        to: str,
        invitation_url: str,
        expires_hours: int = 48,
    ) -> None:
        subject = "You have been invited to join PsychAvenuePH as a Psychologist"
        text = (
            "Hi,\n\n"
            "An administrator has invited you to register as a verified psychologist "
            "on PsychAvenuePH.\n\n"
            "Use the single-use invitation link below to set up your credentials and "
            "complete your practitioner profile:\n"
            f"{invitation_url}\n\n"
            f"This invitation link expires in {expires_hours} hours and can only be used once.\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">An administrator has invited you to register as a verified psychologist on PsychAvenuePH.</p>
<p style="margin:0 0 16px;">Use the single-use invitation link below to create your account credentials and complete your practitioner profile:</p>
<p style="margin:0 0 16px;"><a href="{escape(invitation_url)}" style="color:#25372d;font-weight:600;">Complete psychologist registration</a></p>
<p style="margin:0;font-size:13px;color:#5d8b69;">This link expires in {expires_hours} hours and can only be used once.</p>
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
        <hr style="margin:24px 0 16px;border:0;border-top:1px solid #e4e8e5;" />
        <p style="margin:0 0 6px;font-size:12px;color:#5d8b69;">PsychAvenuePH</p>
        <p style="margin:0;font-size:12px;color:#6e7d73;">
          This is an automated message — please do not reply directly to this email.
          For inquiries or assistance, contact us at
          <a href="mailto:{INQUIRY_EMAIL}" style="color:#25372d;">{INQUIRY_EMAIL}</a>.
        </p>
      </td></tr>
    </table>
  </body>
</html>
"""
