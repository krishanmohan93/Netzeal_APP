/**
 * ImageEditor Component
 * Provides crop, zoom, rotate, and drag functionality
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, borderRadius } from '../utils/theme';
import { computeCropRect, deriveBaseScale } from '../utils/cropMath';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ImageEditor = ({ visible, imageUri, onClose, onSave, initialTransformState }) => {
  const [cropMode, setCropMode] = useState('1:1'); // aspect ratio string: '1:1','4:5','9:16','original','custom'
  const [customRatio, setCustomRatio] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
    // Hydrate from initialTransformState (re-edit scenario)
    useEffect(() => {
      if (initialTransformState && typeof initialTransformState === 'object') {
        try {
          if (initialTransformState.aspectRatio?.label) {
            setCropMode(initialTransformState.aspectRatio.label);
            if (initialTransformState.aspectRatio.label === 'custom' && initialTransformState.aspectRatio.value) {
              const ar = initialTransformState.aspectRatio.value; // numeric value w/h
              // derive approximate integers for display (simple rounding)
              const wGuess = Math.round(ar * 10);
              const hGuess = 10;
              setCustomRatio({ w: wGuess, h: hGuess });
            }
          }
          if (typeof initialTransformState.rotation === 'number') setRotation(initialTransformState.rotation);
          if (typeof initialTransformState.scale === 'number') {
            scale.value = initialTransformState.scale;
            savedScale.value = initialTransformState.scale;
          }
          if (initialTransformState.translation) {
            const { x, y } = initialTransformState.translation;
            if (typeof x === 'number') { translateX.value = x; savedX.value = x; }
            if (typeof y === 'number') { translateY.value = y; savedY.value = y; }
          }
        } catch (e) {
          // Silent fail; fallback to defaults
        }
      }
    }, [initialTransformState]);
  // Reanimated shared values for high-fidelity gestures
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [processing, setProcessing] = useState(false);

  // Gesture handlers
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => { ctx.startScale = savedScale.value; },
    onActive: (event, ctx) => {
      const next = ctx.startScale * event.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    },
    onEnd: () => {
      savedScale.value = scale.value;
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedX.value = 0; savedY.value = 0;
      }
    }
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = savedX.value;
      ctx.startY = savedY.value;
    },
    onActive: (event, ctx) => {
      if (scale.value > 1.01) {
        const cropDims = getCropDimensions();
        const maxTranslateX = (scale.value - 1) * (cropDims.width / 2);
        const maxTranslateY = (scale.value - 1) * (cropDims.height / 2);
        const nextX = ctx.startX + event.translationX;
        const nextY = ctx.startY + event.translationY;
        translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, nextX));
        translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, nextY));
      }
    },
    onEnd: () => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    }
  });

  const getCropDimensions = () => {
    const maxWidth = screenWidth - 40;
    const maxHeight = screenHeight * 0.5;
    let ratioW, ratioH;
    if (cropMode === 'original') {
      // Fallback to near-original aspect while fitting constraints
      ratioW = 4; ratioH = 3; // placeholder if original size not known yet
    } else if (cropMode === 'custom' && customRatio.w > 0 && customRatio.h > 0) {
      ratioW = customRatio.w; ratioH = customRatio.h;
    } else {
      const parts = cropMode.split(':');
      ratioW = parseInt(parts[0] || '1', 10);
      ratioH = parseInt(parts[1] || '1', 10);
    }
    const targetRatio = ratioW / ratioH;
    let widthCandidate = maxWidth;
    let heightCandidate = Math.round(widthCandidate / targetRatio);
    if (heightCandidate > maxHeight) {
      heightCandidate = maxHeight;
      widthCandidate = Math.round(heightCandidate * targetRatio);
    }
    return { width: widthCandidate, height: heightCandidate };
  };

  const handleZoomIn = () => {
    const next = Math.min(savedScale.value + 0.2, MAX_SCALE);
    scale.value = withSpring(next);
    savedScale.value = next;
  };

  const handleZoomOut = () => {
    const next = Math.max(savedScale.value - 0.2, MIN_SCALE);
    scale.value = withSpring(next);
    savedScale.value = next;
    if (next === MIN_SCALE) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedX.value = 0; savedY.value = 0;
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedX.value = 0; savedY.value = 0;
    setRotation(0);
  };

  const handleSave = async () => {
    try {
      setProcessing(true);

      // Apply transformations using ImageManipulator
      const actions = [];

      // Rotate if needed
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }

      // Get original image dimensions via promise wrapper
      const imageInfo = await new Promise((resolve, reject) => {
        Image.getSize(imageUri, (w, h) => resolve({ width: w, height: h }), reject);
      });

      const cropFrame = getCropDimensions();
      const baseScale = deriveBaseScale(imageInfo.width, imageInfo.height, cropFrame.width, cropFrame.height);
      const rect = computeCropRect({
        imageWidth: imageInfo.width,
        imageHeight: imageInfo.height,
        frameWidth: cropFrame.width,
        frameHeight: cropFrame.height,
        baseScale,
        userScale: savedScale.value,
        translateX: savedX.value,
        translateY: savedY.value,
      });
      actions.push({ crop: rect });

      // Apply image manipulations
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      const transformState = {
        version: 1,
        aspectRatio: cropMode === 'custom' ? { label: 'custom', value: customRatio.w / customRatio.h } : { label: cropMode },
        base: { width: imageInfo.width, height: imageInfo.height },
        cropRect: rect,
        scale: savedScale.value,
        baseScale,
        translation: { x: savedX.value, y: savedY.value },
        rotation,
        filters: {},
      };
      onSave({ uri: result.uri, transformState });
      onClose();
    } catch (error) {
      console.error('Image editing error:', error);
      Alert.alert('Error', 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  const cropDims = getCropDimensions();

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      width: cropDims.width * scale.value,
      height: cropDims.height * scale.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ]
    };
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Image</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButton}
            disabled={processing}
          >
            <Text style={styles.doneText}>
              {processing ? 'Processing...' : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview Area */}
        <View style={styles.previewContainer}>
          <View 
            style={[
              styles.cropFrame,
              { width: cropDims.width, height: cropDims.height }
            ]}
          >
            <PinchGestureHandler ref={pinchRef} onGestureEvent={pinchHandler} simultaneousHandlers={[panRef]}>
              <Animated.View style={styles.imageContainer} nativeID="imageEditorContainer">
                <PanGestureHandler ref={panRef} onGestureEvent={panHandler} simultaneousHandlers={[pinchRef]}>
                  <Animated.View style={{ flex: 1 }} nativeID="imageEditorPanContainer">
                    <Animated.Image
                      source={{ uri: imageUri }}
                      style={[animatedImageStyle]}
                      resizeMode="cover"
                    />
                  </Animated.View>
                </PanGestureHandler>
              </Animated.View>
            </PinchGestureHandler>
            
            {/* Crop Overlay */}
            <View style={styles.cropOverlay} pointerEvents="none">
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </View>

          <Text style={styles.dragHint}>Drag to reposition • Pinch to zoom</Text>
        </View>

        {/* Crop Mode Selector */}
        <View style={styles.cropModeContainer}>
          <Text style={styles.sectionLabel}>Aspect Ratio</Text>
          <View style={styles.cropModeButtons}>
            {['1:1','4:5','9:16','original'].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.cropModeButton, cropMode === r && styles.cropModeActive]}
                onPress={() => setCropMode(r)}
              >
                <Text style={[styles.cropModeText, cropMode === r && styles.cropModeTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.cropModeButton, cropMode === 'custom' && styles.cropModeActive]}
              onPress={() => setCropMode('custom')}
            >
              <Text style={[styles.cropModeText, cropMode === 'custom' && styles.cropModeTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {cropMode === 'custom' && (
            <View style={styles.customRatioRow}>
              <TouchableOpacity
                style={styles.customRatioButton}
                onPress={() => setCustomRatio({ w: 3, h: 2 })}
              >
                <Text style={styles.customRatioText}>3:2</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customRatioButton}
                onPress={() => setCustomRatio({ w: 2, h: 3 })}
              >
                <Text style={styles.customRatioText}>2:3</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customRatioButton}
                onPress={() => setCustomRatio({ w: 5, h: 4 })}
              >
                <Text style={styles.customRatioText}>5:4</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Edit Tools */}
        <View style={styles.toolsContainer}>
          <TouchableOpacity style={styles.toolButton} onPress={handleZoomOut}>
            <Icon name="remove-circle-outline" size={28} color={colors.primary} />
            <Text style={styles.toolLabel}>Zoom Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={handleZoomIn}>
            <Icon name="add-circle-outline" size={28} color={colors.primary} />
            <Text style={styles.toolLabel}>Zoom In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={handleRotate}>
            <Icon name="refresh-circle-outline" size={28} color={colors.primary} />
            <Text style={styles.toolLabel}>Rotate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={handleReset}>
            <Icon name="reload-circle-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.toolLabel}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: '#1A1A1A',
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cropFrame: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  dragHint: {
    marginTop: spacing.md,
    fontSize: 13,
    color: '#AAAAAA',
    textAlign: 'center',
  },
  cropModeContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#1A1A1A',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#AAAAAA',
    marginBottom: spacing.sm,
  },
  cropModeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  customRatioRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: spacing.sm,
  },
  customRatioButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  customRatioText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600'
  },
  cropModeButton: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 80,
  },
  cropModeActive: {
    backgroundColor: 'rgba(201, 162, 39, 0.2)',
  },
  cropModeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cropModeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  toolButton: {
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 4,
  },
});

export default ImageEditor;
