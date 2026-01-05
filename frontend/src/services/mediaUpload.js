/**
 * Media Upload Service with Cloudinary Support
 * Handles: Images, Videos, Voice Notes, Files
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import axios from 'axios';

// Cloudinary configuration
const CLOUDINARY_UPLOAD_PRESET = 'netzeal_chat'; // You need to create this in Cloudinary
const CLOUDINARY_CLOUD_NAME = 'your-cloud-name'; // Replace with your Cloudinary cloud name
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`;

/**
 * Request camera permissions
 */
export const requestCameraPermissions = async () => {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission denied');
    }
  }
};

/**
 * Request media library permissions
 */
export const requestMediaLibraryPermissions = async () => {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission denied');
    }
  }
};

/**
 * Request audio recording permissions
 */
export const requestAudioPermissions = async () => {
  if (Platform.OS !== 'web') {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Audio permission denied');
    }
  }
};

/**
 * Pick image from camera
 */
export const pickImageFromCamera = async () => {
  try {
    await requestCameraPermissions();
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
    return null;
  } catch (error) {
    console.error('Error picking image from camera:', error);
    throw error;
  }
};

/**
 * Pick image from gallery
 */
export const pickImageFromGallery = async () => {
  try {
    await requestMediaLibraryPermissions();
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
    return null;
  } catch (error) {
    console.error('Error picking image from gallery:', error);
    throw error;
  }
};

/**
 * Pick video from gallery
 */
export const pickVideoFromGallery = async () => {
  try {
    await requestMediaLibraryPermissions();
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60, // 60 seconds max
    });

    if (!result.canceled) {
      return result.assets[0];
    }
    return null;
  } catch (error) {
    console.error('Error picking video:', error);
    throw error;
  }
};

/**
 * Pick document/file
 */
export const pickDocument = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.type === 'success') {
      return result;
    }
    return null;
  } catch (error) {
    console.error('Error picking document:', error);
    throw error;
  }
};

/**
 * Record voice note
 */
export const recordVoiceNote = async () => {
  try {
    await requestAudioPermissions();
    
    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Create recording
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    });

    return recording;
  } catch (error) {
    console.error('Error setting up voice recording:', error);
    throw error;
  }
};

/**
 * Upload file to Cloudinary
 */
export const uploadToCloudinary = async (fileUri, resourceType = 'image', onProgress) => {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Prepare form data
    const formData = new FormData();
    formData.append('file', `data:${resourceType}/${fileUri.split('.').pop()};base64,${base64}`);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    // Upload to Cloudinary
    const response = await axios.post(
      `${CLOUDINARY_API_URL}/${resourceType}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress && onProgress(percentCompleted);
        },
      }
    );

    return {
      url: response.data.secure_url,
      public_id: response.data.public_id,
      resource_type: response.data.resource_type,
      format: response.data.format,
      width: response.data.width,
      height: response.data.height,
      duration: response.data.duration,
      size: response.data.bytes,
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Upload image message
 */
export const uploadImageMessage = async (imageUri, onProgress) => {
  try {
    const result = await uploadToCloudinary(imageUri, 'image', onProgress);
    return {
      media_url: result.url,
      media_type: 'IMAGE',
      media_metadata: JSON.stringify({
        width: result.width,
        height: result.height,
        size: result.size,
        format: result.format,
      }),
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Upload video message
 */
export const uploadVideoMessage = async (videoUri, onProgress) => {
  try {
    const result = await uploadToCloudinary(videoUri, 'video', onProgress);
    return {
      media_url: result.url,
      media_type: 'VIDEO',
      media_metadata: JSON.stringify({
        width: result.width,
        height: result.height,
        duration: result.duration,
        size: result.size,
        format: result.format,
      }),
    };
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

/**
 * Upload voice note
 */
export const uploadVoiceNote = async (audioUri, duration, onProgress) => {
  try {
    const result = await uploadToCloudinary(audioUri, 'video', onProgress); // Cloudinary uses 'video' for audio
    return {
      media_url: result.url,
      media_type: 'VOICE',
      media_metadata: JSON.stringify({
        duration,
        size: result.size,
        format: result.format,
      }),
    };
  } catch (error) {
    console.error('Error uploading voice note:', error);
    throw error;
  }
};

/**
 * Upload document/file
 */
export const uploadDocument = async (fileUri, fileName, mimeType, onProgress) => {
  try {
    const result = await uploadToCloudinary(fileUri, 'raw', onProgress);
    return {
      media_url: result.url,
      media_type: 'FILE',
      media_metadata: JSON.stringify({
        file_name: fileName,
        mime_type: mimeType,
        size: result.size,
        format: result.format,
      }),
    };
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

/**
 * Generate thumbnail for video (using Cloudinary transformation)
 */
export const getVideoThumbnail = (videoUrl) => {
  if (!videoUrl) return null;
  
  // Extract public_id from Cloudinary URL
  const matches = videoUrl.match(/\/v\d+\/(.+)\.\w+$/);
  if (!matches) return videoUrl;
  
  const publicId = matches[1];
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/w_400,h_300,c_fill,q_auto/${publicId}.jpg`;
};

/**
 * Compress image before upload
 */
export const compressImage = async (imageUri) => {
  try {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1920 } }], // Max width 1920px
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return manipulatedImage.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return imageUri; // Return original if compression fails
  }
};

/**
 * Get file size in human-readable format
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate file size (max 10MB for free Cloudinary)
 */
export const validateFileSize = (fileSize, maxSize = 10 * 1024 * 1024) => {
  if (fileSize > maxSize) {
    throw new Error(`File size exceeds ${formatFileSize(maxSize)} limit`);
  }
  return true;
};

export default {
  pickImageFromCamera,
  pickImageFromGallery,
  pickVideoFromGallery,
  pickDocument,
  recordVoiceNote,
  uploadImageMessage,
  uploadVideoMessage,
  uploadVoiceNote,
  uploadDocument,
  getVideoThumbnail,
  formatFileSize,
  validateFileSize,
};
