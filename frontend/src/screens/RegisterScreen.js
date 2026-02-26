/**
 * Email + Password Registration Screen
 * Premium, production-ready signup UI
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
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserFacingError } from '../utils/errorMessages';

const RegisterScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, error, clearError } = useAuth();

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

  // Email validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation
  const isValidPassword = (password) => {
    return password.length >= 8;
  };

  const handleRegister = async () => {
    if (loading) return;
    // Validation
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Please enter your full name');
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }

    if (!username.trim() || username.length < 3) {
      Alert.alert('Validation', 'Username must be at least 3 characters');
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert('Validation', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await register(email, username, password, fullName);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Error', getUserFacingError({ message: result.error }, 'Failed to register'));
    } else {
      Alert.alert('Success', 'Account created. Please verify your email before signing in.');
    }
  };

  useEffect(() => {
    if (error) {
      Alert.alert('Error', getUserFacingError({ message: error }, 'Something went wrong.'));
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
            styles.topRow,
            {
              opacity: entry,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={20} color={palette.ink} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.hero,
            {
              opacity: entry,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Build credibility, showcase your work, and connect with top professionals.
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
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={palette.placeholder}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>
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
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="account-circle"
                size={18}
                color={palette.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor={palette.placeholder}
                value={username}
                onChangeText={setUsername}
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
                placeholder="Create a password"
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor={palette.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.showPasswordButton}
              >
                <MaterialIcons
                  name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                  size={18}
                  color={palette.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.requirementsContainer}>
            <MaterialIcons
              name={password.length >= 8 ? 'check-circle' : 'info'}
              size={16}
              color={password.length >= 8 ? '#16A34A' : palette.muted}
            />
            <Text style={styles.requirementText}>Use at least 8 characters.</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={
              loading ||
              !fullName.trim() ||
              !email.trim() ||
              !username.trim() ||
              !password ||
              !confirmPassword
            }
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.legalText}>
          By creating an account you agree to our Terms and acknowledge our Privacy Policy.
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
    top: 140,
    right: -90,
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
    paddingTop: 32,
    paddingBottom: 40,
    flexGrow: 1,
  },
  topRow: {
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.soft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  backText: {
    marginLeft: 6,
    fontSize: 13,
    fontFamily: fonts.heading,
    color: palette.ink,
  },
  hero: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: palette.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.muted,
    lineHeight: 21,
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
  requirementsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: palette.muted,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.heading,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  loginText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: palette.muted,
  },
  loginLink: {
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

export default RegisterScreen;
