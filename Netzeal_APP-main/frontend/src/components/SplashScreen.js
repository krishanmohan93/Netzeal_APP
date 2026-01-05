/**
 * Professional Splash Screen with Smooth Animations
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';

const SplashScreen = ({ onFinish }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Simple fade animation only
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Simple fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // Finish splash after 2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);

  const colors = {
    background: isDark ? '#000000' : '#FFFFFF',
    primary: '#D4AF37', // Gold color matching your logo
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#A8A8A8' : '#737373',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Logo Text - Medium Size */}
        <Text style={[styles.logoText, { color: colors.primary }]}>
          NETZEAL
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Grow Your Professional Network
        </Text>
      </Animated.View>

      {/* Simple loading spinner */}
      <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    maxWidth: '80%',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default SplashScreen;
