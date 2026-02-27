/**
 * Authentication Context - Email + Password + Google OAuth
 * Manages authentication state, tokens, and user data
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';
import { API_CONFIG } from '../config/environment';
import { setAuthToken, clearAuthTokens } from '../services/api';
import { getUserFacingError } from '../utils/errorMessages';

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
      }
    }

    throw new Error(getUserFacingError(lastNetworkError, 'You appear to be offline. Please check your connection.'));
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

  useEffect(() => {
    const processUrl = async (url) => {
      if (!url) {
        return;
      }

      try {
        const query = url.split('?')[1] || '';
        const params = new URLSearchParams(query);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken) {
          return;
        }

        await setAuthToken(accessToken, refreshToken || undefined);
        const profileResponse = await fetchAuthWithFallback('/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const { data, text } = await readResponseBody(profileResponse);
        if (!profileResponse.ok || !data) {
          throw new Error(data?.detail || data?.message || text || 'Failed to complete sign-in');
        }

        const userData = data.user || data;
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        setTokens({ access: accessToken, refresh: refreshToken || null });
        setUser(userData);
        setError(null);
      } catch (err) {
        await clearSession();
        setError(getUserFacingError(err, 'Could not complete sign-in. Please try again.'));
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      processUrl(url);
    });

    Linking.getInitialURL().then((url) => {
      processUrl(url);
    });

    return () => {
      subscription.remove();
    };
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
      }
    } catch (error) {
      setError(getUserFacingError(error, 'Unable to restore your session.'));
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
    } catch (error) {
      setError(getUserFacingError(error, 'Could not save your session. Please try again.'));
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
    } catch (error) {
      setError(getUserFacingError(error, 'Could not clear local session.'));
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

      return { success: true, user: data.user };
    } catch (error) {
      const errorMessage = getUserFacingError(error, 'Registration failed. Please try again.');
      setError(errorMessage);
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

      return { success: true, user: data.user };
    } catch (error) {
      const errorMessage = getUserFacingError(error, 'Login failed. Please try again.');
      setError(errorMessage);
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

      return {
        success: true,
        user: data.user,
        isNewUser: data.is_new_user,
      };
    } catch (error) {
      const errorMessage = getUserFacingError(error, 'Google sign-in failed. Please try again.');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Refresh access token
  const refreshAccessToken = async () => {
    if (!tokens.refresh) {
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

      return true;
    } catch (error) {
      setError(getUserFacingError(error, 'Session expired. Please sign in again.'));
      await clearSession();
      return false;
    }
  };

  // Logout
  const logout = async () => {
    try {
      const accessToken = tokens.access;
      await clearSession();

      if (accessToken) {
        fetchAuthWithFallback('/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }).catch(() => {
          // Ignore errors if backend is unreachable
        });
      }

      return { success: true };
    } catch (error) {
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
