/**
 * Main App Navigation
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from '../context/AuthContext';
import { FirebaseAuthProvider, useFirebaseAuth } from '../context/FirebaseAuthContext';
import { navigationRef } from '../services/navigationService';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Import navigators and screens
import BottomTabNavigator from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import PhoneLoginScreen from '../screens/PhoneLoginScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import { PostDetailScreen } from '../screens/PlaceholderScreens';
import ProfileDashboardScreen from '../screens/ProfileDashboardScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import SearchScreen from '../screens/SearchScreen';
import ChatScreen from '../screens/ChatScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ManageProjectsScreen from '../screens/ManageProjectsScreen';
// New media creation & live screens
import CameraScreen from '../ui/CameraScreen';
import MediaPickerScreen from '../ui/MediaPickerScreen';
import ImageEditorScreen from '../ui/ImageEditorScreen';
import ReelEditorScreen from '../ui/ReelEditorScreen';
import LiveStreamScreen from '../ui/LiveStreamScreen';

const Stack = createStackNavigator();

// Navigation content component that uses Firebase Auth
const NavigationContent = () => {
  const { isAuthenticated, initializing } = useFirebaseAuth();

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
          <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="Main"
            component={BottomTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ title: 'Post' }}
          />
          <Stack.Screen
            name="ProfileDashboard"
            component={ProfileDashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreatePost"
            component={CreatePostScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: 'Search' }}
          />
          <Stack.Screen
            name="Conversations"
            component={ConversationsScreen}
            options={{ title: 'Messages' }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: 'Chat' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: 'Help & Support' }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ManageProjects"
            component={ManageProjectsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'Camera' }} />
          <Stack.Screen name="MediaPicker" component={MediaPickerScreen} options={{ title: 'Pick Media' }} />
          <Stack.Screen name="ImageEditor" component={ImageEditorScreen} options={{ title: 'Edit Image' }} />
          <Stack.Screen name="ReelEditor" component={ReelEditorScreen} options={{ title: 'Edit Reel' }} />
          <Stack.Screen name="LiveStream" component={LiveStreamScreen} options={{ title: 'Live Stream' }} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

// Main AppNavigator component with Firebase Auth Provider
const AppNavigator = () => {
  return (
    <AuthProvider>
      <FirebaseAuthProvider>
        <NavigationContent />
      </FirebaseAuthProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
  },
});

export default AppNavigator;
