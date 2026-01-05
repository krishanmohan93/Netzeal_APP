/**
 * Firebase Configuration
 * Phone Authentication Setup for React Native (Expo)
 */
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth,
  getReactNativePersistence 
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_Vmr54ZaopCGKdWi8G1j5SFuL0XelCSA",
  authDomain: "netzeal-app.firebaseapp.com",
  projectId: "netzeal-app",
  storageBucket: "netzeal-app.firebasestorage.app",
  messagingSenderId: "594830586182",
  appId: "1:594830586182:web:fea61fb11447c01329f547",
  measurementId: "G-QFJKRC12Z2"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with React Native persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If already initialized, get existing instance
  auth = getAuth(app);
}

// Suppress Firebase warnings in development
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0]?.includes?.('ExpoFirebaseCore')) {
      return; // Suppress ExpoFirebaseCore warning
    }
    originalWarn.apply(console, args);
  };
}

export { auth };
export default app;
