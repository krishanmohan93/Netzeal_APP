"""
Pinecone vector database service for similarity search
"""
from pinecone import Pinecone, ServerlessSpec
from typing import List, Dict, Optional
from ..core.config import settings
import json


class PineconeService:
    """Service for vector storage and similarity search using Pinecone"""
    
    def __init__(self):
        """Initialize Pinecone client and index"""
        self.pc = None
        self.index = None
        self.index_name = settings.PINECONE_INDEX_NAME
        self._initialized = False
    
    def _initialize(self):
        """Lazy initialization of Pinecone connection"""
        if self._initialized:
            return
        
        try:
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            # Create index if it doesn't exist
            self._ensure_index_exists()
            
            # Get index
            self.index = self.pc.Index(self.index_name)
            self._initialized = True
        except Exception as e:
            print(f"Warning: Pinecone initialization failed: {e}")
            print("Pinecone features will be disabled")
    
    def _ensure_index_exists(self):
        """Create Pinecone index if it doesn't exist"""
        self._initialize()
        if not self._initialized:
            return
        
        existing_indexes = [index.name for index in self.pc.list_indexes()]
        
        if self.index_name not in existing_indexes:
            self.pc.create_index(
                name=self.index_name,
                dimension=1536,  # text-embedding-3-small dimension
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region=settings.PINECONE_ENVIRONMENT
                )
            )
    
    async def upsert_content_embedding(
        self,
        content_id: int,
        embedding: List[float],
        metadata: Dict
    ) -> bool:
        """
        Store content embedding in Pinecone
        
        Args:
            content_id: Unique content ID
            embedding: Embedding vector
            metadata: Additional metadata (author, type, tags, etc.)
            
        Returns:
            Success status
        """
        self._initialize()
        if not self._initialized:
            return False
        
        try:
            self.index.upsert(
                vectors=[{
                    "id": f"content_{content_id}",
                    "values": embedding,
                    "metadata": metadata
                }]
            )
            return True
        except Exception as e:
            print(f"Error upserting content embedding: {e}")
            return False
    
    async def upsert_user_profile_embedding(
        self,
        user_id: int,
        embedding: List[float],
        metadata: Dict
    ) -> bool:
        """
        Store user profile embedding in Pinecone
        
        Args:
            user_id: Unique user ID
            embedding: Embedding vector
            metadata: User profile metadata
            
        Returns:
            Success status
        """
        self._initialize()
        if not self._initialized:
            return False
        
        try:
            self.index.upsert(
                vectors=[{
                    "id": f"user_{user_id}",
                    "values": embedding,
                    "metadata": metadata
                }]
            )
            return True
        except Exception as e:
            print(f"Error upserting user embedding: {e}")
            return False
    
    async def search_similar_content(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_dict: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search for similar content based on embedding
        
        Args:
            query_embedding: Query vector
            top_k: Number of results to return
            filter_dict: Optional metadata filters
            
        Returns:
            List of similar content items with scores
        """
        self._initialize()
        if not self._initialized:
            return []
        
        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                filter=filter_dict
            )
            
            similar_items = []
            for match in results.matches:
                similar_items.append({
                    "id": match.id,
                    "score": match.score,
                    "metadata": match.metadata
                })
            
            return similar_items
        except Exception as e:
            print(f"Error searching similar content: {e}")
            return []
    
    async def search_similar_users(
        self,
        user_embedding: List[float],
        top_k: int = 10,
        exclude_user_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Search for similar users based on profile embedding
        
        Args:
            user_embedding: User profile embedding
            top_k: Number of results to return
            exclude_user_id: User ID to exclude from results
            
        Returns:
            List of similar users with scores
        """
        self._initialize()
        if not self._initialized:
            return []
        
        try:
            results = self.index.query(
                vector=user_embedding,
                top_k=top_k + 1,  # Extra to account for exclusion
                include_metadata=True
            )
            
            similar_users = []
            for match in results.matches:
                # Exclude the querying user
                if exclude_user_id and match.id == f"user_{exclude_user_id}":
                    continue
                
                if match.id.startswith("user_"):
                    similar_users.append({
                        "id": match.id,
                        "score": match.score,
                        "metadata": match.metadata
                    })
            
            return similar_users[:top_k]
        except Exception as e:
            print(f"Error searching similar users: {e}")
            return []
    
    async def delete_embedding(self, item_id: str) -> bool:
        """
        Delete an embedding from Pinecone
        
        Args:
            item_id: ID of the item to delete
            
        Returns:
            Success status
        """
        self._initialize()
        if not self._initialized:
            return False
        
        try:
            self.index.delete(ids=[item_id])
            return True
        except Exception as e:
            print(f"Error deleting embedding: {e}")
            return False


# Global instance
pinecone_service = PineconeService()
