/**
 * API service for communicating with backend
 * Production-ready with auto-refresh like Instagram, YouTube, Facebook
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_CONFIG } from '../config/environment';
import { Alert } from 'react-native';

// In-memory auth token cache
let authToken = null;
let refreshToken = null;
let isRefreshing = false;
let failedQueue = [];
let sessionExpiredShown = false; // Track if session expired alert is already shown

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

export const setAuthToken = async (token, refresh = null) => {
  authToken = token;
  refreshToken = refresh;

  // Reset session expired flag when setting new token
  if (token) {
    sessionExpiredShown = false;
    await AsyncStorage.setItem('token', token);
  } else {
    await AsyncStorage.removeItem('token');
  }

  if (refresh) {
    await AsyncStorage.setItem('refreshToken', refresh);
  } else {
    await AsyncStorage.removeItem('refreshToken');
  }
};

// Helper to retrieve current access token (used by media upload service)
export const getAuthToken = async () => {
  if (authToken) return authToken;
  authToken = await AsyncStorage.getItem('token');
  return authToken;
};

// Enhanced axios configuration with retry logic
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
  },
});

// Retry logic for failed requests
const retryRequest = async (originalRequest, retryCount = 0) => {
  if (retryCount >= API_CONFIG.RETRY_ATTEMPTS) {
    throw originalRequest;
  }

  console.log(`🔄 Retrying request (${retryCount + 1}/${API_CONFIG.RETRY_ATTEMPTS}):`, originalRequest.config?.url);

  // Wait before retry
  await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));

  try {
    return await api.request(originalRequest.config);
  } catch (error) {
    return retryRequest(error, retryCount + 1);
  }
};

// Development logging (set to false for production-ready app)
const SHOW_API_LOGS = false; // Set to true for debugging
if (__DEV__ && SHOW_API_LOGS) {
  console.log('🔧 Axios Configuration:');
  console.log('  🌐 Base URL:', API_CONFIG.BASE_URL);
  console.log('  ⏱️ Timeout:', API_CONFIG.TIMEOUT + 'ms');
  console.log('  🔄 Retry Logic: Enabled');
}

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      // Prefer in-memory token; fall back to AsyncStorage
      const token = authToken ?? (await AsyncStorage.getItem('token'));
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;

        // Cache for future use
        if (!authToken) {
          authToken = token;
          refreshToken = await AsyncStorage.getItem('refreshToken');
        }
      }
      return config;
    } catch (e) {
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with auto-refresh (Production-ready)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Log all errors temporarily for debugging
    const is401 = error.response?.status === 401;
    const is404 = error.response?.status === 404;

    if (__DEV__) {
      // Comprehensive error logging for development
      console.error('🚨 API Error Analysis:');
      console.error('  📧 Error Message:', error.message);
      console.error('  🌐 Request URL:', error.config?.baseURL + error.config?.url);
      console.error('  📝 Method:', error.config?.method?.toUpperCase());

      if (error.response) {
        console.error('  📊 Response Status:', error.response.status);
        console.error('  📋 Response Data:', JSON.stringify(error.response.data));
        if (is404) {
          console.error('  ⚠️ ENDPOINT NOT FOUND - Check if this endpoint exists in backend');
        }
      } else if (error.request) {
        console.error('  🔍 Error Type: Network Error');
      } else {
        console.error('  🔍 Error Type: Request Setup Error');
      }
    }

    // Try retry for network errors
    if (!error.response && error.config && !error.config.__isRetryRequest) {
      error.config.__isRetryRequest = true;
      try {
        return await retryRequest(error);
      } catch (retryError) {
        console.error('🔴 Retry failed, giving up');
      }
    }

    const originalRequest = error.config;

    // Handle 401 Unauthorized - Try to refresh token first
    if (error.response?.status === 401 && !originalRequest._retry) {

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Try to refresh token
      const storedRefreshToken = refreshToken ?? (await AsyncStorage.getItem('refreshToken'));

      if (storedRefreshToken) {
        try {
          // Call refresh endpoint
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: storedRefreshToken
          });

          const { access_token, refresh_token: new_refresh_token } = response.data;

          // Update tokens
          await setAuthToken(access_token, new_refresh_token);

          // Update Authorization header
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          // Process queued requests
          processQueue(null, access_token);
          isRefreshing = false;

          // Retry original request
          return api(originalRequest);

        } catch (refreshError) {
          // Refresh failed - logout user
          processQueue(refreshError, null);
          isRefreshing = false;

          // Clear auth data
          authToken = null;
          refreshToken = null;
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('refreshToken');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('user_data');

          // Clear secure storage
          try {
            const SecureStore = await import('expo-secure-store');
            await SecureStore.deleteItemAsync('access_token').catch(() => { });
            await SecureStore.deleteItemAsync('refresh_token').catch(() => { });
            await SecureStore.deleteItemAsync('firebaseToken').catch(() => { });
            await SecureStore.deleteItemAsync('userId').catch(() => { });
          } catch (e) {
            console.log('SecureStore cleanup skipped');
          }

          // Show session expired message ONLY ONCE
          if (!sessionExpiredShown) {
            sessionExpiredShown = true;
            Alert.alert(
              'Session Expired',
              'Your session has expired. Please login again to continue.',
              [{ text: 'OK' }],
              { cancelable: false }
            );
          }

          // Don't call reset - let auth context handle navigation
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - logout
        isRefreshing = false;
        authToken = null;
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('user_data');

        // Clear secure storage
        try {
          const SecureStore = await import('expo-secure-store');
          await SecureStore.deleteItemAsync('access_token').catch(() => { });
          await SecureStore.deleteItemAsync('refresh_token').catch(() => { });
        } catch (e) {
          console.log('SecureStore cleanup skipped');
        }

        // Show session expired message ONLY ONCE
        if (!sessionExpiredShown) {
          sessionExpiredShown = true;
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please login again to continue.',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }

        // Don't call reset - let auth context handle navigation
        return Promise.reject(error);
      }
    }

    // Handle other errors
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    } else if (error.response?.status === 404) {
      // Only log 404 if it's not notifications (expected to not exist yet)
      if (!error.config?.url?.includes('/notifications')) {
        console.error('Resource not found:', error.config.url);
      }
    } else if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      console.error('Network error - check your connection');
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials) => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Store both access token and refresh token
    if (response.data.access_token && response.data.refresh_token) {
      await setAuthToken(response.data.access_token, response.data.refresh_token);
    }

    return response; // Return full response object, not just response.data
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Connectivity testing
  ping: async () => {
    const response = await api.get('/ping');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/auth/me', profileData);
    return response.data;
  },

  getUserProfile: async (userId) => {
    const response = await api.get(`/auth/users/${userId}`);
    return response.data;
  },
};

// Content API
export const contentAPI = {
  // Legacy offset feed (still available)
  getFeedLegacy: async (skip = 0, limit = 20) => {
    const response = await api.get(`/content/feed?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // New cursor-based feed
  getCursorFeed: async (cursor = null, limit = 20) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit);
    const response = await api.get(`/content/feed-cursor?${params.toString()}`);
    return response.data; // { items: [...], next_cursor }
  },

  // Draft creation (after media upload returns a URL)
  createDraft: async ({ caption, media_url, media_type, visibility = 'public' }) => {
    const response = await api.post('/content/posts/draft', {
      caption,
      media_url,
      media_type,
      visibility,
    });
    return response.data; // InstagramFeedPostResponse (published_at null)
  },

  // Publish draft
  publishPost: async (postId) => {
    const response = await api.post(`/content/posts/${postId}/publish`);
    return response.data; // PostPublishResponse
  },

  getPosts: async (skip = 0, limit = 20) => {
    const response = await api.get(`/content/posts?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getPost: async (postId) => {
    const response = await api.get(`/content/posts/${postId}`);
    return response.data;
  },

  createPost: async (postData) => {
    // If postData is FormData (has media), use upload-post endpoint
    if (postData instanceof FormData) {
      const response = await api.post('/content/upload-post', postData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }
    // Otherwise use regular JSON post endpoint
    const response = await api.post('/content/posts', postData);
    return response.data;
  },

  // Carousel multi-media single post upload (new endpoint)
  createCarouselPost: async (formData, onProgress) => {
    if (!(formData instanceof FormData)) {
      throw new Error('createCarouselPost expects FormData');
    }
    const response = await api.post('/content/upload-multi', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress(percent);
        }
      }
    });
    return response.data; // MultiMediaPostOut (includes per media transform_state if provided)
  },

  getMultiFeed: async (skip = 0, limit = 20) => {
    const response = await api.get(`/content/multi-feed?skip=${skip}&limit=${limit}`);
    return response.data; // List<MultiMediaPostOut>
  },

  createMultiplePosts: async (formData) => {
    // Expects FormData with multiple 'files' entries
    if (!(formData instanceof FormData)) {
      throw new Error('createMultiplePosts expects FormData');
    }
    const response = await api.post('/content/upload-posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data; // List<InstagramFeedPostResponse>
  },

  // Update a single media item's transform state (non-destructive re-edit persistence)
  updateMediaTransformState: async (mediaId, transformState) => {
    if (!mediaId) throw new Error('mediaId required');
    const response = await api.patch(`/content/media/${mediaId}/transform-state`, { transform_state: transformState });
    return response.data; // PostMediaOut
  },

  likePost: async (postId) => {
    const response = await api.post(`/content/posts/${postId}/like`);
    return response.data;
  },

  unlikePost: async (postId) => {
    const response = await api.delete(`/content/posts/${postId}/like`);
    return response.data;
  },

  deletePost: async (postId) => {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      const url = `/content/posts/${postId}`;
      console.log('🗑️ Deleting post:', postId);
      console.log('📍 API Base URL:', API_BASE_URL);
      console.log('🔗 Full URL:', `${API_BASE_URL}${url}`);

      const response = await api.delete(url);
      console.log('✅ Delete successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Delete Post Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      });
      throw error;
    }
  },

  // Convenience method: optimistic prepend publish
  publishAndPrepend: async (draftPost, setFeedItems) => {
    try {
      const publishResp = await contentAPI.publishPost(draftPost.id);
      // Add published_at to local object for rendering order at top
      const enriched = { ...draftPost, published_at: publishResp.published_at, media_type: draftPost.media_type || (draftPost.type === 'reel' ? 'video' : 'image') };
      setFeedItems(prev => [enriched, ...prev]);
      return publishResp;
    } catch (e) {
      console.error('Publish failed:', e);
      throw e;
    }
  },

  getUserPosts: async (userId, skip = 0, limit = 50) => {
    const response = await api.get(`/content/users/${userId}/posts?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  bookmarkPost: async (postId) => {
    const response = await api.post(`/content/posts/${postId}/bookmark`);
    return response.data;
  },

  getComments: async (postId, skip = 0, limit = 50) => {
    const response = await api.get(`/content/posts/${postId}/comments?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  createComment: async (postId, content) => {
    const response = await api.post(`/content/posts/${postId}/comments`, {
      post_id: postId,
      content,
    });
    return response.data;
  },
};

// AI API
export const aiAPI = {
  chat: async (message, userContext = null) => {
    const response = await api.post('/ai/chat', {
      message,
      user_context: userContext
    });
    return response.data;
  },

  getContentRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/content?limit=${limit}`);
    return response.data;
  },

  getUserRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/users?limit=${limit}`);
    return response.data;
  },

  getCourseRecommendations: async () => {
    const response = await api.get('/ai/recommendations/courses');
    return response.data;
  },
  getOpportunityRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/opportunities?limit=${limit}`);
    return response.data;
  },

  getTrending: async (limit = 10) => {
    const response = await api.get(`/ai/trending?limit=${limit}`);
    return response.data;
  },

  getAnalytics: async () => {
    const response = await api.get('/ai/analytics');
    return response.data;
  },

  getConversationHistory: async (limit = 20) => {
    const response = await api.get(`/ai/conversations?limit=${limit}`);
    return response.data;
  },

  getUserProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Social API
export const socialAPI = {
  followUser: async (userId) => {
    const response = await api.post(`/social/follow/${userId}`);
    return response.data;
  },

  unfollowUser: async (userId) => {
    const response = await api.delete(`/social/unfollow/${userId}`);
    return response.data;
  },

  getFollowers: async (skip = 0, limit = 50) => {
    const response = await api.get(`/social/followers?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getFollowing: async (skip = 0, limit = 50) => {
    const response = await api.get(`/social/following?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getUserFollowers: async (userId, skip = 0, limit = 50) => {
    const response = await api.get(`/social/users/${userId}/followers?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getUserFollowing: async (userId, skip = 0, limit = 50) => {
    const response = await api.get(`/social/users/${userId}/following?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  checkIfFollowing: async (userId) => {
    const response = await api.get(`/social/is-following/${userId}`);
    return response.data;
  },

  getPublicProfile: async (publicId) => {
    const response = await api.get(`/profile/${publicId}`);
    return response.data;
  },

  getProfileByUsername: async (username) => {
    const response = await api.get(`/profile/username/${username}`);
    return response.data;
  },

  toggleConnection: async (targetPublicId) => {
    const response = await api.post('/connect', { target_public_id: targetPublicId });
    return response.data;
  },
};

// Notifications API
// Notifications API
export const notificationsAPI = {
  list: async (skip = 0, limit = 20) => {
    let s = skip;
    let l = limit;
    if (typeof skip === 'object') {
      s = skip?.skip || 0;
      l = skip?.limit || 20;
    }
    const response = await api.get(`/notifications?skip=${s}&limit=${l}`);
    return response.data;
  },
  markRead: async (id) => {
    const response = await api.post(`/notifications/${id}/read`);
    return response.data;
  },
  delete: async (id) => {
    // Not implemented in backend yet
    return { success: true };
  },
  markAllRead: async () => {
    // Not implemented in backend yet
    return { success: true };
  },
};

// Collaboration (Apply) API
export const collabAPI = {
  apply: async ({ toUserId, topic, message }) => {
    const response = await api.post('/collab/apply', {
      to_user_id: toUserId,
      topic,
      message,
    });
    return response.data;
  },
  incoming: async () => {
    const response = await api.get('/collab/incoming');
    return response.data;
  },
  outgoing: async () => {
    const response = await api.get('/collab/outgoing');
    return response.data;
  },
  updateStatus: async (requestId, status) => {
    const response = await api.post(`/collab/${requestId}/status?status_value=${status}`);
    return response.data;
  },
};

export default api;
