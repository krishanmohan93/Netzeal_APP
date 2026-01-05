/**
 * Custom hook for cursor-based feed with WebSocket support
 * Handles loading, infinite scroll, refresh, and real-time updates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { contentAPI } from '../services/api';
import { API_BASE_URL } from '../config/environment';

export const useCursorFeed = ({ autoLoad = true, onError = null } = {}) => {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const wsRef = useRef(null);
  const isInitialLoad = useRef(true);

  /**
   * Load initial feed items
   */
  const loadInitial = useCallback(async () => {
    if (loading || refreshing) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await contentAPI.getCursorFeed(null, 20);
      setItems(response.items || []);
      setNextCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
      isInitialLoad.current = false;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load feed';
      setError(errorMessage);
      if (onError) onError(err);
      console.error('Error loading cursor feed:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, refreshing, onError]);

  /**
   * Load more items (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor || !hasMore) return;
    
    setLoadingMore(true);
    
    try {
      const response = await contentAPI.getCursorFeed(nextCursor, 20);
      setItems(prev => [...prev, ...(response.items || [])]);
      setNextCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    } catch (err) {
      console.error('Error loading more items:', err);
      if (onError) onError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, hasMore, onError]);

  /**
   * Refresh feed (pull to refresh)
   */
  const refresh = useCallback(async () => {
    if (loading || refreshing) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await contentAPI.getCursorFeed(null, 20);
      setItems(response.items || []);
      setNextCursor(response.next_cursor);
      setHasMore(!!response.next_cursor);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to refresh feed';
      setError(errorMessage);
      if (onError) onError(err);
      console.error('Error refreshing feed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [loading, refreshing, onError]);

  /**
   * Prepend a new item (optimistic update)
   */
  const prependItem = useCallback((item) => {
    setItems(prev => [item, ...prev]);
  }, []);

  /**
   * Remove an item by ID
   */
  const removeItem = useCallback((itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  /**
   * Update an item by ID
   */
  const updateItem = useCallback((itemId, updates) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  }, []);

  /**
   * Setup WebSocket for real-time updates
   */
  useEffect(() => {
    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '/ws');
    
    console.log('🔌 Connecting WebSocket:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          
          if (data.type === 'NEW_POST' && data.post_id) {
            // Optionally fetch and prepend the new post
            // For now, just trigger a refresh or show notification
            console.log('🆕 New post published:', data.post_id);
            // You could implement: refresh() or fetch single post and prepend
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, []);

  /**
   * Auto-load on mount if enabled
   */
  useEffect(() => {
    if (autoLoad && isInitialLoad.current) {
      loadInitial();
    }
  }, [autoLoad, loadInitial]);

  return {
    // State
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    
    // Actions
    loadInitial,
    loadMore,
    refresh,
    prependItem,
    removeItem,
    updateItem,
  };
};

export default useCursorFeed;
