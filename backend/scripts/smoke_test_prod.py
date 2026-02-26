import os
import sys
import requests

BASE_URL = os.getenv("SMOKE_BASE_URL", "").rstrip("/")
EMAIL = os.getenv("SMOKE_EMAIL", "")
PASSWORD = os.getenv("SMOKE_PASSWORD", "")

if not BASE_URL:
    print("SMOKE_BASE_URL is required")
    sys.exit(1)

def check(name, fn):
    try:
        fn()
        print(f"[PASS] {name}")
        return True
    except Exception as exc:
        print(f"[FAIL] {name}: {exc}")
        return False


def test_health():
    r = requests.get(f"{BASE_URL}/health", timeout=15)
    r.raise_for_status()


def test_ready():
    r = requests.get(f"{BASE_URL}/health/ready", timeout=15)
    r.raise_for_status()


def test_ping():
    r = requests.get(f"{BASE_URL}/api/v1/ping", timeout=15)
    r.raise_for_status()


def get_access_token() -> str:
    if not EMAIL or not PASSWORD:
        raise RuntimeError("SMOKE_EMAIL and SMOKE_PASSWORD are required for auth smoke test")

    login = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=20,
    )
    login.raise_for_status()

    token = login.json().get("access_token")
    if not token:
        raise RuntimeError("No access_token returned")
    return token


def test_login_and_me():
    token = get_access_token()

    me = requests.get(
        f"{BASE_URL}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    me.raise_for_status()


def test_feed_auth():
    token = get_access_token()

    feed = requests.get(
        f"{BASE_URL}/api/v1/content/feed-cursor?limit=5",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    feed.raise_for_status()


def test_ai_chat_schema():
    token = get_access_token()

    r = requests.post(
        f"{BASE_URL}/api/v1/ai/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Give me 2 concise Python backend learning recommendations."},
        timeout=30,
    )
    r.raise_for_status()

    payload = r.json()
    if not isinstance(payload.get("response"), str) or not payload.get("response").strip():
        raise RuntimeError("AI chat response is missing or empty")

    if "intent" not in payload:
        raise RuntimeError("AI chat response missing 'intent' field")


if __name__ == "__main__":
    tests = [
        ("health", test_health),
        ("ready", test_ready),
        ("ping", test_ping),
        ("auth login + me", test_login_and_me),
        ("feed cursor", test_feed_auth),
        ("ai chat schema", test_ai_chat_schema),
    ]

    results = [check(name, fn) for name, fn in tests]
    if not all(results):
        sys.exit(2)

    print("All smoke checks passed")
