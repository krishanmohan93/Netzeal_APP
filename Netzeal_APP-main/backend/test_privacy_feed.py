"""
Privacy-Locked Feed Verification Test Script
Run this with: python test_privacy_feed.py
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api/v1"

# Test Users
USER_A = {
    "email": "user_a@test.com",
    "username": "user_a",
    "password": "password123",
    "full_name": "User A"
}

USER_B = {
    "email": "user_b@test.com",
    "username": "user_b",
    "password": "password123",
    "full_name": "User B"
}

USER_C = {
    "email": "user_c@test.com",
    "username": "user_c",
    "password": "password123",
    "full_name": "User C"
}

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def register_user(user_data):
    """Register a new user"""
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    if response.status_code == 201:
        print(f"✅ Registered: {user_data['username']}")
        return response.json()
    elif response.status_code == 400 and "already registered" in response.text.lower():
        print(f"ℹ️  User already exists: {user_data['username']}")
        # Login instead
        return login_user(user_data)
    else:
        print(f"❌ Failed to register {user_data['username']}: {response.text}")
        return None

def login_user(user_data):
    """Login user and get token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": user_data["email"],
            "password": user_data["password"]
        }
    )
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Logged in: {user_data['username']}")
        return data
    else:
        print(f"❌ Failed to login {user_data['username']}: {response.text}")
        return None

def search_user(token, query):
    """Search for a user"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/search/users",
        headers=headers,
        params={"query": query}
    )
    if response.status_code == 200:
        users = response.json()
        return users[0] if users else None
    return None

def follow_user(token, target_public_id):
    """Follow a user"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/connect",
        headers=headers,
        json={"target_public_id": target_public_id}
    )
    if response.status_code == 200:
        print(f"✅ Follow successful")
        return True
    else:
        print(f"❌ Follow failed: {response.text}")
        return False

def unfollow_user(token, target_public_id):
    """Unfollow a user"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/connect",
        headers=headers,
        json={"target_public_id": target_public_id}
    )
    if response.status_code == 200:
        print(f"✅ Unfollow successful")
        return True
    else:
        print(f"❌ Unfollow failed: {response.text}")
        return False

def create_post(token, caption):
    """Create a simple post"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/content/posts",
        headers=headers,
        json={
            "title": "Test Post",
            "content": caption,
            "content_type": "post"
        }
    )
    if response.status_code == 201:
        post = response.json()
        print(f"✅ Post created: ID {post['id']}")
        return post
    else:
        print(f"❌ Post creation failed: {response.text}")
        return None

def get_feed(token):
    """Get user's feed"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/content/feed-cursor",
        headers=headers,
        params={"limit": 20}
    )
    if response.status_code == 200:
        data = response.json()
        posts = data.get("items", [])
        print(f"📰 Feed contains {len(posts)} posts")
        return posts
    else:
        print(f"❌ Feed fetch failed: {response.text}")
        return []

def run_test_1():
    """Test 1 – Privacy Lock"""
    print_section("TEST 1: PRIVACY LOCK")
    
    # Step 1: Register users
    print("\n1️⃣  Creating users...")
    auth_a = register_user(USER_A)
    auth_b = register_user(USER_B)
    auth_c = register_user(USER_C)
    
    if not all([auth_a, auth_b, auth_c]):
        print("❌ Failed to create all users")
        return False
    
    token_a = auth_a["access_token"]
    token_b = auth_b["access_token"]
    token_c = auth_c["access_token"]
    
    # Step 2: B follows A
    print("\n2️⃣  B follows A...")
    user_a_info = search_user(token_b, USER_A["username"])
    if not user_a_info:
        print("❌ Could not find User A")
        return False
    
    follow_user(token_b, user_a_info["public_id"])
    
    # Step 3: A creates a post
    print("\n3️⃣  A creates a post...")
    post = create_post(token_a, "Hello from User A!")
    if not post:
        return False
    
    # Step 4: B checks feed (should see post)
    print("\n4️⃣  B checks feed (should SEE post)...")
    feed_b = get_feed(token_b)
    post_visible_to_b = any(p["id"] == post["id"] for p in feed_b)
    
    if post_visible_to_b:
        print("✅ PASS: B can see A's post (B follows A)")
    else:
        print("❌ FAIL: B cannot see A's post")
        return False
    
    # Step 5: C checks feed (should NOT see post)
    print("\n5️⃣  C checks feed (should see NOTHING)...")
    feed_c = get_feed(token_c)
    post_visible_to_c = any(p["id"] == post["id"] for p in feed_c)
    
    if not post_visible_to_c:
        print("✅ PASS: C cannot see A's post (C doesn't follow A)")
    else:
        print("❌ FAIL: C can see A's post (privacy leak!)")
        return False
    
    print("\n✅ TEST 1 PASSED: Privacy lock working correctly!")
    return True

def run_test_2():
    """Test 2 – Disconnect Security"""
    print_section("TEST 2: DISCONNECT SECURITY")
    
    # Use existing users
    print("\n1️⃣  Logging in users...")
    auth_a = login_user(USER_A)
    auth_b = login_user(USER_B)
    
    if not all([auth_a, auth_b]):
        print("❌ Failed to login users")
        return False
    
    token_a = auth_a["access_token"]
    token_b = auth_b["access_token"]
    
    # Step 1: B unfollows A
    print("\n2️⃣  B unfollows A...")
    user_a_info = search_user(token_b, USER_A["username"])
    if not user_a_info:
        print("❌ Could not find User A")
        return False
    
    unfollow_user(token_b, user_a_info["public_id"])
    
    # Step 2: A creates another post
    print("\n3️⃣  A creates a new post...")
    post = create_post(token_a, "Another post from User A!")
    if not post:
        return False
    
    # Step 3: B checks feed (should NOT see new post)
    print("\n4️⃣  B checks feed (should NOT see new post)...")
    feed_b = get_feed(token_b)
    post_visible_to_b = any(p["id"] == post["id"] for p in feed_b)
    
    if not post_visible_to_b:
        print("✅ PASS: B cannot see A's new post (B unfollowed A)")
    else:
        print("❌ FAIL: B can still see A's post (disconnect security failed!)")
        return False
    
    print("\n✅ TEST 2 PASSED: Disconnect security working correctly!")
    return True

if __name__ == "__main__":
    print("\n🔒 PRIVACY-LOCKED FEED VERIFICATION TESTS")
    print("=" * 60)
    
    try:
        # Run Test 1
        test1_passed = run_test_1()
        
        # Run Test 2
        test2_passed = run_test_2()
        
        # Final Results
        print_section("FINAL RESULTS")
        print(f"\nTest 1 (Privacy Lock): {'✅ PASSED' if test1_passed else '❌ FAILED'}")
        print(f"Test 2 (Disconnect Security): {'✅ PASSED' if test2_passed else '❌ FAILED'}")
        
        if test1_passed and test2_passed:
            print("\n🎉 ALL TESTS PASSED!")
            print("Your feed system has Instagram-level privacy controls!")
        else:
            print("\n⚠️  SOME TESTS FAILED")
            print("Please review the implementation.")
            
    except Exception as e:
        print(f"\n❌ Test execution error: {e}")
        import traceback
        traceback.print_exc()
