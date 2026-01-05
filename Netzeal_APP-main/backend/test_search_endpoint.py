"""
Quick test script to verify search functionality
Run with: python test_search.py
"""
import requests

BASE_URL = "http://localhost:8000/api/v1"

# First, login to get a token
def test_search():
    print("Testing search endpoint...")
    
    # You'll need to replace these with actual credentials
    login_data = {
        "username": "test@example.com",  # Replace with your email
        "password": "your_password"       # Replace with your password
    }
    
    # Login
    print("\n1. Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data=login_data
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return
    
    token = response.json()["access_token"]
    print(f"✅ Login successful! Token: {token[:20]}...")
    
    # Test search
    print("\n2. Testing search for 'kmkbasic@gmail.com'...")
    headers = {"Authorization": f"Bearer {token}"}
    
    search_response = requests.get(
        f"{BASE_URL}/search/users",
        headers=headers,
        params={"query": "kmkbasic@gmail.com"}
    )
    
    print(f"Status Code: {search_response.status_code}")
    print(f"Response: {search_response.text}")
    
    if search_response.status_code == 200:
        results = search_response.json()
        print(f"\n✅ Found {len(results)} users:")
        for user in results:
            print(f"  - {user['username']} ({user['email'] if 'email' in user else 'no email'})")
    else:
        print(f"❌ Search failed: {search_response.text}")

if __name__ == "__main__":
    test_search()
