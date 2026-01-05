/**
 * Local Message Cache Service
 * Uses AsyncStorage for quick access and SQLite for persistent storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

const CACHE_PREFIX = '@netzeal_chat:';
const CACHE_KEYS = {
  CONVERSATIONS: `${CACHE_PREFIX}conversations`,
  MESSAGES: `${CACHE_PREFIX}messages:`,
  UNREAD_COUNT: `${CACHE_PREFIX}unread_count`,
  DRAFTS: `${CACHE_PREFIX}drafts:`,
  TYPING_STATUS: `${CACHE_PREFIX}typing:`,
};

// SQLite database
let db = null;

/**
 * Initialize SQLite database
 */
export const initDatabase = async () => {
  if (db) return db;
  
  try {
    db = await SQLite.openDatabaseAsync('netzeal_chat.db');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT,
        message_type TEXT DEFAULT 'TEXT',
        media_url TEXT,
        media_thumbnail_url TEXT,
        media_metadata TEXT,
        reply_to_id INTEGER,
        is_read INTEGER DEFAULT 0,
        is_sent INTEGER DEFAULT 1,
        is_delivered INTEGER DEFAULT 0,
        temp_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        INDEX idx_conversation (conversation_id),
        INDEX idx_created_at (created_at)
      );
      
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        last_message TEXT,
        last_message_at TEXT,
        unread_count INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        cached_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS pending_messages (
        temp_id TEXT PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        content TEXT,
        message_type TEXT DEFAULT 'TEXT',
        media_url TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    
    console.log('✅ SQLite database initialized');
    return db;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

/**
 * Cache conversations in AsyncStorage (quick access)
 */
export const cacheConversations = async (conversations) => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEYS.CONVERSATIONS,
      JSON.stringify({
        data: conversations,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('Error caching conversations:', error);
  }
};

/**
 * Get cached conversations from AsyncStorage
 */
export const getCachedConversations = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.CONVERSATIONS);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      
      // Check if cache is less than 5 minutes old
      const cacheAge = Date.now() - new Date(timestamp).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting cached conversations:', error);
    return null;
  }
};

/**
 * Cache messages for a conversation in SQLite
 */
