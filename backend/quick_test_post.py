"""
Quick test script to create a post with Cloudinary upload
This tests the complete flow: Login → Upload Image → View in Feed
"""
import requests
import json
from PIL import Image
import io

BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "kmkbasic"
PASSWORD = "kmkbhai93"

def create_gradient_image(width=800, height=800, colors_rgb=[(100, 150, 255), (255, 100, 150)]):
    """Create a beautiful gradient image"""
    img = Image.new('RGB', (width, height))
    pixels = img.load()
    
    for i in range(width):
        for j in range(height):
            # Create gradient from top-left to bottom-right
            ratio_x = i / width
            ratio_y = j / height
            ratio = (ratio_x + ratio_y) / 2
            
            r = int(colors_rgb[0][0] + (colors_rgb[1][0] - colors_rgb[0][0]) * ratio)
            g = int(colors_rgb[0][1] + (colors_rgb[1][1] - colors_rgb[0][1]) * ratio)
            b = int(colors_rgb[0][2] + (colors_rgb[1][2] - colors_rgb[0][2]) * ratio)
            
            pixels[i, j] = (r, g, b)
    
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG', quality=95)
    img_bytes.seek(0)
    return img_bytes

print("=" * 70)
print("🚀 QUICK POST TEST - Upload to Netzeal")
print("=" * 70)

# Step 1: Login
print("\n📱 Step 1: Logging in as", USERNAME)
response = requests.post(f"{BASE_URL}/auth/login", data={
    "username": USERNAME,
    "password": PASSWORD
})

if response.status_code != 200:
    print(f"❌ Login failed: {response.text}")
    exit(1)

token = response.json()['access_token']
print(f"✅ Logged in! Token: {token[:30]}...")

# Step 2: Create beautiful image
print("\n🎨 Step 2: Creating a beautiful gradient image...")
test_image = create_gradient_image(800, 800, [(75, 123, 236), (255, 87, 51)])
print("✅ Image created (800x800)")

# Step 3: Upload
print("\n📤 Step 3: Uploading to Cloudinary...")
files = {'file': ('netzeal_gradient.jpg', test_image, 'image/jpeg')}
data = {
    'caption': '🎨 Testing Netzeal post creation! Beautiful gradient created with Python. #TestPost #NetZeal #AI',
    'tags': 'test,gradient,netzeal,ai'
}
headers = {'Authorization': f'Bearer {token}'}

response = requests.post(
    f"{BASE_URL}/content/upload-post",
    files=files,
    data=data,
    headers=headers
)

if response.status_code not in [200, 201]:
    print(f"❌ Upload failed ({response.status_code}): {response.text}")
    exit(1)

post = response.json()
print("✅ Post created successfully!")
print(f"\n📦 Post Details:")
print(f"   • ID: {post['id']}")
print(f"   • Caption: {post['caption']}")
print(f"   • Media URL: {post['media_url']}")
print(f"   • Author: @{post.get('author_username', 'N/A')}")

# Step 4: View in feed
print("\n📱 Step 4: Fetching your feed...")
response = requests.get(f"{BASE_URL}/content/feed?limit=5", headers=headers)

if response.status_code != 200:
    print(f"❌ Feed fetch failed: {response.text}")
    exit(1)

feed = response.json()
print(f"✅ Feed loaded! Found {len(feed)} posts:")

for idx, p in enumerate(feed, 1):
    print(f"\n   {idx}. @{p.get('author_username', 'unknown')}: {p['caption'][:60]}...")
    print(f"      💙 {p['likes_count']} likes | 💬 {p['comments_count']} comments")
    print(f"      🖼️  {p['media_url'][:70]}...")

print("\n" + "=" * 70)
print("🎉 SUCCESS! Your post is live!")
print("=" * 70)
print(f"\n🔗 View your image: {post['media_url']}")
print("\n💡 Now check your mobile app:")
print("   1. Pull down to refresh the Home screen")
print("   2. You should see your new post in the feed!")
print("   3. Tap the ➕ button to create more posts")
print("\n🎯 Next: Test from mobile app using Camera/Gallery options!")
