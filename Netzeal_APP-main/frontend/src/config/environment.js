/**
 * Centralized API Configuration
 * Automatically detects the best API URL for different platforms and environments
 */
import { Platform } from 'react-native';

// Network Configuration
const LOCAL_IP = '10.41.182.75'; // Your actual local IP (updated)
const API_PORT = '8000';
const TIMEOUT = 30000; // 30 seconds

// Platform-specific API URL detection with fallback options
const getApiUrl = () => {
  // Web development - use localhost
  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}/api/v1`;
  }

  // For React Native - use network IP (works for both emulator and physical devices)
  return `http://${LOCAL_IP}:${API_PORT}/api/v1`;
};

// Fallback URLs for connectivity testing
const getFallbackUrls = () => {
  if (Platform.OS === 'web') {
    return [`http://localhost:${API_PORT}/api/v1`];
  }

  return [
    `http://${LOCAL_IP}:${API_PORT}/api/v1`,      // Primary: Network IP
    `http://10.0.2.2:${API_PORT}/api/v1`,        // Fallback 1: Android emulator
    `http://localhost:${API_PORT}/api/v1`,       // Fallback 2: Localhost (rare case)
  ];
};

// API Configuration with fallback support
export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  FALLBACK_URLS: getFallbackUrls(),
  TIMEOUT,
  LOCAL_IP,
  API_PORT,
  RETRY_ATTEMPTS: 1,
  RETRY_DELAY: 1000
};

// Legacy export for compatibility
export const API_BASE_URL = API_CONFIG.BASE_URL;

// Development logging and diagnostics (optional - comment out for cleaner logs)
const SHOW_CONFIG_LOGS = false; // Set to true for debugging
if (__DEV__ && SHOW_CONFIG_LOGS) {
  console.log('🌐 API Configuration:');
  console.log('  📍 Base URL:', API_CONFIG.BASE_URL);
  console.log('  📱 Platform:', Platform.OS);
  console.log('  🔧 Dev Mode:', __DEV__);
  console.log('  ⏱️ Timeout:', API_CONFIG.TIMEOUT + 'ms');
  console.log('  🔄 Retry Attempts:', API_CONFIG.RETRY_ATTEMPTS);
  console.log('  🔗 Fallback URLs:', API_CONFIG.FALLBACK_URLS);
  console.log('');
  console.log('🔍 Network Diagnostics:');
  console.log('  1. Ensure backend is running on:', `http://${LOCAL_IP}:${API_PORT}`);
  console.log('  2. Test in browser:', `http://${LOCAL_IP}:${API_PORT}/ping`);
  console.log('  3. Check device is on same WiFi network');
  console.log('  4. Verify no firewall is blocking port', API_PORT);
}

// Alternative configurations (uncomment as needed)
// For Android Emulator: 'http://10.0.2.2:8000/api/v1'
// For iOS Simulator: 'http://localhost:8000/api/v1'

export default {
  API_BASE_URL,
  LOCAL_IP,
  API_PORT,
};
