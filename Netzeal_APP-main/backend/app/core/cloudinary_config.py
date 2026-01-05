"""
Cloudinary Configuration for Media Storage
Instagram-like image and video uploads
"""
import cloudinary
import cloudinary.uploader
import cloudinary.api
from .config import settings
from typing import Dict, Any, Optional
import os

# Initialize Cloudinary with credentials
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)


class CloudinaryService:
    """Service for handling Cloudinary uploads"""
    
    @staticmethod
    async def upload_image(
        file_content: bytes,
        filename: str,
        folder: str = "netzeal/posts",
        transformation: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload an image to Cloudinary
        
        Args:
            file_content: Binary content of the file
            filename: Original filename
            folder: Cloudinary folder path
            transformation: Optional transformations (resize, crop, etc.)
            
        Returns:
            Dict with upload result including secure_url, public_id, etc.
        """
        try:
            # Default transformation for Instagram-like posts
            if transformation is None:
                transformation = {
                    'quality': 'auto:best',
                    'fetch_format': 'auto',
                }
            
            result = cloudinary.uploader.upload(
                file_content,
                folder=folder,
                resource_type="image",
                transformation=transformation,
                public_id=None,  # Let Cloudinary generate unique ID
                overwrite=False,
                unique_filename=True,
                use_filename=False,
            )
            
            return {
                'success': True,
                'url': result.get('secure_url'),
                'public_id': result.get('public_id'),
                'format': result.get('format'),
                'width': result.get('width'),
                'height': result.get('height'),
                'resource_type': 'image'
            }
            
        except Exception as e:
            print(f"Cloudinary image upload error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    async def upload_video(
        file_content: bytes,
        filename: str,
        folder: str = "netzeal/videos",
        transformation: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Upload a video to Cloudinary (for Reels/Stories)
        
        Args:
            file_content: Binary content of the video file
            filename: Original filename
            folder: Cloudinary folder path
            transformation: Optional transformations
            
        Returns:
            Dict with upload result
        """
        try:
            # Default transformation for Instagram-like reels
            if transformation is None:
                transformation = {
                    'quality': 'auto:best',
                    'fetch_format': 'auto',
                }
            
            result = cloudinary.uploader.upload(
                file_content,
                folder=folder,
                resource_type="video",
                transformation=transformation,
                public_id=None,
                overwrite=False,
                unique_filename=True,
                use_filename=False,
            )
            
            return {
                'success': True,
                'url': result.get('secure_url'),
                'public_id': result.get('public_id'),
                'format': result.get('format'),
                'width': result.get('width'),
                'height': result.get('height'),
                'duration': result.get('duration'),
                'resource_type': 'video'
            }
            
        except Exception as e:
            print(f"Cloudinary video upload error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    async def upload_raw(
        file_content: bytes,
        filename: str,
        folder: str = "netzeal/docs"
    ) -> Dict[str, Any]:
        """Upload a raw file (e.g., PDF) to Cloudinary.

        Args:
            file_content: Binary content
            filename: Original filename
            folder: Target folder
        Returns:
            Dict with upload result (secure_url, public_id, format)
        """
        try:
            result = cloudinary.uploader.upload(
                file_content,
                folder=folder,
                resource_type="raw",
                public_id=None,
                overwrite=False,
                unique_filename=True,
                use_filename=False,
            )
            return {
                'success': True,
                'url': result.get('secure_url'),
                'public_id': result.get('public_id'),
                'format': result.get('format'),
                'resource_type': 'raw'
            }
        except Exception as e:
            print(f"Cloudinary raw upload error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    async def delete_media(public_id: str, resource_type: str = "image") -> bool:
        """
        Delete media from Cloudinary
        
        Args:
            public_id: Cloudinary public ID of the media
            resource_type: 'image' or 'video'
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type=resource_type
            )
            return result.get('result') == 'ok'
        except Exception as e:
            print(f"Cloudinary delete error: {str(e)}")
            return False
    
    @staticmethod
    def get_thumbnail_url(public_id: str, width: int = 300, height: int = 300) -> str:
        """
        Generate thumbnail URL for an image
        
        Args:
            public_id: Cloudinary public ID
            width: Thumbnail width
            height: Thumbnail height
            
        Returns:
            Thumbnail URL
        """
        try:
            return cloudinary.CloudinaryImage(public_id).build_url(
                width=width,
                height=height,
                crop="fill",
                quality="auto:best",
                fetch_format="auto"
            )
        except Exception as e:
            print(f"Thumbnail generation error: {str(e)}")
            return ""

    @staticmethod
    def build_video_url(
        public_id: str,
        *,
        start_offset: Optional[float] = None,
        duration: Optional[float] = None,
        aspect_ratio: Optional[str] = None,
        overlay_text: Optional[str] = None,
        overlay_text_color: str = "white",
        overlay_text_size: int = 40,
        overlay_gravity: str = "south",
        audio_public_id: Optional[str] = None,
        effects: Optional[Dict[str, Any]] = None,
        format: str = "mp4"
    ) -> str:
        """
        Build a Cloudinary video URL with transformations for reels (trim, crop, overlays, audio)
        """
        try:
            transformation: Dict[str, Any] = {
                'quality': 'auto:best',
                'fetch_format': 'auto'
            }
            # Trimming
            if start_offset is not None:
                transformation['start_offset'] = start_offset
            if duration is not None:
                transformation['duration'] = duration
            # Aspect ratio and crop for vertical reels
            if aspect_ratio:
                transformation['aspect_ratio'] = aspect_ratio
                transformation['crop'] = 'fill'
                transformation['gravity'] = 'auto'
            # Effects / filters
            if effects:
                # Cloudinary supports a variety of effects, pass-through if provided
                transformation.update(effects)
            # Text overlay
            if overlay_text:
                transformation['overlay'] = {
                    'font_family': 'Arial',
                    'font_size': overlay_text_size,
                    'text': overlay_text
                }
                transformation['color'] = overlay_text_color
                transformation['gravity'] = overlay_gravity
            # Audio overlay
            if audio_public_id:
                # Chain transformations: first video adjustments, then audio overlay
                transformation = [
                    transformation,
                    {
                        'overlay': f'audio:{audio_public_id}',
                        'flags': 'layer_apply'
                    }
                ]
            return cloudinary.CloudinaryVideo(public_id).build_url(
                resource_type='video',
                transformation=transformation,
                format=format
            )
        except Exception as e:
            print(f"Build video URL error: {str(e)}")
            return ""

    @staticmethod
    def build_image_url(
        public_id: str,
        *,
        width: Optional[int] = None,
        height: Optional[int] = None,
        crop: Optional[str] = None,
        gravity: Optional[str] = None,
        effects: Optional[Dict[str, Any]] = None,
        format: str = "jpg"
    ) -> str:
        """
        Build a Cloudinary image URL with transformations (crop, filters)
        """
        try:
            transformation: Dict[str, Any] = {
                'quality': 'auto:best',
                'fetch_format': 'auto'
            }
            if width:
                transformation['width'] = width
            if height:
                transformation['height'] = height
            if crop:
                transformation['crop'] = crop
            if gravity:
                transformation['gravity'] = gravity
            if effects:
                transformation.update(effects)
            return cloudinary.CloudinaryImage(public_id).build_url(
                transformation=transformation,
                format=format
            )
        except Exception as e:
            print(f"Build image URL error: {str(e)}")
            return ""


# Export singleton instance
cloudinary_service = CloudinaryService()
