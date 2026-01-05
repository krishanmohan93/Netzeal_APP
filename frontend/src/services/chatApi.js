/**
 * Chat and messaging API service
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/environment';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });
        
        const { access_token } = response.data;
        await AsyncStorage.setItem('access_token', access_token);
        
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const chatAPI = {
  /**
   * Create new conversation (direct or group)
   */
  createConversation: async (type, participantIds, title = null) => {
    const response = await apiClient.post('/chat/conversations', {
      type,
      participant_ids: participantIds,
      title
    });
    return response.data;
  },

  /**
   * List user's conversations
   */
  getConversations: async (limit = 20, offset = 0) => {
    const response = await apiClient.get('/chat/conversations', {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * Get conversation details
   */
  getConversation: async (conversationId) => {
    const response = await apiClient.get(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  /**
   * Get messages with cursor pagination
   */
  getMessages: async (conversationId, cursor = null, limit = 50) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const response = await apiClient.get(`/chat/conversations/${conversationId}/messages`, {
      params
    });
    return response.data;
  },

  /**
   * Send message (text or media)
   */
  sendMessage: async (conversationId, data) => {
    const formData = new FormData();
    
    if (data.content) {
      formData.append('content', data.content);
    }
    
    if (data.messageType) {
      formData.append('message_type', data.messageType);
    }
    
    if (data.replyToId) {
      formData.append('reply_to_id', data.replyToId);
    }
    
    if (data.media) {
      formData.append('media', {
        uri: data.media.uri,
        type: data.media.type,
        name: data.media.name || 'upload.jpg'
      });
    }
    
    const response = await apiClient.post(
      `/chat/conversations/${conversationId}/messages`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  },

  /**
   * Edit message content
   */
  editMessage: async (messageId, content) => {
    const response = await apiClient.put(`/chat/messages/${messageId}`, {
      content
    });
    return response.data;
  },

  /**
   * Delete message (soft delete)
   */
  deleteMessage: async (messageId) => {
    const response = await apiClient.delete(`/chat/messages/${messageId}`);
    return response.data;
  },

  /**
   * Mark message as read
   */
  markMessageRead: async (messageId) => {
    const response = await apiClient.post(`/chat/messages/${messageId}/read`);
    return response.data;
  },

  /**
   * Get WebSocket URL for chat
   */
  getChatWebSocketUrl: (userId) => {
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = API_BASE_URL.replace('http://', '').replace('https://', '');
    return `${wsProtocol}://${wsBaseUrl}/chat/ws/${userId}`;
  }
};

export default chatAPI;
