import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Better Auth Context
 * 
 * Uses Neon DB's Better Auth for serverless authentication
 * Handles email/password login, Google OAuth, and session management
 */

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokens, setTokens] = useState(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.162.205.75:8000';
  const AUTH_ENDPOINT = `${API_URL}/auth`;

  // ============================================================================
  // INITIALIZATION - Restore session on app start
  // ============================================================================

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      setLoading(true);
      
      // Try to restore session from secure storage
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const storedRefreshToken = await SecureStore.getItemAsync('refresh_token');
      const storedUser = await AsyncStorage.getItem('user_data');

      if (storedToken && storedUser) {
        setTokens({
          accessToken: storedToken,
          refreshToken: storedRefreshToken,
        });
        setUser(JSON.parse(storedUser));

        // Verify token is still valid
        try {
          const response = await fetch(`${AUTH_ENDPOINT}/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          } else {
            // Token invalid, try to refresh
            await refreshAccessToken(storedRefreshToken);
          }
        } catch (err) {
          console.error('Session verification error:', err);
        }
      }
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // EMAIL + PASSWORD AUTHENTICATION
  // ============================================================================

  const register = async (email, password, name) => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`${AUTH_ENDPOINT}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name: name || email.split('@')[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      // Save tokens and user data
      await SecureStore.setItemAsync('auth_token', data.token);
      if (data.user?.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', data.user.refreshToken);
        setTokens({
          accessToken: data.token,
          refreshToken: data.user.refreshToken,
        });
      }

      const userData = {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.name || name,
        image: data.user?.image,
      };

      setUser(userData);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`${AUTH_ENDPOINT}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Save tokens and user data
      await SecureStore.setItemAsync('auth_token', data.token);
      if (data.user?.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', data.user.refreshToken);
        setTokens({
          accessToken: data.token,
          refreshToken: data.user.refreshToken,
        });
      }

      const userData = {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.name,
        image: data.user?.image,
      };

      setUser(userData);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // GOOGLE OAUTH AUTHENTICATION
  // ============================================================================

  const googleSignIn = async (idToken) => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`${AUTH_ENDPOINT}/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      // Save tokens and user data
      await SecureStore.setItemAsync('auth_token', data.token);
      if (data.user?.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', data.user.refreshToken);
        setTokens({
          accessToken: data.token,
          refreshToken: data.user.refreshToken,
        });
      }

      const userData = {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.name,
        image: data.user?.image,
      };

      setUser(userData);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  const refreshAccessToken = async (refreshToken) => {
    try {
      if (!refreshToken) {
        await logout();
        return false;
      }

      const response = await fetch(`${AUTH_ENDPOINT}/refresh-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        await logout();
        return false;
      }

      const data = await response.json();

      // Save new tokens
      await SecureStore.setItemAsync('auth_token', data.token);
      setTokens({
        accessToken: data.token,
        refreshToken: refreshToken,
      });

      return true;
    } catch (err) {
      console.error('Token refresh error:', err);
      await logout();
      return false;
    }
  };

  // ============================================================================
  // USER PROFILE
  // ============================================================================

  const getUserProfile = async () => {
    try {
      if (!tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${AUTH_ENDPOINT}/profile`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setUser(data.user);
      await AsyncStorage.setItem('user_data', JSON.stringify(data.user));

      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  // ============================================================================
  // PASSWORD RESET
  // ============================================================================

  const forgotPassword = async (email) => {
    try {
      setError(null);

      const response = await fetch(`${AUTH_ENDPOINT}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          redirectUrl: `${API_URL}/reset-password`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reset email');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      setError(null);

      const response = await fetch(`${AUTH_ENDPOINT}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Password reset failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // ============================================================================
  // EMAIL VERIFICATION
  // ============================================================================

  const verifyEmail = async (token) => {
    try {
      setError(null);

      const response = await fetch(`${AUTH_ENDPOINT}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      });

      if (!response.ok) {
        throw new Error('Email verification failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const resendVerificationEmail = async (email) => {
    try {
      setError(null);

      const response = await fetch(`${AUTH_ENDPOINT}/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend verification email');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // ============================================================================
  // LOGOUT
  // ============================================================================

  const logout = async () => {
    try {
      // Call logout endpoint if token exists
      if (tokens?.accessToken) {
        await fetch(`${AUTH_ENDPOINT}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }).catch(() => {
          // Ignore errors during logout
        });
      }

      // Clear local data
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await AsyncStorage.removeItem('user_data');

      setUser(null);
      setTokens(null);
      setError(null);

      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      // Force clear even if error
      setUser(null);
      setTokens(null);
      return { success: true };
    }
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = {
    // State
    user,
    loading,
    error,
    tokens,
    isAuthenticated: !!user,

    // Auth methods
    register,
    login,
    googleSignIn,
    logout,

    // Token management
    refreshAccessToken,

    // User profile
    getUserProfile,

    // Password reset
    forgotPassword,
    resetPassword,

    // Email verification
    verifyEmail,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use auth context
 * 
 * Usage:
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
