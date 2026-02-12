"""
Qdrant Cloud Connection Validation Script

This script validates the Qdrant Cloud connection and collection setup.
Run this before deploying to ensure everything is configured correctly.

Usage:
    python validate_qdrant_cloud.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def validate_env_vars():
    """Validate required environment variables are set."""
    print("🔍 Validating environment variables...")
    
    required_vars = {
        "QDRANT_URL": os.getenv("QDRANT_URL"),
        "QDRANT_API_KEY": os.getenv("QDRANT_API_KEY"),
        "QDRANT_COLLECTION_NAME": os.getenv("QDRANT_COLLECTION_NAME", "netzeal_posts")
    }
    
    missing_vars = []
    for var_name, var_value in required_vars.items():
        if not var_value or var_value.startswith("your-"):
            missing_vars.append(var_name)
            print(f"   ❌ {var_name}: Not set or using placeholder")
        else:
            # Mask sensitive values
            if "API_KEY" in var_name:
                masked_value = var_value[:8] + "..." + var_value[-4:] if len(var_value) > 12 else "***"
                print(f"   ✅ {var_name}: {masked_value}")
            else:
                print(f"   ✅ {var_name}: {var_value}")
    
    if missing_vars:
        print(f"\n❌ Missing or invalid environment variables: {', '.join(missing_vars)}")
        print("   Please update your .env file with valid Qdrant Cloud credentials.")
        return False
    
    print("✅ All required environment variables are set\n")
    return True


def test_connection():
    """Test connection to Qdrant Cloud."""
    print("🔗 Testing Qdrant Cloud connection...")
    
    try:
        from qdrant_client import QdrantClient
        
        client = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
            timeout=10,
            prefer_grpc=False
        )
        
        # Test connection by fetching collections
        collections = client.get_collections()
        print(f"✅ Successfully connected to Qdrant Cloud!")
        print(f"   Found {len(collections.collections)} collection(s)")
        
        return client
    
    except Exception as e:
        print(f"❌ Failed to connect to Qdrant Cloud: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Verify your QDRANT_URL is correct (should start with https://)")
        print("2. Verify your QDRANT_API_KEY is valid")
        print("3. Check that your Qdrant Cloud cluster is running")
        print("4. Ensure you have network connectivity")
        return None


def check_collection(client):
    """Check if the collection exists and display its configuration."""
    print("\n📦 Checking collection configuration...")
    
    collection_name = os.getenv("QDRANT_COLLECTION_NAME", "netzeal_posts")
    
    try:
        collection_info = client.get_collection(collection_name)
        print(f"✅ Collection '{collection_name}' exists")
        print(f"   Vectors count: {collection_info.points_count}")
        print(f"   Vector configurations:")
        
        for vector_name, config in collection_info.config.params.vectors.items():
            print(f"      - {vector_name}: size={config.size}, distance={config.distance}")
        
        return True
    
    except Exception as e:
        print(f"⚠️  Collection '{collection_name}' does not exist yet")
        print(f"   This is normal for a new setup. The collection will be created automatically.")
        print(f"   You can also create it manually by running: python -m app.scripts.init_qdrant")
        return False


def test_operations(client):
    """Test basic Qdrant operations."""
    print("\n🧪 Testing basic operations...")
    
    collection_name = os.getenv("QDRANT_COLLECTION_NAME", "netzeal_posts")
    
    try:
        # Try to get collection info (read operation)
        try:
            client.get_collection(collection_name)
            print("✅ Read operations: Working")
        except:
            print("⚠️  Read operations: Collection not found (will be created on first use)")
        
        # Note: We don't test write operations here to avoid polluting the database
        print("ℹ️  Write operations: Not tested (to avoid data pollution)")
        print("   Write operations will be tested when the application creates posts")
        
        return True
    
    except Exception as e:
        print(f"❌ Operations test failed: {str(e)}")
        return False


def main():
    """Main validation function."""
    print("=" * 60)
    print("Qdrant Cloud Connection Validation")
    print("=" * 60)
    print()
    
    # Step 1: Validate environment variables
    if not validate_env_vars():
        sys.exit(1)
    
    # Step 2: Test connection
    client = test_connection()
    if not client:
        sys.exit(1)
    
    # Step 3: Check collection
    check_collection(client)
    
    # Step 4: Test operations
    test_operations(client)
    
    print("\n" + "=" * 60)
    print("✅ Validation Complete!")
    print("=" * 60)
    print("\nYour Qdrant Cloud setup is ready to use.")
    print("You can now start your application with: uvicorn app.main:app --reload")
    print()


if __name__ == "__main__":
    main()
