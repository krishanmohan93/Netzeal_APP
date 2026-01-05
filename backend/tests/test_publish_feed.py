import time
from fastapi.testclient import TestClient
from app.models.user import User

API_PREFIX = "/api/v1"


def register_user(client: TestClient, email: str, username: str, password: str = "Passw0rd!"):
    resp = client.post(f"{API_PREFIX}/auth/register", json={
        "email": email,
        "username": username,
        "full_name": username.title(),
        "password": password
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


def login_user(client: TestClient, username: str, password: str = "Passw0rd!"):
    resp = client.post(f"{API_PREFIX}/auth/login", data={
        "username": username,
        "password": password
    })
    assert resp.status_code == 200, resp.text
    tokens = resp.json()
    return tokens["access_token"]


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def create_draft(client: TestClient, token: str, caption: str, media_url: str, media_type: str = "image"):
    resp = client.post(f"{API_PREFIX}/content/posts/draft", json={
        "caption": caption,
        "media_url": media_url,
        "media_type": media_type,
        "visibility": "public"
    }, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


def publish_post(client: TestClient, token: str, post_id: int):
    resp = client.post(f"{API_PREFIX}/content/posts/{post_id}/publish", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def get_cursor_feed(client: TestClient, token: str, cursor: str | None = None, limit: int = 20):
    params = {}
    if cursor:
        params["cursor"] = cursor
    params["limit"] = limit
    resp = client.get(f"{API_PREFIX}/content/feed-cursor", params=params, headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_publish_fanout_and_feed_order(client: TestClient):
    # Register two users
    user_a = register_user(client, "a@example.com", "usera")
    user_b = register_user(client, "b@example.com", "userb")

    token_a = login_user(client, "usera")
    token_b = login_user(client, "userb")

    # Create two drafts and publish sequentially
    draft1 = create_draft(client, token_a, "First caption", "http://example.com/image1.jpg")
    publish1 = publish_post(client, token_a, draft1["id"])
    time.sleep(0.05)  # ensure published_at ordering difference
    draft2 = create_draft(client, token_a, "Second caption", "http://example.com/image2.jpg")
    publish2 = publish_post(client, token_a, draft2["id"])

    # Fetch feed for second user
    feed_resp = get_cursor_feed(client, token_b)
    items = feed_resp["items"]
    assert len(items) >= 2, "Expected at least 2 items in feed"

    # Ensure newest publish (draft2) appears before draft1
    ids_in_order = [item["id"] for item in items[:2]]
    assert draft2["id"] in ids_in_order and draft1["id"] in ids_in_order
    assert ids_in_order.index(draft2["id"]) < ids_in_order.index(draft1["id"]), "Newer post should appear first"


def test_cursor_pagination(client: TestClient):
    # Register & login single user
    register_user(client, "c@example.com", "userc")
    token = login_user(client, "userc")

    # Publish several posts
    post_ids = []
    for i in range(5):
        d = create_draft(client, token, f"Cap {i}", f"http://example.com/{i}.jpg")
        publish_post(client, token, d["id"])
        post_ids.append(d["id"])
        time.sleep(0.01)

    # Page 1
    page1 = get_cursor_feed(client, token, None, limit=3)
    assert len(page1["items"]) == 3
    cursor = page1.get("next_cursor")
    assert cursor is not None

    # Page 2 using cursor
    page2 = get_cursor_feed(client, token, cursor, limit=3)
    assert len(page2["items"]) >= 2  # remaining items

    # Verify no overlap
    ids1 = {i["id"] for i in page1["items"]}
    ids2 = {i["id"] for i in page2["items"]}
    assert ids1.isdisjoint(ids2), "Pages should not overlap"


def test_invalid_cursor_returns_400(client: TestClient):
    register_user(client, "d@example.com", "userd")
    token = login_user(client, "userd")
    resp = client.get(f"{API_PREFIX}/content/feed-cursor", params={"cursor": "BAD_CURSOR", "limit": 10}, headers=auth_headers(token))
    assert resp.status_code == 400
