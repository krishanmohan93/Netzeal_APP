/**
 * Navigation Service for imperative navigation
 * Allows navigation from outside React components (e.g., API interceptors)
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function reset(routeName) {
  if (navigationRef.isReady()) {
    try {
      navigationRef.reset({
        index: 0,
        routes: [{ name: routeName }],
      });
    } catch (error) {
      // If reset fails, try regular navigation
      console.warn('Navigation reset failed, attempting navigate:', error.message);
      try {
        navigationRef.navigate(routeName);
      } catch (navError) {
        console.warn('Navigation also failed:', navError.message);
      }
    }
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
