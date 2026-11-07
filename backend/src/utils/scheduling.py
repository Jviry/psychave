"""Pure client-first scheduling validation and interval math helpers."""

from datetime import datetime, timedelta

from common.exceptions import ValidationError
from common.time import now_manila, slot_start
from models.proposed_slot import ProposedSlot
from schemas.appointment import SlotInput

MAX_SLOTS = 5
MIN_SLOTS = 3


def validate_slot_inputs(
    slots: list[SlotInput], duration_minutes: int
) -> list[tuple]:
    """Validate and normalise client/psychologist slot inputs.

    Returns ``(session_date, start_time, end_time)`` rows. Times are Manila
    wall-clock values with no timezone, matching how they are stored.
    """
    if not MIN_SLOTS <= len(slots) <= MAX_SLOTS:
        raise ValidationError(
            f"Provide between {MIN_SLOTS} and {MAX_SLOTS} preferred schedules"
        )

    now = now_manila()
    seen: set[tuple] = set()
    rows: list[tuple] = []

    for slot in slots:
        key = (slot.session_date, slot.start_time)
        if key in seen:
            raise ValidationError("Preferred schedules must not contain duplicates")
        seen.add(key)

        start = slot_start(slot.session_date, slot.start_time)
        if start <= now:
            raise ValidationError("Preferred schedules must be in the future")

        end = start + timedelta(minutes=duration_minutes)
        if end.date() != slot.session_date:
            raise ValidationError(
                "A session cannot cross midnight; choose an earlier start time"
            )

        rows.append((slot.session_date, slot.start_time, end.time()))

    return rows


def validate_single_slot(slot: SlotInput, duration_minutes: int) -> tuple:
    now = now_manila()
    start = slot_start(slot.session_date, slot.start_time)
    if start <= now:
        raise ValidationError("The proposed schedule must be in the future")

    end = start + timedelta(minutes=duration_minutes)
    if end.date() != slot.session_date:
        raise ValidationError(
            "A session cannot cross midnight; choose an earlier start time"
        )

    return (slot.session_date, slot.start_time, end.time())


def interval_for(
    session_date,
    start_time,
    end_time,
    duration_minutes: int,
) -> tuple[datetime, datetime]:
    start = slot_start(session_date, start_time)
    if end_time is not None:
        end = datetime.combine(session_date, end_time)
        if end <= start:
            end = start + timedelta(minutes=duration_minutes)
    else:
        end = start + timedelta(minutes=duration_minutes)
    return start, end


def slot_interval(slot: ProposedSlot, duration_minutes: int) -> tuple[datetime, datetime]:
    return interval_for(slot.session_date, slot.start_time, slot.end_time, duration_minutes)


def intervals_overlap(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    return a_start < b_end and b_start < a_end
