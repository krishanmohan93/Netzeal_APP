/**
 * Production-Ready WebSocket Hook for Real-Time Chat
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong to keep connection alive
 * - Token-based authentication
 * - Background/foreground state handling
 * - Event-based messaging
 * - Connection state management
 * 
 * Usage:
 * const {
 *   isConnected,
 *   sendMessage,
 *   joinRoom,
 *   leaveRoom,
 *   sendTyping,
 *   sendReadReceipt
 * } = useWebSocket({
 *   onMessage: (message) => console.log('New message:', message),
 *   onTyping: (data) => console.log('User typing:', data),
 *   onReadReceipt: (data) => console.log('Message read:', data)
 * });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/environment';

// WebSocket configuration
const WS_CONFIG = {
  // Convert http:// to ws:// and https:// to wss://
  getWebSocketUrl: () => {
    const baseUrl = API_BASE_URL.replace('/api/v1', '');
    const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsUrl}/api/v1/ws/chat`;
  },
  
  // Reconnection settings
  INITIAL_RECONNECT_DELAY: 1000,      // 1 second
  MAX_RECONNECT_DELAY: 30000,         // 30 seconds
  RECONNECT_BACKOFF_MULTIPLIER: 1.5,  // Exponential backoff
  MAX_RECONNECT_ATTEMPTS: 10,         // Give up after 10 attempts
  
  // Heartbeat settings
  PING_INTERVAL: 30000,               // Send ping every 30 seconds
  PONG_TIMEOUT: 10000,                // Expect pong within 10 seconds
  
  // Connection timeouts
  CONNECTION_TIMEOUT: 10000,          // 10 seconds to establish connection
};

export const useWebSocket = ({ 
  onMessage, 
  onTyping, 
  onReadReceipt, 
  onPresenceUpdate,
  onError,
  autoConnect = true 
}) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'reconnecting'
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  
  const reconnectDelayRef = useRef(WS_CONFIG.INITIAL_RECONNECT_DELAY);
  const shouldReconnectRef = useRef(true);
  const messageQueueRef = useRef([]);
  const pendingRoomsRef = useRef(new Set());
  
  /**
   * Get authentication token from secure storage
   */
  const getAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      return token;
    } catch (error) {
      console.error('❌ Failed to get auth token:', error);
      return null;
    }
  };
  
  /**
   * Start heartbeat mechanism to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    // Clear existing intervals
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    // Send PING every 30 seconds
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING' }));
          
          // Set timeout for PONG response
          pongTimeoutRef.current = setTimeout(() => {
            console.warn('⚠️ PONG timeout - reconnecting');
            disconnect();
            connect();
          }, WS_CONFIG.PONG_TIMEOUT);
          
        } catch (error) {
          console.error('❌ Ping error:', error);
        }
      }
    }, WS_CONFIG.PING_INTERVAL);
  }, []);
  
  /**
   * Stop heartbeat mechanism
   */
  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);
  
  /**
   * Process queued messages after reconnection
   */
  const processMessageQueue = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      while (messageQueueRef.current.length > 0) {
        const message = messageQueueRef.current.shift();
        try {
          wsRef.current.send(JSON.stringify(message));
        } catch (error) {
          console.error('❌ Failed to send queued message:', error);
          // Put it back in queue
          messageQueueRef.current.unshift(message);
          break;
        }
      }
    }
  }, []);
  
  /**
   * Rejoin all rooms after reconnection
   */
  const rejoinRooms = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      pendingRoomsRef.current.forEach(roomId => {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'JOIN_ROOM',
            data: { room_id: roomId }
          }));
        } catch (error) {
          console.error('❌ Failed to rejoin room:', roomId, error);
        }
      });
    }
  }, []);
  
  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const { type, data: payload } = data;
      
      switch (type) {
        case 'CONNECTION_SUCCESS':
          console.log('✅ WebSocket connected:', payload.connection_id);
          setIsConnected(true);
          setConnectionState('connected');
          setReconnectAttempts(0);
          reconnectDelayRef.current = WS_CONFIG.INITIAL_RECONNECT_DELAY;
          
          // Clear connection timeout
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          
          // Start heartbeat
          startHeartbeat();
          
          // Process queued messages
          processMessageQueue();
          
          // Rejoin rooms
          rejoinRooms();
          break;
        
        case 'PONG':
          // Clear pong timeout
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }
          break;
        
        case 'NEW_MESSAGE':
          onMessage && onMessage(payload);
          break;
        
        case 'TYPING':
          onTyping && onTyping(payload);
          break;
        
        case 'READ_RECEIPT':
          onReadReceipt && onReadReceipt(payload);
          break;
        
        case 'PRESENCE_UPDATE':
          onPresenceUpdate && onPresenceUpdate(payload);
          break;
        
        case 'MESSAGE_SENT':
          // Message delivery confirmation
          onMessage && onMessage({ ...payload, type: 'MESSAGE_SENT' });
          break;
        
        case 'ROOM_JOINED':
          console.log('📌 Joined room:', payload.room_id);
          break;
        
        case 'ROOM_LEFT':
          console.log('📌 Left room:', payload.room_id);
          pendingRoomsRef.current.delete(payload.room_id);
          break;
        
        case 'ERROR':
          console.error('❌ WebSocket error:', payload.message);
          setLastError(payload.message);
          onError && onError(payload);
          break;
        
        case 'SYNC_RESPONSE':
          // Handle message sync after reconnection
          onMessage && onMessage({ ...payload, type: 'SYNC_RESPONSE' });
          break;
        
        default:
          console.warn('⚠️ Unknown message type:', type);
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }, [onMessage, onTyping, onReadReceipt, onPresenceUpdate, onError, startHeartbeat, processMessageQueue, rejoinRooms]);
  
  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async () => {
    // Don't connect if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    // Check if we should reconnect
    if (!shouldReconnectRef.current) {
      return;
    }
    
    // Check max reconnect attempts
    if (reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnect attempts reached. Giving up.');
      setConnectionState('disconnected');
      setLastError('Max reconnect attempts reached');
      return;
    }
    
    try {
      setConnectionState(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      
      // Get authentication token
      const token = await getAuthToken();
      if (!token) {
        console.error('❌ No auth token available');
        setLastError('Authentication required');
        return;
      }
      
      // Build WebSocket URL with auth token
      const wsUrl = `${WS_CONFIG.getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
      
      console.log(`🔌 Connecting to WebSocket... (Attempt ${reconnectAttempts + 1})`);
      
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('❌ Connection timeout');
          ws.close();
          scheduleReconnect();
        }
      }, WS_CONFIG.CONNECTION_TIMEOUT);
      
      // Event handlers
      ws.onopen = () => {
        console.log('✅ WebSocket connection established');
        // CONNECTION_SUCCESS message will be sent by server
      };
      
      ws.onmessage = handleMessage;
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error.message);
        setLastError(error.message);
        onError && onError({ message: error.message });
      };
      
      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        setConnectionState('disconnected');
        stopHeartbeat();
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        
        // Schedule reconnect if needed
        if (shouldReconnectRef.current && appStateRef.current === 'active') {
          scheduleReconnect();
        }
      };
      
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      setLastError(error.message);
      scheduleReconnect();
    }
  }, [reconnectAttempts, handleMessage, stopHeartbeat, onError]);
  
  /**
   * Schedule reconnection with exponential backoff
   */
  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) {
      return;
    }
    
    // Clear existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      reconnectDelayRef.current * Math.pow(WS_CONFIG.RECONNECT_BACKOFF_MULTIPLIER, reconnectAttempts),
      WS_CONFIG.MAX_RECONNECT_DELAY
    );
    
    console.log(`⏳ Scheduling reconnect in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connect();
    }, delay);
  }, [reconnectAttempts, connect]);
  
  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    // Clear all timeouts and intervals
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    stopHeartbeat();
    
    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Client disconnecting');
      } catch (error) {
        console.error('❌ Error closing WebSocket:', error);
      }
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
  }, [stopHeartbeat]);
  
  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('❌ Error sending message:', error);
        // Queue message for later
        messageQueueRef.current.push(message);
        return false;
      }
    } else {
      // Queue message if not connected
      messageQueueRef.current.push(message);
      console.warn('⚠️ WebSocket not connected. Message queued.');
      return false;
    }
  }, []);
  
  /**
   * Join a conversation room
   */
  const joinRoom = useCallback((roomId) => {
    pendingRoomsRef.current.add(roomId);
    return sendMessage({
      type: 'JOIN_ROOM',
      data: { room_id: roomId }
    });
  }, [sendMessage]);
  
  /**
   * Leave a conversation room
   */
  const leaveRoom = useCallback((roomId) => {
    pendingRoomsRef.current.delete(roomId);
    return sendMessage({
      type: 'LEAVE_ROOM',
      data: { room_id: roomId }
    });
  }, [sendMessage]);
  
  /**
   * Send typing indicator
   */
  const sendTyping = useCallback((roomId, isTyping) => {
    return sendMessage({
      type: 'TYPING',
      data: { room_id: roomId, is_typing: isTyping }
    });
  }, [sendMessage]);
  
  /**
   * Send read receipt
   */
  const sendReadReceipt = useCallback((messageId, conversationId) => {
    return sendMessage({
      type: 'READ_RECEIPT',
      data: { message_id: messageId, conversation_id: conversationId }
    });
  }, [sendMessage]);
  
  /**
   * Request message sync
   */
  const requestSync = useCallback((conversationId, lastMessageId = null) => {
    return sendMessage({
      type: 'REQUEST_SYNC',
      data: { conversation_id: conversationId, last_message_id: lastMessageId }
    });
  }, [sendMessage]);
  
  /**
   * Handle app state changes (foreground/background)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active') {
        // App came to foreground - reconnect if needed
        console.log('📱 App became active - checking WebSocket connection');
        if (!isConnected && shouldReconnectRef.current) {
          setReconnectAttempts(0);
          connect();
        }
      } else if (nextAppState === 'background') {
        // App went to background - keep connection alive but stop aggressive reconnects
        console.log('📱 App went to background');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [isConnected, connect]);
  
  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      shouldReconnectRef.current = true;
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);
  
  return {
    // Connection state
    isConnected,
    connectionState,
    reconnectAttempts,
    lastError,
    
    // Methods
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom,
    sendTyping,
    sendReadReceipt,
    requestSync,
  };
};

export default useWebSocket;
