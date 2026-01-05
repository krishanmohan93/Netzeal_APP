/**
 * useChatWebSocket - Custom hook for managing chat WebSocket connection
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatAPI } from '../services/chatApi';

export const useChatWebSocket = (conversationId, onNewMessage, onTyping, onReadReceipt) => {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    loadUserAndConnect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [conversationId]);

  const loadUserAndConnect = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const { id } = JSON.parse(userData);
        userIdRef.current = id;
        connectWebSocket(id);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  const connectWebSocket = (userId) => {
    try {
      const wsUrl = chatAPI.getChatWebSocketUrl(userId);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Chat WebSocket connected');
        setConnected(true);
        
        // Join conversation room
        if (conversationId) {
          wsRef.current.send(JSON.stringify({
            type: 'JOIN_ROOM',
            data: { conversation_id: conversationId }
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Chat WebSocket error:', error);
        setConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('Chat WebSocket disconnected');
        setConnected(false);
        
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userIdRef.current) {
            connectWebSocket(userIdRef.current);
          }
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect chat WebSocket:', err);
    }
  };

  const handleMessage = (message) => {
    switch (message.type) {
      case 'NEW_MESSAGE':
        if (onNewMessage && message.data.conversation_id === conversationId) {
          onNewMessage(message.data);
        }
        break;

      case 'TYPING':
        if (onTyping && message.data.conversation_id === conversationId) {
          onTyping(message.data);
        }
        break;

      case 'READ_RECEIPT':
        if (onReadReceipt && message.data.conversation_id === conversationId) {
          onReadReceipt(message.data);
        }
        break;

      case 'USER_ONLINE':
      case 'USER_OFFLINE':
        // Can be handled by parent component if needed
        break;
    }
  };

  const sendTyping = useCallback((isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversationId) {
      wsRef.current.send(JSON.stringify({
        type: 'TYPING',
        data: {
          conversation_id: conversationId,
          is_typing: isTyping
        }
      }));
    }
  }, [conversationId]);

  const joinRoom = useCallback((roomId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'JOIN_ROOM',
        data: { conversation_id: roomId }
      }));
    }
  }, []);

  const leaveRoom = useCallback((roomId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'LEAVE_ROOM',
        data: { conversation_id: roomId }
      }));
    }
  }, []);

  return {
    connected,
    sendTyping,
    joinRoom,
    leaveRoom
  };
};

export default useChatWebSocket;
