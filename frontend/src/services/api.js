/**
 * API service for communicating with backend
 * Production-ready with auto-refresh like Instagram, YouTube, Facebook
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_CONFIG } from '../config/environment';
import { Alert } from 'react-native';
import { getUserFacingError } from '../utils/errorMessages';

// In-memory auth token cache
let authToken = null;
let refreshToken = null;
let isRefreshing = false;
let failedQueue = [];
let sessionExpiredShown = false; // Track if session expired alert is already shown

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const LEGACY_ACCESS_TOKEN_KEYS = ['token', 'accessToken'];
const LEGACY_REFRESH_TOKEN_KEYS = ['refreshToken'];

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

const safeSecureGet = async (key) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
};

const safeSecureSet = async (key, value) => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    // Ignore SecureStore failures (e.g., web)
  }
};

const safeSecureDelete = async (key) => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    // Ignore SecureStore failures (e.g., web)
  }
};

const safeAsyncGet = async (key) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const safeAsyncSet = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
};

const safeAsyncMultiRemove = async (keys) => {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (e) {
    return false;
  }
};

const readFirstAsyncStorage = async (keys) => {
  for (const key of keys) {
    const value = await safeAsyncGet(key);
    if (value) return value;
  }
  return null;
};

export const setAuthToken = async (token, refresh) => {
  authToken = token ?? null;
  if (typeof refresh !== 'undefined') {
    refreshToken = refresh;
  }

  // Reset session expired flag when setting new token
  if (token) {
    sessionExpiredShown = false;
    await safeSecureSet(ACCESS_TOKEN_KEY, token);
    await safeAsyncSet(ACCESS_TOKEN_KEY, token);
    await safeAsyncSet('token', token);
    await safeAsyncSet('accessToken', token);
  } else {
    await safeSecureDelete(ACCESS_TOKEN_KEY);
    await safeAsyncMultiRemove([ACCESS_TOKEN_KEY, 'token', 'accessToken']);
  }

  if (typeof refresh !== 'undefined') {
    if (refresh) {
      await safeSecureSet(REFRESH_TOKEN_KEY, refresh);
      await safeAsyncSet(REFRESH_TOKEN_KEY, refresh);
      await safeAsyncSet('refreshToken', refresh);
    } else {
      await safeSecureDelete(REFRESH_TOKEN_KEY);
      await safeAsyncMultiRemove([REFRESH_TOKEN_KEY, 'refreshToken']);
    }
  }
};

// Helper to retrieve current access token (used by media upload service)
export const getAuthToken = async () => {
  if (authToken) return authToken;
  const secureToken = await safeSecureGet(ACCESS_TOKEN_KEY);
  authToken = secureToken || await readFirstAsyncStorage([ACCESS_TOKEN_KEY, ...LEGACY_ACCESS_TOKEN_KEYS]);
  if (!refreshToken) {
    refreshToken = await getRefreshToken();
  }
  return authToken;
};

export const getRefreshToken = async () => {
  if (refreshToken) return refreshToken;
  const secureToken = await safeSecureGet(REFRESH_TOKEN_KEY);
  refreshToken = secureToken || await readFirstAsyncStorage([REFRESH_TOKEN_KEY, ...LEGACY_REFRESH_TOKEN_KEYS]);
  return refreshToken;
};

export const clearAuthTokens = async () => {
  authToken = null;
  refreshToken = null;
  await safeSecureDelete(ACCESS_TOKEN_KEY);
  await safeSecureDelete(REFRESH_TOKEN_KEY);
  await safeAsyncMultiRemove([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    'token',
    'accessToken',
    'refreshToken',
  ]);
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
  // Intentionally muted for cleaner development output
}

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      // Prefer in-memory token; fall back to AsyncStorage
      const token = await getAuthToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
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

    if (__DEV__ && false) {
      // Enable temporary diagnostics by changing condition above.
      void is404;
    }

    // Try retry for network errors
    if (!error.response && error.config && !error.config.__isRetryRequest) {
      console.warn('[API_NETWORK_ERROR]', {
        baseURL: API_CONFIG.BASE_URL,
        requestUrl: error.config?.url,
        method: error.config?.method,
        message: error.message,
      });
      error.config.__isRetryRequest = true;
      try {
        return await retryRequest(error);
      } catch (retryError) {
        error.userMessage = getUserFacingError(retryError, 'Request failed. Please try again.');
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
      const storedRefreshToken = await getRefreshToken();

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
          await clearAuthTokens();
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('user_data');

          try {
            await SecureStore.deleteItemAsync('firebaseToken').catch(() => { });
            await SecureStore.deleteItemAsync('userId').catch(() => { });
          } catch (e) {
            // SecureStore cleanup best-effort
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
        await clearAuthTokens();
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('user_data');

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
    if (error.response?.status === 503) {
      const backendMessage = error.response?.data?.detail || error.response?.data?.error?.message;
      error.userMessage = backendMessage || 'This feature is temporarily unavailable. Please try again later.';
    } else {
      error.userMessage = getUserFacingError(error, 'Something went wrong. Please try again.');
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

  changePassword: async (payload) => {
    const response = await api.post('/auth/change-password', payload);
    return response.data;
  },

  uploadProfilePhoto: async (asset) => {
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName || `profile_${Date.now()}.jpg`,
      type: asset.mimeType || asset.type || 'image/jpeg',
    });

    const response = await api.post('/auth/me/profile-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadResume: async (fileAsset) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileAsset.uri,
      name: fileAsset.name || `resume_${Date.now()}.pdf`,
      type: fileAsset.mimeType || 'application/pdf',
    });

    const response = await api.post('/auth/me/resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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

      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      error.userMessage = getUserFacingError(error, 'Could not delete post. Please try again.');
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
      e.userMessage = getUserFacingError(e, 'Could not publish post. Please try again.');
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

  createComment: async (postId, content, parentId = null) => {
    const response = await api.post(`/content/posts/${postId}/comments`, {
      post_id: postId,
      content,
      parent_id: parentId,
    });
    return response.data;
  },

  likeComment: async (commentId) => {
    const response = await api.post(`/content/comments/${commentId}/like`);
    return response.data;
  },

  unlikeComment: async (commentId) => {
    const response = await api.delete(`/content/comments/${commentId}/like`);
    return response.data;
  },
};

// AI API
export const aiAPI = {
  chat: async (message) => {
    const maxAttempts = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await api.post('/ai/chat', { message });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        const isTimeout = error?.code === 'ECONNABORTED';
        const isTransientServer = status === 429 || status === 502 || status === 503 || status === 504;
        const isNetwork = !error?.response;

        if (attempt === maxAttempts || !(isTimeout || isTransientServer || isNetwork)) {
          throw error;
        }

        const backoffMs = Math.min(2000, 500 * (2 ** (attempt - 1)));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  },

  getContentRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/content?limit=${limit}`);
    return response.data;
  },

  getUserRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/users?limit=${limit}`);
    return response.data;
  },

  getProjectRecommendations: async (limit = 10) => {
    const response = await api.get(`/ai/recommendations/projects?limit=${limit}`);
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

  getPublicProfileFull: async (publicId) => {
    const response = await api.get(`/profile/${publicId}/full`);
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

  getSuggestedUsers: async (limit = 20) => {
    const response = await api.get(`/social/suggestions?limit=${limit}`);
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
    const response = await api.get(`/notifications/?skip=${s}&limit=${l}`);
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
