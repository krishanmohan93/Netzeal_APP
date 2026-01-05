"""
Test script for Cloudinary upload endpoint
Run this to verify the Instagram-like upload functionality works
"""
import requests
import json
from PIL import Image
import io

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "kmkbasic"
PASSWORD = "kmkbhai93"

def create_test_image():
    """Create a simple test image in memory"""
    # Create a 400x400 gradient image
    img = Image.new('RGB', (400, 400))
    pixels = img.load()
    
    for i in range(400):
        for j in range(400):
            # Create a gradient from blue to purple
            r = int((i / 400) * 200)
            g = int((j / 400) * 100)
            b = 200
            pixels[i, j] = (r, g, b)
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG', quality=95)
    img_bytes.seek(0)
    
    return img_bytes

def test_upload():
    """Test the complete upload flow"""
    
    print("=" * 60)
    print("🧪 TESTING CLOUDINARY UPLOAD ENDPOINT")
    print("=" * 60)
    
    # Step 1: Login
    print("\n1️⃣ Logging in...")
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data=login_data
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return
    
    auth_data = response.json()
    access_token = auth_data['access_token']
    print(f"✅ Login successful! Token: {access_token[:30]}...")
    
    # Step 2: Create test image
    print("\n2️⃣ Creating test image...")
    test_image = create_test_image()
    print("✅ Test image created (400x400 gradient)")
    
    # Step 3: Upload to Cloudinary
    print("\n3️⃣ Uploading to Cloudinary...")
    
    files = {
        'file': ('test_gradient.jpg', test_image, 'image/jpeg')
    }
    
    data = {
        'caption': '🎨 First Instagram post from Netzeal! Testing Cloudinary integration with a beautiful gradient.',
        'tags': 'test,cloudinary,instagram,firstpost'
    }
    
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    
    response = requests.post(
        f"{BASE_URL}/content/upload-post",
        files=files,
        data=data,
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Upload failed: {response.status_code}")
        print(response.text)
        return
    
    post_data = response.json()
    print("✅ Upload successful!")
    print(f"\n📦 Post Data:")
    print(f"   ID: {post_data['id']}")
    print(f"   Caption: {post_data['caption']}")
    print(f"   Media URL: {post_data['media_url']}")
    print(f"   Media Type: {post_data['media_type']}")
    print(f"   Width: {post_data.get('width', 'N/A')}")
    print(f"   Height: {post_data.get('height', 'N/A')}")
    print(f"   Author: @{post_data['author']['username']} ({post_data['author']['full_name']})")
    print(f"   Tags: {post_data.get('tags', [])}")
    print(f"   Created: {post_data['created_at']}")
    
    # Step 4: Fetch feed
    print("\n4️⃣ Fetching feed...")
    
    response = requests.get(
        f"{BASE_URL}/content/feed?skip=0&limit=10",
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Feed fetch failed: {response.status_code}")
        print(response.text)
        return
    
    feed_posts = response.json()
    print(f"✅ Feed fetched successfully!")
    print(f"\n📱 Feed has {len(feed_posts)} posts:")
    
    for idx, post in enumerate(feed_posts, 1):
        print(f"\n   Post {idx}:")
        print(f"   └─ @{post['author']['username']}: {post['caption'][:50]}...")
        print(f"   └─ 💙 {post['likes_count']} likes, 💬 {post['comments_count']} comments")
        print(f"   └─ Media: {post['media_url'][:60]}...")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\n🎉 Your Cloudinary integration is working perfectly!")
    print(f"\n🖼️  View your uploaded image at:\n{post_data['media_url']}")
    print("\n💡 Next steps:")
    print("   1. Check CLOUDINARY_SETUP.md for React Native integration")
    print("   2. Build the Create Post screen with image picker")
    print("   3. Build the Feed screen to display uploaded media")

if __name__ == "__main__":
    try:
        test_upload()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
