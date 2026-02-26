/**
 * Centralized API Configuration
 * Automatically detects the best API URL for different platforms and environments
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Network Configuration
const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || '10.181.184.75';
const API_PORT = '8000';
const EXPLICIT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || null;
const TIMEOUT = 30000; // 30 seconds
const GOOGLE_EXPO_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || null;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || null;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null;

const getExpoHostIp = () => {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== 'string') {
    return null;
  }

  return hostUri.split(':')[0] || null;
};

// Platform-specific API URL detection with fallback options
const getApiUrl = () => {
  if (EXPLICIT_API_BASE_URL) {
    return EXPLICIT_API_BASE_URL;
  }

  // Web development - use localhost
  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}/api/v1`;
  }

  // For React Native - use network IP (works for both emulator and physical devices)
  const expoHostIp = getExpoHostIp();
  return `http://${expoHostIp || LOCAL_IP}:${API_PORT}/api/v1`;
};

// Fallback URLs for connectivity testing
const getFallbackUrls = () => {
  if (EXPLICIT_API_BASE_URL) {
    return [EXPLICIT_API_BASE_URL];
  }

  if (Platform.OS === 'web') {
    return [`http://localhost:${API_PORT}/api/v1`];
  }

  const expoHostIp = getExpoHostIp();
  const candidates = [
    expoHostIp ? `http://${expoHostIp}:${API_PORT}/api/v1` : null,
    `http://${LOCAL_IP}:${API_PORT}/api/v1`,
    `http://10.97.116.75:${API_PORT}/api/v1`,
    `http://10.113.240.75:${API_PORT}/api/v1`,
    `http://10.0.2.2:${API_PORT}/api/v1`,
    `http://localhost:${API_PORT}/api/v1`,
  ].filter(Boolean);

  return [...new Set(candidates)];
};

// API Configuration with fallback support
export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  FALLBACK_URLS: getFallbackUrls(),
  TIMEOUT,
  LOCAL_IP,
  API_PORT,
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  RETRY_ATTEMPTS: 1,
  RETRY_DELAY: 1000
};

// Legacy export for compatibility
export const API_BASE_URL = API_CONFIG.BASE_URL;

// Development logging and diagnostics (optional - comment out for cleaner logs)
const SHOW_CONFIG_LOGS = false; // Set to true for debugging
if (__DEV__ && SHOW_CONFIG_LOGS) {
  // Logs intentionally removed for clean output
}

// Google OAuth diagnostics (dev-only)
if (__DEV__) {
  if (!GOOGLE_WEB_CLIENT_ID) {
    console.warn('⚠️ Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (required for ID token).');
  }
  if (!GOOGLE_EXPO_CLIENT_ID) {
    console.warn('⚠️ Missing EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID (required for Expo Go).');
  }
  if (!GOOGLE_ANDROID_CLIENT_ID) {
    console.warn('⚠️ Missing EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (required for Android standalone builds).');
  }
}

// Alternative configurations (uncomment as needed)
// For Android Emulator: 'http://10.0.2.2:8000/api/v1'
// For iOS Simulator: 'http://localhost:8000/api/v1'

export default {
  API_BASE_URL,
  LOCAL_IP,
  API_PORT,
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
};
