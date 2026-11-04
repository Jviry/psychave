"""Scheduling clock helpers.

Slot rows are stored as Manila wall-clock dates/times (the booking flow has
always presented PST). Payment deadlines use the same clock so comparisons
against slot rows stay consistent, and the frontend can treat a timezone-less
ISO value as ``+08:00``.
"""

from datetime import date, datetime, time, timedelta, timezone

MANILA_TZ = timezone(timedelta(hours=8))

# Operational grace when a slot is agreed inside the 24h payment window.
PAYMENT_GRACE_MINUTES = 15


def now_manila() -> datetime:
    return datetime.now(MANILA_TZ).replace(tzinfo=None)


def slot_start(session_date: date, start_time: time) -> datetime:
    return datetime.combine(session_date, start_time)


def slot_end(session_date: date, start_time: time, duration_minutes: int) -> datetime:
    return slot_start(session_date, start_time) + timedelta(minutes=duration_minutes)


def payment_deadline_for(session_start: datetime, now: datetime | None = None) -> datetime:
    """Strict ``session - 24h`` deadline with a short pay-now grace.

    If the agreement happens inside the 24h window, the deadline is already in
    the past. In that case the client gets ``PAYMENT_GRACE_MINUTES`` to pay,
    capped at the session start so the deadline never lands after the session.
    """
    current = now or now_manila()
    deadline = session_start - timedelta(hours=24)
    if deadline <= current:
        return min(session_start, current + timedelta(minutes=PAYMENT_GRACE_MINUTES))
    return deadline
