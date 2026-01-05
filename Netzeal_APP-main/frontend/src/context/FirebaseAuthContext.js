/**
 * Firebase Phone Auth Context
 * Manages authentication state, auto-login, and secure token storage
 */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FirebaseAuthContext = createContext({});

export const FirebaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid || 'No user');

      if (!mounted) return;

      if (firebaseUser) {
        // User is signed in with Firebase
        try {
          // Get fresh ID token
          const idToken = await firebaseUser.getIdToken();

          // Save to secure storage
          await SecureStore.setItemAsync('firebaseToken', idToken);
          await SecureStore.setItemAsync('userId', firebaseUser.uid);

          if (firebaseUser.phoneNumber) {
            await SecureStore.setItemAsync('phoneNumber', firebaseUser.phoneNumber);
          }

          // Store user data in AsyncStorage for easy access
          const userData = {
            id: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber,
          };
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));

          if (mounted) {
            setUser({
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
            });
            setLoading(false);
            setInitializing(false);
          }
        } catch (error) {
          console.error('Error saving user data:', error);
          if (mounted) {
            setLoading(false);
            setInitializing(false);
          }
        }
      } else {
        // User is signed out - check for stored credentials
        try {
          const storedToken = await SecureStore.getItemAsync('firebaseToken');
          const storedUserId = await SecureStore.getItemAsync('userId');
          const storedUserData = await AsyncStorage.getItem('user_data');

          if (storedToken && storedUserId && storedUserData) {
            // Have stored credentials, restore user session
            console.log('Restoring user session from stored credentials');
            const userData = JSON.parse(storedUserData);
            if (mounted) {
              setUser(userData);
              setLoading(false);
              setInitializing(false);
            }
            return;
          }
        } catch (error) {
          console.error('Error checking stored credentials:', error);
        }

        // No user and no stored credentials - clear everything
        if (mounted) {
          setUser(null);
        }

        // Clear stored tokens
        try {
          await SecureStore.deleteItemAsync('firebaseToken').catch(() => { });
          await SecureStore.deleteItemAsync('userId').catch(() => { });
          await SecureStore.deleteItemAsync('phoneNumber').catch(() => { });
          await AsyncStorage.removeItem('user_data').catch(() => { });
        } catch (error) {
          console.error('Error clearing user data:', error);
        }

        if (mounted) {
          setLoading(false);
          setInitializing(false);
        }
      }
    });

    // Cleanup subscription
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);

      // Clear all stored data
      await SecureStore.deleteItemAsync('firebaseToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('phoneNumber');
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await AsyncStorage.removeItem('user_data');

      // Clear API tokens (in-memory and AsyncStorage)
      const { setAuthToken } = require('../services/api');
      await setAuthToken(null, null);

      console.log('User signed out');
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Get current Firebase ID token
  const getIdToken = async () => {
    try {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
      return null;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  };

  // Refresh token
  const refreshToken = async () => {
    try {
      if (auth.currentUser) {
        const newToken = await auth.currentUser.getIdToken(true); // Force refresh
        await SecureStore.setItemAsync('firebaseToken', newToken);
        return newToken;
      }
      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  };

  // Manual login for email/password (non-Firebase)
  const setEmailAuth = async (userData, accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync('access_token', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refresh_token', refreshToken);
      }
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
      setLoading(false);
      setInitializing(false);
      console.log('Email auth set successfully');
    } catch (error) {
      console.error('Error setting email auth:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    initializing,
    signOut,
    getIdToken,
    refreshToken,
    setEmailAuth,
    isAuthenticated: !!user,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};

// Custom hook to use Firebase Auth
export const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);

  if (context === undefined) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }

  return context;
};

export default FirebaseAuthContext;
