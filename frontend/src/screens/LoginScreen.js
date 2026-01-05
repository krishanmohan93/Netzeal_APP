/**
 * Login Screen
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';

// Control login process logging
const SHOW_LOGIN_LOGS = false; // Set to true for debugging

// Enhanced connectivity testing with fallback URLs
const testConnectivity = async () => {
  const { API_CONFIG } = require('../config/environment');
  
  if (SHOW_LOGIN_LOGS) {
    console.log('🌐 Testing server connectivity...');
    console.log('  📍 Primary URL:', API_CONFIG.BASE_URL);
  }
  
  // Test primary URL first
  try {
    const response = await authAPI.ping();
    if (SHOW_LOGIN_LOGS) {
      console.log('✅ Primary connectivity successful:', {
        url: API_CONFIG.BASE_URL,
        status: response?.status || 'OK'
      });
    }
    return true;
  } catch (primaryError) {
    if (SHOW_LOGIN_LOGS) console.log('⚠️ Primary URL failed, trying fallbacks...');
    
    // Try fallback URLs if available
    if (API_CONFIG.FALLBACK_URLS && API_CONFIG.FALLBACK_URLS.length > 1) {
      for (let i = 1; i < API_CONFIG.FALLBACK_URLS.length; i++) {
        const fallbackUrl = API_CONFIG.FALLBACK_URLS[i];
        if (SHOW_LOGIN_LOGS) console.log(`  🔄 Testing fallback ${i}: ${fallbackUrl}`);
        
        try {
          // Create temporary axios instance for fallback
          const axios = require('axios');
          const testApi = axios.create({ 
            baseURL: fallbackUrl, 
            timeout: 5000 
          });
          
          await testApi.get('/ping');
          
          if (SHOW_LOGIN_LOGS) console.log(`✅ Fallback ${i} successful! Updating base URL...`);
          
          // Update the main API instance to use this URL
          authAPI.defaults.baseURL = fallbackUrl;
          
          return true;
        } catch (fallbackError) {
          if (SHOW_LOGIN_LOGS) console.log(`❌ Fallback ${i} failed:`, fallbackError.message);
        }
      }
    }
    
    if (SHOW_LOGIN_LOGS) {
      console.error('❌ All connectivity tests failed');
      console.error('  Primary error:', primaryError.message);
      console.error('  Suggestion: Check if backend is running on any of these URLs:');
      API_CONFIG.FALLBACK_URLS?.forEach((url, i) => {
        console.error(`    ${i + 1}. ${url}/ping`);
      });
    }
    
    return false;
  }
};

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ username: false, password: false });
  const { setEmailAuth } = useFirebaseAuth();

  const handleLogin = async () => {
    // Clear previous errors
    setError(null);
    setFieldErrors({ username: false, password: false });

    // Input validation
    if (!username?.trim()) {
      setError('Please enter your username or email');
      setFieldErrors({ username: true, password: false });
      return;
    }
    if (!password?.trim()) {
      setError('Please enter your password');
      setFieldErrors({ username: false, password: true });
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setFieldErrors({ username: false, password: true });
      return;
    }

    setLoading(true);
    
    try {
      if (SHOW_LOGIN_LOGS) {
        console.log('🚀 Login Process Started');
        console.log('  👤 Username:', username);
        console.log('  🌐 Testing connectivity...');
      }
      
      // Test server connectivity first
      const isConnected = await testConnectivity();
      if (!isConnected) {
        throw new Error('SERVER_OFFLINE');
      }
      
      if (SHOW_LOGIN_LOGS) {
        console.log('  ✅ Server is reachable');
        console.log('  📡 Attempting login...');
      }
      
      // Attempt login with credentials
      const response = await authAPI.login({ 
        username: username.trim(), 
        password: password.trim() 
      });
      
      // Validate response structure
      if (!response?.data?.access_token || !response?.data?.refresh_token) {
        throw new Error('INVALID_RESPONSE');
      }
      
      const { access_token, refresh_token } = response.data;
      if (SHOW_LOGIN_LOGS) console.log('  🔑 Tokens received successfully');
      
      // Store tokens for authenticated requests
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('refreshToken', refresh_token);
      if (SHOW_LOGIN_LOGS) console.log('  💾 Tokens stored securely');
      
      // Fetch user profile
      if (SHOW_LOGIN_LOGS) console.log('  👤 Fetching user profile...');
      const user = await authAPI.getCurrentUser();
      
      if (!user?.id) {
        throw new Error('USER_PROFILE_FAILED');
      }
      
      if (SHOW_LOGIN_LOGS) console.log('  ✅ Profile loaded:', { id: user.id, username: user.username });
      
      // Complete authentication
      await setEmailAuth(user, access_token, refresh_token);
      if (SHOW_LOGIN_LOGS) console.log('  🎉 Login successful - navigating to app');
      
    } catch (error) {
      console.error('❌ Login Failed:', error.message);
      
      // Enhanced error categorization
      let errorMessage = 'Unable to login. Please try again.';
      let highlightFields = { username: false, password: false };
      
      // Network and connectivity errors
      if (error.message === 'SERVER_OFFLINE' || 
          error.code === 'NETWORK_ERROR' || 
          error.message?.includes('Network Error') ||
          !error.response) {
        errorMessage = '🌐 Cannot reach the server. Please check your internet connection and try again.';
      }
      // Timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = '⏱️ Server is taking too long to respond. Please try again.';
      }
      // Server response errors
      else if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail;
        
        switch (status) {
          case 400:
          case 401:
          case 422:
            errorMessage = '🔒 Incorrect username or password. Please try again.';
            highlightFields = { username: true, password: true };
            break;
          case 403:
            errorMessage = '⚠️ Your account has been deactivated. Please contact support.';
            break;
          case 404:
            errorMessage = '🔍 Login service is temporarily unavailable. Please try again later.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = '⚙️ Server is experiencing technical difficulties. Please try again in a few minutes.';
            break;
          default:
            if (detail) {
              errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
            }
        }
      }
      // Application errors
      else if (error.message === 'INVALID_RESPONSE') {
        errorMessage = '⚠️ Server returned invalid response. Please try again.';
      }
      else if (error.message === 'USER_PROFILE_FAILED') {
        errorMessage = '⚠️ Login successful but failed to load profile. Please restart the app.';
      }
      
      // Show inline error message
      setError(errorMessage);
      setFieldErrors(highlightFields);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>NetZeal</Text>
          <Text style={styles.tagline}>Grow Your Professional Network</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to continue your journey</Text>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username or Email</Text>
            <TextInput
              style={[styles.input, fieldErrors.username && styles.inputError]}
              placeholder="Enter your username or email"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (error) setError(null);
                if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: false });
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordContainer, fieldErrors.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: false });
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Phone Login Option */}
          <TouchableOpacity
            style={styles.phoneLoginButton}
            onPress={() => navigation.navigate('PhoneLogin')}
          >
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={styles.phoneLoginText}>Login with Phone Number</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  form: {
    width: '100%',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  eyeIcon: {
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  phoneLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  phoneLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  link: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  // Error handling styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC3545',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#DC3545',
    borderWidth: 2,
  },
});

export default LoginScreen;
