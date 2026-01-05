"""Script to initialize Qdrant collections.
Run manually if autosetup not triggered.

python -m app.scripts.init_qdrant
"""
from app.services.qdrant_service import QdrantService


def main():
    q = QdrantService()
    q.init_posts_collection()
    print("✅ Qdrant 'posts' collection initialized.")

if __name__ == "__main__":
    main()
