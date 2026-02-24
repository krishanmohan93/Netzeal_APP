/**
 * Email + Password Login Screen
 * Premium, production-ready authentication UI
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_CONFIG } from '../config/environment';
import { configureGoogleSignIn, signInWithGoogle } from '../services/googleAuth';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, googleSignIn, error, clearError } = useAuth();

  const entry = useRef(new Animated.Value(0)).current;
  const slideUp = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  useEffect(() => {
    const result = configureGoogleSignIn();
    if (!result.success && __DEV__) {
      console.warn(`⚠️ Google Sign-In disabled: ${result.error}`);
    }
  }, []);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation', 'Please enter email and password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Error', result.error || 'Failed to login');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!API_CONFIG.GOOGLE_WEB_CLIENT_ID) {
        Alert.alert(
          'Google Sign-In Error',
          'Web client ID is missing. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and restart Expo.'
        );
        return;
      }

      setGoogleLoading(true);
      const signInResult = await signInWithGoogle();
      if (!signInResult.success) {
        throw new Error(signInResult.error || 'Failed to sign in with Google');
      }

      const result = await googleSignIn(signInResult.idToken);
      if (!result.success) {
        Alert.alert('Google Sign-In Error', result.error || 'Failed to sign in with Google');
      }
    } catch (error) {
      Alert.alert('Google Sign-In Error', error?.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.backgroundArt} pointerEvents="none">
        <View style={styles.blobTop} />
        <View style={styles.blobMid} />
        <View style={styles.blobBottom} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: entry,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoWrap}>
              <Image source={require('../../Logo_NetZeal.png')} style={styles.logo} />
            </View>
            <View>
              <Text style={styles.brandName}>NetZeal</Text>
              <Text style={styles.brandTagline}>Connect • Create • Grow</Text>
            </View>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to keep your professional network and projects moving.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: entry,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.socialButton, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <>
                <FontAwesome name="google" size={18} color={palette.primary} />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor={palette.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={palette.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showPasswordButton}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={18}
                  color={palette.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>New to NetZeal?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signUpLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.legalText}>
          By continuing you agree to our Terms and acknowledge our Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const palette = {
  background: '#F4F7FB',
  card: '#FFFFFF',
  primary: '#0A66C2',
  primaryDark: '#084B90',
  ink: '#0B1220',
  muted: '#6B7280',
  border: '#E2E8F0',
  soft: '#F8FAFC',
  placeholder: '#9CA3AF',
  accentA: '#DBEAFE',
  accentB: '#FCE7C6',
  accentC: '#DCFCE7',
};

const fonts = {
  heading: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'sans-serif',
    default: 'System',
  }),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  backgroundArt: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: palette.accentA,
    top: -80,
    left: -60,
    opacity: 0.75,
  },
  blobMid: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: palette.accentC,
    top: 120,
    right: -80,
    opacity: 0.55,
  },
  blobBottom: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: palette.accentB,
    bottom: -140,
    right: -80,
    opacity: 0.7,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    flexGrow: 1,
  },
  hero: {
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  logo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  brandName: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: palette.ink,
  },
  brandTagline: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: palette.muted,
    marginTop: 2,
  },
  title: {
    fontSize: 30,
    fontFamily: fonts.heading,
    color: palette.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: palette.muted,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  socialButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.soft,
    gap: 10,
  },
  socialButtonText: {
    fontSize: 15,
    fontFamily: fonts.heading,
    color: palette.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: fonts.body,
    color: palette.muted,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.heading,
    color: palette.ink,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: palette.soft,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: fonts.body,
    color: palette.ink,
  },
  showPasswordButton: {
    padding: 6,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPassword: {
    fontSize: 13,
    fontFamily: fonts.heading,
    color: palette.primary,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.primary,
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.heading,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  signUpText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: palette.muted,
  },
  signUpLink: {
    fontSize: 13,
    fontFamily: fonts.heading,
    color: palette.primaryDark,
  },
  legalText: {
    textAlign: 'center',
    marginTop: 18,
    fontSize: 12,
    fontFamily: fonts.body,
    color: palette.muted,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});

export default LoginScreen;
