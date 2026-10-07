import os
import requests


API_URL = os.environ["API_URL"]


def test_health():
    response = requests.get(f"{API_URL}/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
