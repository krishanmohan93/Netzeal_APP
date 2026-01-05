import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ZoomableImage from '../components/ZoomableImage';
import ImageEditor from '../components/ImageEditor';
import MediaPickerBottomSheet from '../components/MediaPickerBottomSheet';
import { contentAPI } from '../services/api';
import colors from '../constants/colors';
import spacing from '../constants/spacing';
import { borderRadius } from '../constants/borderRadius';

const MAX_CAPTION = 2000;
const MAX_MEDIA = 10;

const CreatePostScreen = ({ navigation }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingUri, setEditingUri] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleMediaSelected = (selectedAssets) => {
    const normalized = selectedAssets.map((asset) => {
      const isVideo = asset.mediaType === 'video' || asset.uri.endsWith('.mp4');
      const isReel =
        isVideo &&
        asset.height > asset.width &&
        (asset.duration ?? 0) <= 60;

      return {
        uri: asset.uri,
        name: asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mime: isVideo ? 'video/mp4' : 'image/jpeg',
        type: isVideo ? 'video' : 'image',
        isReel,
        width: asset.width,
        height: asset.height,
      };
    });

    setMediaItems((prev) => [...prev, ...normalized].slice(0, MAX_MEDIA));
    if (mediaItems.length === 0) setActiveIndex(0);
    setSheetVisible(false);
  };

  const reorderMedia = (from, to) => {
    setMediaItems((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(from, 1);
      updated.splice(to, 0, movedItem);
      return updated;
    });
  };

  const handleImageEdited = (newUri) => {
    setMediaItems((prev) =>
      prev.map((item, index) =>
        index === activeIndex ? { ...item, uri: newUri } : item
      )
    );
    setEditingUri(null);
    setShowImageEditor(false);
  };

  const renderActiveMedia = () => {
    const activeMedia = mediaItems[activeIndex];
    if (!activeMedia) return null;

    const isVideo = activeMedia.mediaType === 'video' || activeMedia.uri.endsWith('.mp4');

    return isVideo ? (
      <Video
        source={{ uri: activeMedia.uri }}
        style={styles.mediaPreview}
        resizeMode="contain"
        shouldPlay
        isLooping
      />
    ) : (
      <ZoomableImage uri={activeMedia.uri} style={styles.mediaPreview} />
    );
  };

  const handleUpload = async () => {
    setLoading(true);
    try {
      // Upload logic here
      // Update uploadProgress as needed
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {mediaItems.length > 0 ? (
            <>
              {renderActiveMedia()}
              <MediaPickerGrid
                mediaItems={mediaItems}
                onPressItem={setActiveIndex}
                onReorder={reorderMedia}
                onAddItem={() => setSheetVisible(true)}
                activeIndex={activeIndex}
              />
            </>
          ) : (
            <TouchableOpacity
              style={styles.mediaPlaceholder}
              onPress={() => setSheetVisible(true)}
            >
              <Icon name="images-outline" size={64} color={colors.primary} />
              <Text style={styles.mediaPlaceholderText}>
                Tap to select photos / videos
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Caption"
            value={caption}
            onChangeText={setCaption}
            maxLength={MAX_CAPTION}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={location}
            onChangeText={setLocation}
          />

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUpload}
            disabled={loading}
          >
            <Text style={styles.uploadButtonText}>
              {loading ? `Uploading: ${Math.round(uploadProgress * 100)}%` : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showImageEditor && (
        <ImageEditor
          uri={editingUri}
          onClose={() => setShowImageEditor(false)}
          onSave={handleImageEdited}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>
            Uploading: {Math.round(uploadProgress * 100)}%
          </Text>
        </View>
      )}
      <MediaPickerBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onMediaSelected={handleMediaSelected}
        themeColor={colors.primary}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.medium,
  },
  content: {
    flex: 1,
  },
  mediaPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.large,
    marginBottom: spacing.medium,
  },
  input: {
    height: 50,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.medium,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    color: colors.white,
    fontSize: 18,
  },
  mediaPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.large,
    marginBottom: spacing.medium,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  mediaPlaceholderText: {
    marginTop: spacing.small,
    color: colors.placeholder,
    fontSize: 16,
  },
  activeMediaContainer: {
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    marginBottom: spacing.medium,
  },
});

export default CreatePostScreen;