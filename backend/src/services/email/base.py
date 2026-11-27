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
                "is now confirmed — please add the session meeting link in your "
                "schedule so the client can join."
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

    # ----- rescheduling, no-show, waiver & refund emails -----

    def send_reschedule_requested(
        self,
        to: str,
        appointment_id: str,
        recipient: Recipient,
        *,
        initiated_by: Recipient,
        fee_required: bool = False,
        reason: str | None = None,
        slots: Sequence[SlotTime] = (),
    ) -> None:
        link = (
            f"{self.frontend_base_url}/psych/schedule"
            if recipient == "psychologist"
            else f"{self.frontend_base_url}/proposal/{appointment_id}"
        )
        if initiated_by == "psychologist":
            if recipient == "client":
                subject = "Your psychologist requested to reschedule your session"
                lead = (
                    "Your psychologist requested to reschedule your confirmed session "
                    "at no extra charge and offered their earliest available schedule. "
                    "You can accept this time or submit 3–5 new preferred schedules."
                )
                slot_heading = "Offered earliest available schedule"
            else:
                subject = "Reschedule request sent to your client"
                lead = (
                    "Your reschedule request and earliest available schedule have "
                    "been sent to your client for review."
                )
                slot_heading = "Your offered earliest available schedule"
        else:
            if recipient == "client":
                if fee_required:
                    subject = "Reschedule request received — ₱600 reschedule fee required"
                    lead = (
                        "Your reschedule request was submitted less than 2 hours before "
                        "the scheduled session. Please complete the ₱600 reschedule fee "
                        "to proceed with your preferred schedules. If you have a valid "
                        "reason, please contact your psychologist — they can waive the "
                        "fee so your new schedule offers proceed at no extra charge."
                    )
                else:
                    subject = "Your reschedule request was received"
                    lead = (
                        "Your reschedule request was received with no extra fee. Your "
                        "psychologist will review your new preferred schedules and "
                        "confirm a time or offer an alternative."
                    )
                slot_heading = "Your new preferred schedules"
            else:
                if fee_required:
                    subject = "A client requested a late reschedule (< 2 hours)"
                    lead = (
                        "A client requested to reschedule within 2 hours of the "
                        "session. Their new preferred schedules are attached below. "
                        "Scheduling will reopen once they pay the ₱600 reschedule fee, "
                        "or you can waive the fee on your schedule dashboard if they "
                        "have a valid reason."
                    )
                else:
                    subject = "A client requested to reschedule a session"
                    lead = (
                        "A client requested to reschedule an appointment assigned to "
                        "you and submitted new preferred schedules. Please accept one "
                        "of the times or offer an alternative schedule."
                    )
                slot_heading = "Client's preferred schedules"

        reason_line = f"\nReason: {reason}\n" if reason else ""
        slot_lines = (
            "\n".join(f"  - {self._format_slot(slot)}" for slot in slots)
            if slots
            else ""
        )
        slots_text_block = (
            f"\n{slot_heading}:\n{slot_lines}\n" if slot_lines else ""
        )
        text = (
            f"Hi,\n\n{lead}\n"
            f"\nBooking reference: {appointment_id}{reason_line}{slots_text_block}\n"
            f"Open booking: {link}\n\n"
            f"{TEXT_FOOTER}"
        )

        reason_html = (
            f'<p style="margin:0 0 12px;"><strong>Reason:</strong> {escape(reason)}</p>'
            if reason
            else ""
        )
        slots_html_block = ""
        if slots:
            items = "".join(
                f'<li style="margin:0 0 6px;">{escape(self._format_slot(slot))}</li>'
                for slot in slots
            )
            slots_html_block = (
                f'<p style="margin:0 0 8px;"><strong>{escape(slot_heading)}:</strong></p>'
                f'<ul style="margin:0 0 16px;padding-left:20px;">{items}</ul>'
            )

        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">{escape(lead)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 12px;font-family:monospace;">{escape(str(appointment_id))}</p>
{reason_html}{slots_html_block}<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;font-weight:bold;">Open booking</a></p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_reschedule_fee_resolved(
        self,
        to: str,
        appointment_id: str,
        recipient: Recipient,
        *,
        waived: bool,
        has_submitted_slots: bool,
        waiver_reason: str | None = None,
    ) -> None:
        status_label = "waived by the psychologist" if waived else "paid"
        if recipient == "psychologist":
            link = f"{self.frontend_base_url}/psych/schedule"
            subject = f"Reschedule fee {('waived' if waived else 'paid')} — scheduling reopened"
            lead = (
                f"The ₱600 reschedule fee for this booking has been {status_label}. "
                + (
                    "The client's preferred schedules are ready for your review."
                    if has_submitted_slots
                    else "The client has been prompted to submit 3–5 new preferred schedules."
                )
            )
        else:
            link = f"{self.frontend_base_url}/proposal/{appointment_id}"
            subject = f"Reschedule fee {('waived' if waived else 'confirmed')} — next step"
            lead = (
                f"Your ₱600 reschedule fee has been {status_label}. "
                + (
                    "Your psychologist is now reviewing your submitted preferred schedules."
                    if has_submitted_slots
                    else "Please submit 3–5 new preferred schedules so your psychologist can confirm a new time."
                )
            )
        reason_text = f"\nReason: {waiver_reason}\n" if waiver_reason else ""
        reason_html = (
            f'<p style="margin:0 0 12px;"><strong>Reason:</strong> {escape(waiver_reason)}</p>'
            if waiver_reason
            else ""
        )
        text = (
            f"Hi,\n\n{lead}\n"
            f"\nBooking reference: {appointment_id}{reason_text}\n"
            f"Open booking: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">{escape(lead)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
{reason_html}<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;font-weight:bold;">Open booking</a></p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_no_show_marked(
        self,
        to: str,
        appointment_id: str,
        recipient: Recipient,
    ) -> None:
        if recipient == "psychologist":
            link = f"{self.frontend_base_url}/psych/schedule"
            subject = "Session marked as No-Show"
            lead = (
                "You marked this session as a No-Show. The scheduled slot has been "
                "released. If the client contacts you with a valid reason, you can "
                "waive the ₱600 reschedule fee from your schedule dashboard."
            )
        else:
            link = f"{self.frontend_base_url}/proposal/{appointment_id}"
            subject = "Your session was marked as a No-Show"
            lead = (
                "Your session was marked as a No-Show. To reschedule, a ₱600 "
                "reschedule fee applies. If you had a valid reason, please contact "
                "your psychologist — they may waive the fee so you can submit new "
                "preferred schedules."
            )
        text = (
            f"Hi,\n\n{lead}\n\n"
            f"Booking reference: {appointment_id}\n"
            f"Open booking: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">{escape(lead)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 16px;font-family:monospace;">{escape(str(appointment_id))}</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;font-weight:bold;">Open booking</a></p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_refund_issued(
        self,
        to: str,
        appointment_id: str,
        recipient: Recipient,
        *,
        amount_centavos: int,
        is_full: bool,
        reason: str | None = None,
    ) -> None:
        refund_php = self._format_price(amount_centavos / 100.0)
        kind = "full" if is_full else "partial"
        if recipient == "psychologist":
            link = f"{self.frontend_base_url}/psych/schedule"
            subject = f"Booking {kind}ly refunded — slot released"
            lead = (
                f"An administrator issued a {kind} refund ({refund_php}) for this "
                "appointment and released the scheduled slot from your calendar."
            )
        else:
            link = f"{self.frontend_base_url}/proposal/{appointment_id}"
            subject = f"Your {kind} refund ({refund_php}) has been processed"
            lead = (
                f"A {kind} refund of {refund_php} has been processed for your booking."
            )
        reason_line = f"\nReason: {reason}\n" if reason else ""
        reason_html = (
            f'<p style="margin:0 0 12px;"><strong>Reason:</strong> {escape(reason)}</p>'
            if reason
            else ""
        )
        text = (
            f"Hi,\n\n{lead}\n"
            f"\nBooking reference: {appointment_id}{reason_line}\n"
            f"Open booking: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">{escape(lead)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#5d8b69;">Booking reference</p>
<p style="margin:0 0 12px;font-family:monospace;">{escape(str(appointment_id))}</p>
{reason_html}<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;font-weight:bold;">Open booking</a></p>
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

    def send_meeting_link_ready(
        self,
        to: str,
        appointment_id: str,
        meeting_link: str,
    ) -> None:
        subject = "Your session meeting link is ready"
        booking_url = f"{self.frontend_base_url}/proposal/{appointment_id}"
        text = (
            "Hi,\n\n"
            "Your psychologist has added the video meeting link for your confirmed session.\n\n"
            f"Meeting link: {meeting_link}\n"
            f"Booking details: {booking_url}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your psychologist has added the video meeting link for your confirmed session.</p>
<p style="margin:0 0 16px;"><a href="{escape(meeting_link)}" style="color:#25372d;font-weight:bold;">Join Session</a></p>
<p style="margin:0 0 16px;"><a href="{escape(booking_url)}" style="color:#25372d;">View your booking</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_payment_expired(self, to: str, appointment_id: str) -> None:
        subject = "Payment deadline passed — submit new preferred schedules"
        link = f"{self.frontend_base_url}/proposal/{appointment_id}"
        text = (
            "Hi,\n\n"
            "The payment deadline for your agreed session schedule has passed, "
            "so the reserved slot has been released. Please submit a new set of "
            "preferred schedules to continue.\n\n"
            f"Submit new schedules: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">The payment deadline for your agreed session schedule
has passed, so the reserved slot has been released. Please submit a new set of
preferred schedules to continue.</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">Submit new preferred schedules</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_pending_sla_alert(
        self, to: str, appointment_id: str, hours_waiting: int
    ) -> None:
        subject = f"Pending booking awaiting pickup ({hours_waiting}h+)"
        link = f"{self.frontend_base_url}/psych/queue"
        text = (
            "Hi,\n\n"
            f"Booking {appointment_id} has been in the pending queue for over "
            f"{hours_waiting} hours without being picked up.\n\n"
            f"View queue: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Booking <code>{escape(str(appointment_id))}</code>
has been in the pending queue for over {hours_waiting} hours without being picked up.</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;">View queue</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_session_reminder(
        self,
        to: str,
        appointment_id: str,
        slot: SlotTime,
        hours_before: int,
        meeting_link: str | None = None,
        recipient: Recipient = "client",
    ) -> None:
        subject = f"Reminder: your session starts in {hours_before} hour{'s' if hours_before != 1 else ''}"
        formatted_slot = self._format_slot(slot)
        portal_path = "/psych/schedule" if recipient == "psychologist" else f"/proposal/{appointment_id}"
        portal_link = f"{self.frontend_base_url}{portal_path}"
        meeting_line = f"Meeting link: {meeting_link}\n" if meeting_link else ""
        meeting_html = (
            f'<p style="margin:0 0 12px;"><strong>Meeting link:</strong> <a href="{escape(meeting_link)}" style="color:#25372d;">{escape(meeting_link)}</a></p>'
            if meeting_link
            else ""
        )
        text = (
            "Hi,\n\n"
            f"This is a reminder that your confirmed session is in about {hours_before} hour(s).\n\n"
            f"Schedule: {formatted_slot}\n"
            f"{meeting_line}"
            f"View booking: {portal_link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">This is a reminder that your confirmed session is in about {hours_before} hour(s).</p>
<p style="margin:0 0 8px;"><strong>Schedule:</strong> {escape(formatted_slot)}</p>
{meeting_html}
<p style="margin:0 0 16px;"><a href="{escape(portal_link)}" style="color:#25372d;">View booking</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)

    def send_evaluation_request(
        self,
        to: str,
        appointment_id: str,
        evaluation_form_url: str | None = None,
    ) -> None:
        subject = "How was your session? Share your feedback"
        link = evaluation_form_url or f"{self.frontend_base_url}/proposal/{appointment_id}"
        text = (
            "Hi,\n\n"
            "Your session has been marked as completed. We would appreciate your "
            "feedback in a brief post-session evaluation form.\n\n"
            f"Evaluation form: {link}\n\n"
            f"{TEXT_FOOTER}"
        )
        html = self._wrap_html(
            subject,
            f"""\
<p style="margin:0 0 16px;">Your session has been marked as completed. We would
appreciate your feedback in a brief post-session evaluation form.</p>
<p style="margin:0 0 16px;"><a href="{escape(link)}" style="color:#25372d;font-weight:bold;">Open Evaluation Form</a></p>
<p style="margin:0;">PsychAvenuePH</p>
""",
        )
        self.send_email(to, subject, html, text)
