/**
 * Main App Entry Point - FIXED VERSION
 */
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/components/SplashScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

// Ignore navigation warnings in development
LogBox.ignoreLogs([
  'The action \'GO_BACK\' was not handled by any navigator',
]);

export default function App() {
  const [isReady, setIsReady] = useState(false);

  if (!isReady) {
    return <SplashScreen onFinish={() => setIsReady(true)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
