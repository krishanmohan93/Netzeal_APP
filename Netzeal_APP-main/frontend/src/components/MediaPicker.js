/**
 * MediaPicker Component
 * Handles image, video, and document selection with clean UI
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

// MediaPicker now supports multi-select for images & videos (gallery) and returns
// either a single normalized media object or an array of them.
// onMediaSelected(mediaOrArray)
const MediaPicker = ({ visible, onClose, onMediaSelected }) => {
  const [requesting, setRequesting] = useState(false);

  // Request permissions
  const requestPermissions = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required.');
        return false;
      }
    }
    return true;
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    try {
      const hasPermission = await requestPermissions('camera');
      if (!hasPermission) return;

      setRequesting(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected({
          type: 'image',
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
        });
        onClose();
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    } finally {
      setRequesting(false);
    }
  };

  // Record video
  const handleRecordVideo = async () => {
    try {
      const hasPermission = await requestPermissions('camera');
      if (!hasPermission) return;

      setRequesting(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60, // 60 seconds for reels
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVertical = asset.height > asset.width;
        const isShort = asset.duration <= 60;
        
        onMediaSelected({
          type: isVertical && isShort ? 'reel' : 'video',
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        });
        onClose();
      }
    } catch (error) {
      console.error('Video error:', error);
      Alert.alert('Error', 'Failed to record video');
    } finally {
      setRequesting(false);
    }
  };

  // Pick image from gallery
  const handlePickImage = async () => {
    try {
      const hasPermission = await requestPermissions('library');
      if (!hasPermission) return;

      setRequesting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets?.length) {
        const mapped = result.assets.map(a => ({
          type: 'image',
          uri: a.uri,
          width: a.width,
          height: a.height,
        }));
        // Return array if multiple, else single
        onMediaSelected(mapped.length === 1 ? mapped[0] : mapped);
        onClose();
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setRequesting(false);
    }
  };

  // Pick video from gallery
  const handlePickVideo = async () => {
    try {
      const hasPermission = await requestPermissions('library');
      if (!hasPermission) return;

      setRequesting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets?.length) {
        const mapped = result.assets.map(asset => {
          const isVertical = asset.height > asset.width;
          const isShort = asset.duration <= 60;
          return {
            type: isVertical && isShort ? 'reel' : 'video',
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            duration: asset.duration,
          };
        });
        onMediaSelected(mapped.length === 1 ? mapped[0] : mapped);
        onClose();
      }
    } catch (error) {
      console.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to pick video');
    } finally {
      setRequesting(false);
    }
  };

  // Pick document (PDF, DOCX, PPT)
  const handlePickDocument = async () => {
    try {
      setRequesting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });

      if (result.type !== 'cancel' && result.uri) {
        onMediaSelected({
          type: 'document',
          uri: result.uri,
          name: result.name,
          size: result.size,
          mimeType: result.mimeType,
        });
        onClose();
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Create Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuContent}>
            {/* Photo Options */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleTakePhoto}
              disabled={requesting}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Icon name="camera" size={24} color="#2196F3" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Take Photo</Text>
                <Text style={styles.menuItemSubtitle}>Use camera to capture photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handlePickImage}
              disabled={requesting}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
                <Icon name="images" size={24} color="#9C27B0" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Choose Photo</Text>
                <Text style={styles.menuItemSubtitle}>Select from gallery</Text>
              </View>
            </TouchableOpacity>

            {/* Video Options */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleRecordVideo}
              disabled={requesting}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#FFEBEE' }]}>
                <Icon name="videocam" size={24} color="#F44336" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Record Video/Reel</Text>
                <Text style={styles.menuItemSubtitle}>Vertical video becomes reel</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handlePickVideo}
              disabled={requesting}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
                <Icon name="film" size={24} color="#FF9800" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Choose Video</Text>
                <Text style={styles.menuItemSubtitle}>Select from gallery</Text>
              </View>
            </TouchableOpacity>

            {/* Document Option */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handlePickDocument}
              disabled={requesting}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Icon name="document-text" size={24} color="#4CAF50" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>Upload Document</Text>
                <Text style={styles.menuItemSubtitle}>PDF, DOCX, PPT files</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  menuContent: {
    paddingTop: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

export default MediaPicker;
