/**
 * CreatePostScreen - Multi-Media Post Creation
 * Production-grade Instagram-like post creation with carousel support
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, borderRadius } from '../utils/theme';
import MediaPickerGrid from '../components/MediaPickerGrid';
import ZoomableImage from '../components/ZoomableImage';
import ImageEditor from '../components/ImageEditor';
import MediaPickerBottomSheet from '../components/MediaPickerBottomSheet';
import { contentAPI } from '../services/api';

const MAX_CAPTION = 2000;
const MAX_MEDIA = 10;

const CreatePostScreen = ({ navigation }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingUri, setEditingUri] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Request media library permissions
   */
  const requestPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant media library permissions to select photos and videos.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      return false;
    }
  };

  /**
   * Pick media using Expo Image Picker
   * Supports both images and videos
   */
  const pickMedia = async () => {
    try {
      // Check if we've reached the max limit
      if (mediaItems.length >= MAX_MEDIA) {
        Alert.alert('Limit Reached', `You can only select up to ${MAX_MEDIA} items.`);
        return;
      }

      // Request permissions
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Launch image library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Support both images and videos
        allowsMultipleSelection: true,
        quality: 0.9,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        allowsEditing: false,
        aspect: undefined,
        exif: false,
      });

      // Check if user cancelled
      if (result.canceled) {
        return;
      }

      // Process selected assets
      const selectedAssets = result.assets || [];

      if (selectedAssets.length === 0) {
        return;
      }

      // Normalize the assets
      const normalized = selectedAssets.map((asset) => {
        const isVideo = asset.type === 'video' || asset.uri.endsWith('.mp4') || asset.uri.endsWith('.mov');
        const isReel =
          isVideo &&
          asset.height > asset.width &&
          (asset.duration ?? 0) <= 60;

        return {
          uri: asset.uri,
          name: asset.fileName || `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${isVideo ? 'mp4' : 'jpg'}`,
          mime: isVideo ? 'video/mp4' : 'image/jpeg',
          type: isVideo ? 'video' : 'image',
          isReel,
          width: asset.width || 0,
          height: asset.height || 0,
          duration: asset.duration,
        };
      });

      // Add to media items (respect MAX_MEDIA limit)
      setMediaItems((prev) => {
        const combined = [...prev, ...normalized];
        const limited = combined.slice(0, MAX_MEDIA);

        if (combined.length > MAX_MEDIA) {
          Alert.alert(
            'Limit Reached',
            `Only the first ${MAX_MEDIA} items were added.`
          );
        }

        return limited;
      });

      // Set active index if this is the first media
      if (mediaItems.length === 0) {
        setActiveIndex(0);
      }

    } catch (error) {
      console.error('Media picker error:', error);
      Alert.alert(
        'Error',
        'Failed to pick media. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Remove a media item by index
   */
  const removeMedia = (index) => {
    setMediaItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);

      // Adjust active index if needed
      if (activeIndex >= updated.length && updated.length > 0) {
        setActiveIndex(updated.length - 1);
      } else if (updated.length === 0) {
        setActiveIndex(0);
      }

      return updated;
    });
  };

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

  /**
   * Pick PDF document (LinkedIn-style)
   */
  const pickDocument = async () => {
    try {
      // Check if we've reached the max limit
      if (mediaItems.length >= MAX_MEDIA) {
        Alert.alert('Limit Reached', `You can only select up to ${MAX_MEDIA} items.`);
        return;
      }

      // Launch document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      // Check if user cancelled
      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0] || result;

      // Validate file size (max 10MB for PDFs)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        Alert.alert(
          'File Too Large',
          'PDF files must be smaller than 10MB. Please choose a smaller file.'
        );
        return;
      }

      // Add PDF to media items
      const pdfItem = {
        uri: file.uri,
        name: file.name || `document_${Date.now()}.pdf`,
        mime: 'application/pdf',
        type: 'document',
        size: file.size,
        isReel: false,
        width: 0,
        height: 0,
      };

      setMediaItems((prev) => {
        const combined = [...prev, pdfItem];
        const limited = combined.slice(0, MAX_MEDIA);

        if (combined.length > MAX_MEDIA) {
          Alert.alert('Limit Reached', `Only the first ${MAX_MEDIA} items were added.`);
        }

        return limited;
      });

      // Set active index if this is the first media
      if (mediaItems.length === 0) {
        setActiveIndex(0);
      }

      Alert.alert('Success', 'PDF document added successfully!');

    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const reorderMedia = (from, to) => {
    setMediaItems((prev) => {
      const arr = [...prev];
      const temp = arr[from];
      arr.splice(from, 1);
      arr.splice(to, 0, temp);
      return arr;
    });
    setActiveIndex(to);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (!tags.includes(tagInput.trim())) {
      setTags((t) => [...t, tagInput.trim()]);
    }
    setTagInput('');
  };

  const openEditor = (uri) => {
    setEditingUri(uri);
    setShowImageEditor(true);
  };

  const handleImageEdited = (payload) => {
    // payload: { uri, transformState }
    const idx = mediaItems.findIndex((m) => m.uri === editingUri);
    if (idx !== -1) {
      setMediaItems((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], uri: payload.uri, transformState: payload.transformState };
        return updated;
      });
    }
  };

  const postDisabled = !mediaItems.length || loading;

  const submit = async () => {
    if (!mediaItems.length) {
      Alert.alert('No Media', 'Please select at least one image or video');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const hashtags = caption.match(/#\w+/g)?.map((h) => h.replace('#', '')) || [];
      // Build FormData for /content/upload-multi endpoint
      const formData = new FormData();
      mediaItems.forEach((item) => {
        formData.append('files', {
          uri: item.uri,
          name: item.name,
          type: item.mime,
        });
      });
      formData.append('caption', caption.trim());
      if (title.trim()) formData.append('title', title.trim());
      if (tags.length) formData.append('tags', tags.join(','));
      // Order reflects current array order (after any reordering)
      formData.append('order', mediaItems.map((_, idx) => idx).join(','));

      // Transform states aligned to ORIGINAL mediaItems ordering. Older items may lack transformState.
      const transformStates = mediaItems.map(m => m.transformState || null);
      formData.append('transform_states', JSON.stringify(transformStates));

      // Optional: client-side hashtag extraction could be sent separately later
      // For now hashtags can be derived from caption on backend AI layer

      await contentAPI.createCarouselPost(formData, (pct) => setUploadProgress(pct));

      Alert.alert('Success', 'Post created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('Post upload error:', e);
      setErrorMsg('Failed to upload post. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const renderActiveMedia = () => {
    if (!mediaItems.length) return null;
    const item = mediaItems[activeIndex];

    // Handle PDF documents
    if (item.type === 'document') {
      const fileSizeMB = (item.size / (1024 * 1024)).toFixed(2);
      return (
        <View style={styles.activeMediaContainer}>
          <View style={styles.pdfPreview}>
            <Icon name="document-text" size={80} color="#D32F2F" />
            <Text style={styles.pdfName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.pdfSize}>{fileSizeMB} MB</Text>
            <View style={styles.pdfBadge}>
              <Icon name="document" size={14} color="#fff" />
              <Text style={styles.pdfBadgeText}>PDF</Text>
            </View>
          </View>
        </View>
      );
    }

    // Handle images and videos
    return (
      <View style={styles.activeMediaContainer}>
        <ZoomableImage
          uri={item.uri}
          containerW={'100%'}
          containerH={360}
          onError={(msg) => console.warn(msg)}
        />
        {item.isReel && (
          <View style={styles.reelBadge}>
            <Icon name="videocam" size={14} color="#fff" />
            <Text style={styles.reelText}>REEL</Text>
          </View>
        )}
        {item.type === 'image' && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditor(item.uri)}
          >
            <Icon name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Professional Header with Centered Title */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="close" size={28} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Create Post</Text>

        <TouchableOpacity
          disabled={postDisabled}
          onPress={submit}
          style={[styles.postButton, postDisabled && styles.postButtonDisabled]}
        >
          <Text style={styles.postButtonText}>
            {loading ? 'Posting…' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Icon name="warning-outline" size={20} color="#FF6B6B" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Media Picker Area - LinkedIn Style */}
        {!mediaItems.length && (
          <View style={styles.emptyPickerArea}>
            <Icon name="images-outline" size={64} color="#C9A227" />
            <Text style={styles.emptyPickerText}>
              Share photos, videos, or documents
            </Text>
            <Text style={styles.emptyPickerHint}>
              Select up to {MAX_MEDIA} items
            </Text>

            {/* Action Buttons */}
            <View style={styles.pickerButtonsRow}>
              <TouchableOpacity onPress={pickMedia} style={styles.pickerButton}>
                <Icon name="image" size={24} color="#0A66C2" />
                <Text style={styles.pickerButtonText}>Photo/Video</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={pickDocument} style={styles.pickerButton}>
                <Icon name="document-text" size={24} color="#0A66C2" />
                <Text style={styles.pickerButtonText}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active Media Preview */}
        {mediaItems.length > 0 && (
          <>
            {renderActiveMedia()}
            <MediaPickerGrid
              items={mediaItems}
              onRemove={removeMedia}
              onReorder={reorderMedia}
            />

            {/* Add More Options */}
            <View style={styles.addMoreRow}>
              <TouchableOpacity onPress={pickMedia} style={styles.addMoreButton}>
                <Icon name="add-circle" size={20} color="#0A66C2" />
                <Text style={styles.addMoreText}>Add Photo/Video</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={pickDocument} style={styles.addMoreButton}>
                <Icon name="document-attach" size={20} color="#0A66C2" />
                <Text style={styles.addMoreText}>Add Document</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Professional Feature Pills */}
        <View style={styles.featuresRow}>
          {[
            { icon: 'resize', label: 'Auto-resize' },
            { icon: 'videocam', label: 'Reel detector' },
            { icon: 'document', label: 'PDF Support' },
            { icon: 'crop', label: 'Edit' }
          ].map((f, i) => (
            <View key={i} style={styles.featurePill}>
              <Icon name={f.icon} size={14} color="#666" />
              <Text style={styles.featurePillText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Title Input */}
        <TextInput
          placeholder="Add a title (optional)..."
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
          style={styles.titleInput}
        />

        {/* Caption Input */}
        <TextInput
          placeholder="Write a caption..."
          placeholderTextColor="#666"
          value={caption}
          multiline
          onChangeText={(t) => t.length <= MAX_CAPTION && setCaption(t)}
          style={styles.captionInput}
        />
        <Text style={styles.captionCounter}>
          {caption.length}/{MAX_CAPTION}
        </Text>

        {/* Hashtag Preview */}
        {caption.match(/#\w+/g)?.length > 0 && (
          <View style={styles.hashtagPreview}>
            <Icon name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={styles.hashtagText}>
              {caption.match(/#\w+/g).join(' ')}
            </Text>
          </View>
        )}

        {/* Tags Input */}
        <View style={styles.tagsSection}>
          <View style={styles.tagInputRow}>
            <TextInput
              placeholder="Add tags (optional)"
              placeholderTextColor="#666"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              style={styles.tagInput}
            />
            <TouchableOpacity onPress={addTag} style={styles.addTagButton}>
              <Text style={styles.addTagText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tagsContainer}>
            {tags.map((tg, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setTags((t) => t.filter((x) => x !== tg))}
                style={styles.tagChip}
              >
                <Text style={styles.tagChipText}>{tg} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Image Editor Modal */}
      {
        showImageEditor && editingUri && (
          <ImageEditor
            visible={showImageEditor}
            imageUri={editingUri}
            onClose={() => setShowImageEditor(false)}
            onSave={handleImageEdited}
            initialTransformState={mediaItems.find(m => m.uri === editingUri)?.transformState}
          />
        )
      }

      {
        loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Uploading...</Text>
            {uploadProgress > 0 && (
              <View style={styles.progressBarWrap}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                <Text style={styles.progressText}>{uploadProgress}%</Text>
              </View>
            )}
          </View>
        )
      }
    </KeyboardAvoidingView >
  );
};

// Add status-bar aware header sizing
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F2EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_HEIGHT + 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  postButton: {
    backgroundColor: '#0A66C2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#B0B0B0',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFECEF',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 13,
    marginLeft: spacing.xs,
  },
  scrollContent: {
    padding: 16,
  },
  emptyPickerArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyPickerText: {
    marginTop: 16,
    color: '#333333',
    fontSize: 17,
    fontWeight: '500',
  },
  emptyPickerHint: {
    marginTop: 8,
    color: '#666666',
    fontSize: 14,
    marginBottom: 24,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF3F8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#0A66C2',
  },
  pickerButtonText: {
    color: '#0A66C2',
    fontSize: 15,
    fontWeight: '600',
  },
  activeMediaContainer: {
    height: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  reelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 162, 39, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  editButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  addMoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0A66C2',
    gap: 6,
  },
  addMoreText: {
    color: '#0A66C2',
    fontSize: 14,
    fontWeight: '600',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  featurePillText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '500',
  },
  pdfPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  pdfName: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  pdfSize: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
  pdfBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  pdfBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featureCapsule: {
    backgroundColor: '#F4EFE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  featureText: {
    color: '#6A6A6A',
    fontSize: 12,
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#E4DED0',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  captionInput: {
    minHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#E4DED0',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  captionCounter: {
    alignSelf: 'flex-end',
    color: '#8A8A8A',
    fontSize: 11,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  hashtagPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EFE5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  hashtagText: {
    color: colors.primary,
    fontSize: 13,
    marginLeft: spacing.xs,
  },
  tagsSection: {
    marginTop: spacing.md,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#E4DED0',
    fontSize: 15,
  },
  addTagButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addTagText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  tagChip: {
    backgroundColor: '#F0E8D6',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    color: '#6A6A6A',
    fontSize: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    color: '#fff',
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '600'
  },
  progressBarWrap: {
    width: '80%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    marginTop: spacing.md,
    overflow: 'hidden'
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  progressText: {
    position: 'absolute',
    top: -22,
    right: 0,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
});

export default CreatePostScreen;
