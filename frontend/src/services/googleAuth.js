import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { API_CONFIG } from '../config/environment';

let isConfigured = false;

export const configureGoogleSignIn = () => {
  if (isConfigured) {
    return { success: true };
  }

  const { webClientId, androidClientId, expoClientId, iosClientId } = API_CONFIG.GOOGLE_CLIENT_IDS;

  if (!webClientId) {
    return {
      success: false,
      error: 'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    };
  }

  // Native Google Sign-In consumes webClientId/iosClientId. We still validate
  // android/expo IDs because backend OAuth audience checks depend on them.
  if (!androidClientId || !expoClientId) {
    return {
      success: false,
      error: 'Missing EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID or EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID',
    };
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    scopes: ['email', 'profile'],
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });

  isConfigured = true;
  return { success: true };
};

export const signInWithGoogle = async () => {
  const configured = configureGoogleSignIn();
  if (!configured.success) {
    return { success: false, error: configured.error };
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo?.idToken;

    if (!idToken) {
      return {
        success: false,
        error: 'Unable to get Google ID token. Please try again.',
      };
    }

    return { success: true, idToken, userInfo };
  } catch (error) {
    let message = error?.message || 'Google sign-in failed';

    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      message = 'Sign-in cancelled';
    } else if (error?.code === statusCodes.IN_PROGRESS) {
      message = 'Sign-in already in progress';
    } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      message = 'Google Play Services not available or outdated';
    }

    return { success: false, error: message, code: error?.code };
  }
};
