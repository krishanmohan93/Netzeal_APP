import io
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from sqlalchemy.orm import Session

# NOTE: Assumes auth dependency returns a test user; if auth requires token, fixture adaptation needed.
client = TestClient(app)


def test_upload_multi_and_feed(monkeypatch):
    # Mock current user dependency to bypass auth
    from app.models.user import User
    test_user = User(id=999, username="tester", email="tester@example.com", full_name="Tester")

    async def fake_get_current_user():
        return test_user

    app.dependency_overrides["get_current_user"] = fake_get_current_user  # may need actual function reference

    # Create two dummy image files (PNG headers)
    img_bytes = b"\x89PNG\r\n\x1a\n" + b"0" * 128
    files = [
        ("files", ("a.png", img_bytes, "image/png")),
        ("files", ("b.png", img_bytes, "image/png")),
    ]
    data = {"caption": "Test carousel", "title": "Carousel", "order": "0,1"}
    resp = client.post("/content/upload-multi", files=files, data=data)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"] > 0
    assert len(body["media_items"]) == 2
    # Validate ordering integrity
    order_indices = [m["order_index"] for m in body["media_items"]]
    assert order_indices == sorted(order_indices)

    # Fetch multi-feed and verify presence
    feed_resp = client.get("/content/multi-feed")
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    target = next((p for p in feed if p["id"] == body["id"]), None)
    assert target is not None
    mi = target["media_items"]
    assert len(mi) == 2
    assert [m["order_index"] for m in mi] == [0,1]
