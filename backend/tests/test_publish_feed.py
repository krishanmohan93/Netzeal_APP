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


def update_profile(client: TestClient, token: str, payload: dict):
    resp = client.put(f"{API_PREFIX}/auth/me", json=payload, headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def create_draft(client: TestClient, token: str, caption: str, media_url: str, media_type: str = "image"):
    resp = client.post(f"{API_PREFIX}/content/posts/draft", json={
        "caption": caption,
        "media_url": media_url,
        "media_type": media_type,
        "visibility": "public"
    }, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_post_with_tags(
    client: TestClient,
    token: str,
    content: str,
    media_url: str,
    tags: list[str],
):
    resp = client.post(
        f"{API_PREFIX}/content/posts",
        json={
            "title": content,
            "content": content,
            "content_type": "post",
            "media_urls": [media_url],
            "tags": tags,
        },
        headers=auth_headers(token),
    )
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


def test_cursor_feed_engagement_can_outrank_small_recency_gap(client: TestClient):
    # Author creates two close-in-time posts and one gets extra engagement.
    register_user(client, "rank-author@example.com", "rankauthor")
    register_user(client, "rank-viewer@example.com", "rankviewer")

    author_token = login_user(client, "rankauthor")
    viewer_token = login_user(client, "rankviewer")

    older = create_draft(
        client,
        author_token,
        "High engagement candidate",
        "http://example.com/engagement.jpg",
    )
    publish_post(client, author_token, older["id"])

    # Keep timestamps close so interest weight can influence ranking.
    time.sleep(0.02)

    newer = create_draft(
        client,
        author_token,
        "Fresh but low engagement",
        "http://example.com/fresh.jpg",
    )
    publish_post(client, author_token, newer["id"])

    like_resp = client.post(
        f"{API_PREFIX}/content/posts/{older['id']}/like",
        headers=auth_headers(viewer_token)
    )
    assert like_resp.status_code == 200, like_resp.text

    feed = get_cursor_feed(client, viewer_token, limit=10)
    ids = [item["id"] for item in feed["items"]]

    assert older["id"] in ids and newer["id"] in ids
    assert ids.index(older["id"]) < ids.index(newer["id"]), (
        "Slightly older post with engagement should outrank a slightly newer low-engagement post"
    )


def test_cursor_feed_interest_tags_can_outrank_small_recency_gap(client: TestClient):
    register_user(client, "rank-interest-author@example.com", "rankinterestauthor")
    register_user(client, "rank-interest-viewer@example.com", "rankinterestviewer")

    author_token = login_user(client, "rankinterestauthor")
    viewer_token = login_user(client, "rankinterestviewer")

    update_profile(client, viewer_token, {"interests": ["python", "ai"]})

    older_interest_post = create_post_with_tags(
        client,
        author_token,
        "Python backend notes",
        "http://example.com/python-interest.jpg",
        ["python", "backend"],
    )

    time.sleep(0.02)

    newer_non_interest_post = create_post_with_tags(
        client,
        author_token,
        "Travel beach update",
        "http://example.com/travel-non-interest.jpg",
        ["travel", "photo"],
    )

    feed = get_cursor_feed(client, viewer_token, limit=10)
    ids = [item["id"] for item in feed["items"]]

    assert older_interest_post["id"] in ids and newer_non_interest_post["id"] in ids
    assert ids.index(older_interest_post["id"]) < ids.index(newer_non_interest_post["id"]), (
        "Interest-tag matched post should outrank a slightly newer non-matching post"
    )
