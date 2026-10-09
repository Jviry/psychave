import requests


def test_health(api_url):
    response = requests.get(f"{api_url}/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
