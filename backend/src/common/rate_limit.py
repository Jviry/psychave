"""In-memory sliding-window rate limiter for auth verification endpoints."""
from collections import deque
from threading import Lock
import time

from common.exceptions import RateLimitError


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window and cooldown rate limiter."""

    def __init__(self):
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def _prune(self, dq: deque[float], now: float, window_seconds: int) -> None:
        cutoff = now - window_seconds
        while dq and dq[0] <= cutoff:
            dq.popleft()

    def check_and_record(
        self,
        checks: list[tuple[str, int, int, str]],
        cooldown_checks: list[tuple[str, int, str]] | None = None,
    ) -> None:
        """Atomically verify all cooldown and window limits, then record the event.

        ``checks`` is a list of ``(key, max_requests, window_seconds, message)``.
        ``cooldown_checks`` is a list of ``(key, cooldown_seconds, message)``.
        """
        now = time.monotonic()
        with self._lock:
            if cooldown_checks:
                for key, cooldown_seconds, message in cooldown_checks:
                    dq = self._events.get(key)
                    if dq:
                        elapsed = now - dq[-1]
                        if elapsed < cooldown_seconds:
                            retry_after = max(1, int(cooldown_seconds - elapsed) + 1)
                            raise RateLimitError(message, retry_after=retry_after)

            for key, max_requests, window_seconds, message in checks:
                dq = self._events.get(key)
                if dq is None:
                    continue
                self._prune(dq, now, window_seconds)
                if len(dq) >= max_requests:
                    oldest = dq[0]
                    retry_after = max(1, int(window_seconds - (now - oldest)) + 1)
                    raise RateLimitError(message, retry_after=retry_after)

            recorded_keys: set[str] = set()
            for key, *_ in checks:
                if key not in recorded_keys:
                    self._events.setdefault(key, deque()).append(now)
                    recorded_keys.add(key)
            if cooldown_checks:
                for key, *_ in cooldown_checks:
                    if key not in recorded_keys:
                        self._events.setdefault(key, deque()).append(now)
                        recorded_keys.add(key)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear_all(self) -> None:
        with self._lock:
            self._events.clear()


verification_rate_limiter = SlidingWindowRateLimiter()
