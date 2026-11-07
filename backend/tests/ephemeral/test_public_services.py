"""Ephemeral tests for health and public services catalog endpoints."""

import httpx


def test_health_check(api_url: str):
    res = httpx.get(f"{api_url}/health", timeout=10)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_public_services_catalog_unauthenticated(api_url: str):
    """Both /services and /services/active must be public and return seeded metadata."""
    for path in ("/services", "/services/active"):
        res = httpx.get(f"{api_url}{path}", timeout=10)
        assert res.status_code == 200, f"GET {path} failed: {res.text}"

        services = res.json()
        assert len(services) == 7

        by_name = {svc["name"]: svc for svc in services}
        standalone = by_name["Standalone Clinical Consultation"]
        assert standalone["duration_minutes"] == 45
        assert standalone["guardrail_notice"]

        couples = by_name["Couples Counseling"]
        assert couples["duration_minutes"] == 90
        assert couples["guardrail_notice"] is None

        family = by_name["Family & Group Counseling"]
        assert family["duration_minutes"] == 120
