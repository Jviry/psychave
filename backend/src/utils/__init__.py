"""Pure scheduling and domain utility helpers."""
from utils.scheduling import (
    MAX_SLOTS,
    MIN_SLOTS,
    interval_for,
    intervals_overlap,
    slot_interval,
    validate_single_slot,
    validate_slot_inputs,
)

__all__ = [
    "MAX_SLOTS",
    "MIN_SLOTS",
    "interval_for",
    "intervals_overlap",
    "slot_interval",
    "validate_single_slot",
    "validate_slot_inputs",
]