export const cacheMessages = async (conversationId, messages) => {
  try {
    await initDatabase();
    
    // Use transaction for batch insert
    await db.withTransactionAsync(async () => {
      for (const msg of messages) {
        await db.runAsync(
          `INSERT OR REPLACE INTO messages 
           (id, conversation_id, sender_id, content, message_type, media_url, 
            media_thumbnail_url, media_metadata, reply_to_id, is_read, 
            is_sent, is_delivered, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            msg.id,
            conversationId,
            msg.sender_id,
            msg.content,
            msg.message_type || msg.type || 'TEXT',
            msg.media_url,
            msg.media_thumbnail_url,
            msg.media_metadata ? JSON.stringify(msg.media_metadata) : null,
            msg.reply_to_id,
            msg.is_read ? 1 : 0,
            1, // is_sent
            msg.is_delivered ? 1 : 0,
            msg.created_at,
          ]
        );
      }
    });
    
    console.log(`✅ Cached ${messages.length} messages for conversation ${conversationId}`);
  } catch (error) {
    console.error('Error caching messages:', error);
  }
};

/**
 * Get cached messages for a conversation from SQLite
 */
export const getCachedMessages = async (conversationId, limit = 50) => {
  try {
    await initDatabase();
    
    const result = await db.getAllAsync(
      `SELECT * FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [conversationId, limit]
    );
    
    return result.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error getting cached messages:', error);
    return [];
  }
};

/**
 * Add pending message (not yet sent to server)
 */
export const addPendingMessage = async (tempId, conversationId, message) => {
  try {
    await initDatabase();
    
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_messages 
       (temp_id, conversation_id, content, message_type, media_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tempId,
        conversationId,
        message.content,
        message.message_type || 'TEXT',
        message.media_url,
        new Date().toISOString(),
      ]
    );
    
    // Also cache in messages table for immediate display
    await db.runAsync(
      `INSERT INTO messages 
       (conversation_id, sender_id, content, message_type, media_url, 
        temp_id, is_sent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        message.sender_id,
        message.content,
        message.message_type || 'TEXT',
        message.media_url,
        tempId,
        0, // not sent yet
        new Date().toISOString(),
      ]
    );
  } catch (error) {
    console.error('Error adding pending message:', error);
  }
};

/**
 * Get all pending messages
 */
export const getPendingMessages = async () => {
  try {
    await initDatabase();
    
    const result = await db.getAllAsync(
      `SELECT * FROM pending_messages 
       ORDER BY created_at ASC`
    );
    
    return result;
  } catch (error) {
    console.error('Error getting pending messages:', error);
    return [];
  }
};

/**
 * Remove pending message after successful send
 */
export const removePendingMessage = async (tempId) => {
  try {
    await initDatabase();
    
    await db.runAsync(
      `DELETE FROM pending_messages WHERE temp_id = ?`,
      [tempId]
    );
    
    // Update message in cache to mark as sent
    await db.runAsync(
      `UPDATE messages SET is_sent = 1 WHERE temp_id = ?`,
      [tempId]
    );
  } catch (error) {
    console.error('Error removing pending message:', error);
  }
};

/**
 * Increment retry count for failed message
 */
export const incrementRetryCount = async (tempId) => {
  try {
    await initDatabase();
    
    await db.runAsync(
      `UPDATE pending_messages SET retry_count = retry_count + 1 WHERE temp_id = ?`,
      [tempId]
    );
  } catch (error) {
    console.error('Error incrementing retry count:', error);
  }
};

/**
 * Save draft message
 */
export const saveDraft = async (conversationId, text) => {
  try {
    await AsyncStorage.setItem(
      `${CACHE_KEYS.DRAFTS}${conversationId}`,
      text
    );
  } catch (error) {
    console.error('Error saving draft:', error);
  }
};

/**
 * Get draft message
 */
export const getDraft = async (conversationId) => {
  try {
    const draft = await AsyncStorage.getItem(`${CACHE_KEYS.DRAFTS}${conversationId}`);
    return draft || '';
  } catch (error) {
    console.error('Error getting draft:', error);
    return '';
  }
};

/**
 * Clear draft message
 */
export const clearDraft = async (conversationId) => {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEYS.DRAFTS}${conversationId}`);
  } catch (error) {
    console.error('Error clearing draft:', error);
  }
};

/**
 * Update message read status
 */
export const markMessageAsRead = async (messageId) => {
  try {
    await initDatabase();
    
    await db.runAsync(
      `UPDATE messages SET is_read = 1 WHERE id = ?`,
      [messageId]
    );
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

/**
 * Update message delivery status
 */
export const markMessageAsDelivered = async (messageId) => {
  try {
    await initDatabase();
    
    await db.runAsync(
      `UPDATE messages SET is_delivered = 1 WHERE id = ?`,
      [messageId]
    );
  } catch (error) {
    console.error('Error marking message as delivered:', error);
  }
};

/**
 * Get unread message count
 */
export const getUnreadCount = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.UNREAD_COUNT);
    return cached ? parseInt(cached, 10) : 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

/**
 * Update unread count
 */
export const updateUnreadCount = async (count) => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.UNREAD_COUNT, count.toString());
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
};

/**
 * Search messages in cache
 */
export const searchCachedMessages = async (query) => {
  try {
    await initDatabase();
    
    const result = await db.getAllAsync(
      `SELECT * FROM messages 
       WHERE content LIKE ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [`%${query}%`]
    );
    
    return result;
  } catch (error) {
    console.error('Error searching messages:', error);
    return [];
  }
};

/**
 * Clear all cache (logout)
 */
export const clearAllCache = async () => {
  try {
    // Clear AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const chatKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(chatKeys);
    
    // Clear SQLite
    await initDatabase();
    await db.execAsync(`
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM pending_messages;
    `);
    
    console.log('✅ All chat cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Sync pending messages with server
 */
export const syncPendingMessages = async (sendMessageFunction) => {
  try {
    const pending = await getPendingMessages();
    
    for (const msg of pending) {
      // Skip if retried too many times
      if (msg.retry_count >= 5) {
        console.warn(`⚠️ Giving up on message ${msg.temp_id} after 5 retries`);
        await removePendingMessage(msg.temp_id);
        continue;
      }
      
      try {
        // Attempt to send
        await sendMessageFunction(msg.conversation_id, {
          content: msg.content,
          message_type: msg.message_type,
          media_url: msg.media_url,
          temp_id: msg.temp_id,
        });
        
        // Remove from pending on success
        await removePendingMessage(msg.temp_id);
        console.log(`✅ Synced pending message ${msg.temp_id}`);
      } catch (error) {
        console.error(`❌ Failed to sync message ${msg.temp_id}:`, error);
        await incrementRetryCount(msg.temp_id);
      }
    }
  } catch (error) {
    console.error('Error syncing pending messages:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    await initDatabase();
    
    const messageCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM messages`
    );
    
    const conversationCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM conversations`
    );
    
    const pendingCount = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM pending_messages`
    );
    
    return {
      total_messages: messageCount.count,
      total_conversations: conversationCount.count,
      pending_messages: pendingCount.count,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
};

export default {
  initDatabase,
  cacheConversations,
  getCachedConversations,
  cacheMessages,
  getCachedMessages,
  addPendingMessage,
  getPendingMessages,
  removePendingMessage,
  saveDraft,
  getDraft,
  clearDraft,
  markMessageAsRead,
  markMessageAsDelivered,
  getUnreadCount,
  updateUnreadCount,
  searchCachedMessages,
  clearAllCache,
  syncPendingMessages,
  getCacheStats,
};
