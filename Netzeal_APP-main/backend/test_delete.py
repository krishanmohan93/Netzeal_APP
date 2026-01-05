"""
Test script to verify DELETE endpoint works
Run this from backend directory: python test_delete.py
"""
import requests
import json

BASE_URL = "http://10.215.120.75:8000/api/v1"

def test_delete_post():
    print("🧪 Testing DELETE Post Endpoint\n")
    
    # Step 1: Login
    print("1️⃣ Logging in...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": "kmkbasic",
            "password": "kmkbhai93"
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(login_response.text)
        return
    
    token = login_response.json()["access_token"]
    print(f"✅ Login successful! Token: {token[:20]}...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 2: Get user's posts
    print("\n2️⃣ Fetching feed...")
    feed_response = requests.get(f"{BASE_URL}/content/feed", headers=headers)
    
    if feed_response.status_code != 200:
        print(f"❌ Failed to fetch feed: {feed_response.status_code}")
        return
    
    posts = feed_response.json()
    print(f"✅ Found {len(posts)} posts")
    
    if not posts:
        print("⚠️ No posts to delete. Please create a post first.")
        return
    
    # Find a post by the current user
    user_posts = [p for p in posts if p.get('author_username') == 'kmkbasic']
    
    if not user_posts:
        print("⚠️ No posts by current user. Using first post (may fail if not yours)...")
        test_post = posts[0]
    else:
        test_post = user_posts[0]
    
    post_id = test_post['id']
    print(f"\n3️⃣ Testing DELETE on post ID: {post_id}")
    print(f"   Caption: {test_post.get('caption', 'No caption')[:50]}...")
    
    # Step 3: Delete the post
    delete_response = requests.delete(
        f"{BASE_URL}/content/posts/{post_id}",
        headers=headers
    )
    
    print(f"\n📊 DELETE Response:")
    print(f"   Status Code: {delete_response.status_code}")
    print(f"   Response: {json.dumps(delete_response.json(), indent=2)}")
    
    if delete_response.status_code == 200:
        print("\n✅ DELETE TEST PASSED!")
    else:
        print("\n❌ DELETE TEST FAILED!")
        
    # Step 4: Verify post is deleted
    print(f"\n4️⃣ Verifying post is deleted...")
    verify_response = requests.get(
        f"{BASE_URL}/content/posts/{post_id}",
        headers=headers
    )
    
    if verify_response.status_code == 404:
        print("✅ Verification passed! Post no longer exists.")
    else:
        print(f"⚠️ Post still exists (status: {verify_response.status_code})")

if __name__ == "__main__":
    try:
        test_delete_post()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
