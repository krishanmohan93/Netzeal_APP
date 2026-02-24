/**
 * Authentication Context - Email + Password + Google OAuth
 * Manages authentication state, tokens, and user data
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../config/environment';
import { setAuthToken, clearAuthTokens } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState({ access: null, refresh: null });
  const [error, setError] = useState(null);

  const getAuthUrls = (path) => {
    const primary = `${API_CONFIG.BASE_URL}${path}`;
    const fallbacks = (API_CONFIG.FALLBACK_URLS || []).map((url) => `${url}${path}`);
    return [...new Set([primary, ...fallbacks])];
  };

  const fetchAuthWithFallback = async (path, options) => {
    const urls = getAuthUrls(path);
    let lastNetworkError = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (err) {
        lastNetworkError = err;
        console.warn(`⚠️ Network failed for ${url}`);
      }
    }

    throw new Error(lastNetworkError?.message || 'Network error. Please check backend connection.');
  };

  const readResponseBody = async (response) => {
    const contentType = response.headers?.get('content-type') || '';
    const text = await response.text();

    if (!text) {
      return { data: null, text: '' };
    }

    if (contentType.includes('application/json')) {
      try {
        return { data: JSON.parse(text), text };
      } catch (err) {
        return { data: null, text };
      }
    }

    try {
      return { data: JSON.parse(text), text };
    } catch (err) {
      return { data: null, text };
    }
  };

  // Initialize auth on app start
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      // Try to restore session from storage
      const savedAccessToken = await SecureStore.getItemAsync('access_token');
      const savedRefreshToken = await SecureStore.getItemAsync('refresh_token');
      const savedUser = await AsyncStorage.getItem('user_data');

      if (savedAccessToken && savedUser) {
        await setAuthToken(savedAccessToken, savedRefreshToken);
        setTokens({
          access: savedAccessToken,
          refresh: savedRefreshToken,
        });
        setUser(JSON.parse(savedUser));
        console.log('✅ Session restored from storage');
      }
    } catch (error) {
      console.error('❌ Failed to restore session:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save tokens and user to secure storage
  const saveSession = async (accessToken, refreshToken, userData) => {
    try {
      await setAuthToken(accessToken, refreshToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setTokens({
        access: accessToken,
        refresh: refreshToken,
      });
      setUser(userData);
      setError(null);
      console.log('✅ Session saved');
    } catch (error) {
      console.error('❌ Failed to save session:', error);
      throw error;
    }
  };

  // Clear session
  const clearSession = async () => {
    try {
      await clearAuthTokens();
      await AsyncStorage.removeItem('user_data');

      setTokens({ access: null, refresh: null });
      setUser(null);
      setError(null);
      console.log('✅ Session cleared');
    } catch (error) {
      console.error('❌ Failed to clear session:', error);
    }
  };

  // Register with email and password
  const register = async (email, username, password, fullName) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchAuthWithFallback(
        '/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            username,
            password,
            full_name: fullName,
          }),
        }
      );

      const { data, text } = await readResponseBody(response);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || text || 'Registration failed');
      }
      if (!data) {
        throw new Error('Invalid server response');
      }
      await saveSession(data.access_token, data.refresh_token, data.user);

      console.log('✅ Registration successful');
      return { success: true, user: data.user };
    } catch (error) {
      const errorMessage = error.message || 'Registration failed';
      setError(errorMessage);
      console.error('❌ Registration error:', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchAuthWithFallback(
        '/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const { data, text } = await readResponseBody(response);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || text || 'Login failed');
      }
      if (!data) {
        throw new Error('Invalid server response');
      }
      await saveSession(data.access_token, data.refresh_token, data.user);

      console.log('✅ Login successful');
      return { success: true, user: data.user };
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      console.error('❌ Login error:', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const googleSignIn = async (idToken) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchAuthWithFallback(
        '/auth/google',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id_token: idToken,
          }),
        }
      );

      const { data, text } = await readResponseBody(response);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || text || 'Google sign-in failed');
      }
      if (!data) {
        throw new Error('Invalid server response');
      }
      await saveSession(data.access_token, data.refresh_token, data.user);

      console.log('✅ Google sign-in successful', {
        isNewUser: data.is_new_user,
      });
      return {
        success: true,
        user: data.user,
        isNewUser: data.is_new_user,
      };
    } catch (error) {
      const errorMessage = error.message || 'Google sign-in failed';
      setError(errorMessage);
      console.error('❌ Google sign-in error:', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Refresh access token
  const refreshAccessToken = async () => {
    if (!tokens.refresh) {
      console.error('❌ No refresh token available');
      return false;
    }

    try {
      const response = await fetchAuthWithFallback(
        '/auth/refresh',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: tokens.refresh,
          }),
        }
      );

      const { data, text } = await readResponseBody(response);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || text || 'Failed to refresh token');
      }
      if (!data) {
        throw new Error('Invalid server response');
      }
      await saveSession(data.access_token, data.refresh_token, data.user);

      console.log('✅ Token refreshed');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      await clearSession();
      return false;
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Call logout endpoint on backend
      if (tokens.access) {
        await fetchAuthWithFallback('/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access}`,
          },
        }).catch(() => {
          // Ignore errors if backend is unreachable
        });
      }

      await clearSession();
      console.log('✅ Logged out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Still clear local session even if backend logout fails
      await clearSession();
      return { success: true };
    }
  };

  const value = {
    user,
    loading,
    tokens,
    error,
    isAuthenticated: user !== null,
    register,
    login,
    googleSignIn,
    refreshAccessToken,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
