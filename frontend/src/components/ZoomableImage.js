/**
 * ZoomableImage Component
 * Simple zoomable image with pinch-to-zoom using react-native-reanimated
 */
import React, { useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
} from 'react-native-reanimated';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
} from 'react-native-gesture-handler';

const { width: screenWidth } = Dimensions.get('window');

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

// Added onTransform callback to allow parent to capture final crop/zoom state
// and disable distortion issues by clamping translation within bounds.
const ZoomableImage = ({ uri, style, onTransform }) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchRef = useRef();
  const panRef = useRef();
  const doubleTapRef = useRef();

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  const onPinchEvent = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.initialScale = savedScale.value;
    },
    onActive: (event, context) => {
      const newScale = context.initialScale * event.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    },
    onEnd: () => {
      savedScale.value = scale.value;
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
      if (onTransform) {
        onTransform({ scale: savedScale.value, x: savedTranslateX.value, y: savedTranslateY.value });
      }
    },
  });

  const onPanEvent = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = savedTranslateX.value;
      context.startY = savedTranslateY.value;
    },
    onActive: (event, context) => {
      if (scale.value > 1.01) {
        // Clamp translation so image stays roughly in bounds
        const maxTranslate = (scale.value - 1) * (screenWidth / 2);
        const nextX = context.startX + event.translationX;
        const nextY = context.startY + event.translationY;
        translateX.value = Math.max(-maxTranslate, Math.min(maxTranslate, nextX));
        translateY.value = Math.max(-maxTranslate, Math.min(maxTranslate, nextY));
      }
    },
    onEnd: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      if (onTransform) {
        onTransform({ scale: savedScale.value, x: savedTranslateX.value, y: savedTranslateY.value });
      }
    },
  });

  const onDoubleTap = useAnimatedGestureHandler({
    onEnd: () => {
      if (scale.value > MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING_CONFIG);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2, SPRING_CONFIG);
        savedScale.value = 2;
      }
      if (onTransform) {
        onTransform({ scale: savedScale.value, x: savedTranslateX.value, y: savedTranslateY.value });
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <TapGestureHandler
      ref={doubleTapRef}
      onHandlerStateChange={onDoubleTap}
      numberOfTaps={2}
    >
      <Animated.View style={[styles.container, style]}>
        <PanGestureHandler
          ref={panRef}
          onGestureEvent={onPanEvent}
          simultaneousHandlers={[pinchRef]}
        >
          <Animated.View style={styles.container}>
            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={onPinchEvent}
              simultaneousHandlers={[panRef]}
            >
              <Animated.Image
                source={{ uri }}
                style={[styles.image, animatedStyle]}
                resizeMode="contain"
              />
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: '100%',
  },
});

export default ZoomableImage;
