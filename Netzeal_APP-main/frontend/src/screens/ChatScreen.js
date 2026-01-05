/**
 * ChatScreen - Individual chat thread with messages
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatAPI } from '../services/chatApi';
import { timeAgo } from '../utils/formatters';

const ChatScreen = ({ route, navigation }) => {
  const { conversationId, conversationTitle, userId, username, name } = route.params || {};
  
  console.log('ChatScreen params:', { conversationId, conversationTitle, userId, username, name });
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Prefer provided title, else fallback to username/name while resolving conversation
    const headerTitle = conversationTitle || username || name || 'Chat';
    navigation.setOptions({ title: headerTitle });

    const init = async () => {
      await loadCurrentUser();

      // If no conversationId but a userId is provided, create/fetch a direct conversation
      if (!conversationId && userId) {
        try {
          const conv = await chatAPI.createConversation('direct', [userId], null);
          // Set params so effect re-runs with the new conversationId
          navigation.setParams({
            conversationId: conv.id,
            conversationTitle: conv.title || username || name || 'Chat'
          });
          return; // Wait for next effect run
        } catch (e) {
          console.error('Failed to ensure conversation:', e);
          Alert.alert('Error', 'Unable to start conversation');
          setLoading(false);
          return;
        }
      }

      // Proceed only if we have a valid conversationId
      if (conversationId) {
        loadMessages();
        connectWebSocket();
      } else {
        // No conversationId and no userId - invalid state
        setLoading(false);
        Alert.alert('Error', 'No conversation specified');
      }
    };

    init();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

  const loadCurrentUser = async () => {
    try {
      const userDataStr = await AsyncStorage.getItem('user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setCurrentUserId(userData.id);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  const loadMessages = async (cursor = null) => {
    try {
      console.log('loadMessages called with conversationId:', conversationId, 'cursor:', cursor);
      if (cursor) {
        setLoadingMore(true);
      }
      if (!conversationId) {
        console.log('No conversationId, skipping loadMessages');
        return; // Guard until conversation is resolved
      }
      const data = await chatAPI.getMessages(conversationId, cursor);
      console.log('Messages loaded:', data);
      
      if (cursor) {
        setMessages(prev => [...prev, ...data.items]);
      } else {
        setMessages(data.items);
      }
      
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
      
      // Mark messages as read
      if (data.items.length > 0 && !cursor) {
        const latestMessage = data.items[data.items.length - 1];
        if (latestMessage.sender_id !== currentUserId) {
          await chatAPI.markMessageRead(latestMessage.id);
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (hasMore && !loadingMore && nextCursor) {
      loadMessages(nextCursor);
    }
  };

  const connectWebSocket = async () => {
    try {
      if (!conversationId) return; // Guard until conversation is resolved
      const userData = await AsyncStorage.getItem('user_data');
      if (!userData) return;
      
      const { id: userId } = JSON.parse(userData);
      const wsUrl = chatAPI.getChatWebSocketUrl(userId);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        // Join this conversation room
        wsRef.current.send(JSON.stringify({
          type: 'JOIN_ROOM',
          data: { conversation_id: conversationId }
        }));
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
    }
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'NEW_MESSAGE':
        if (message.data.conversation_id === conversationId) {
          setMessages(prev => [...prev, message.data]);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
          
          // Mark as read if not from current user
          if (message.data.sender_id !== currentUserId) {
            chatAPI.markMessageRead(message.data.id);
          }
        }
        break;
      
      case 'TYPING':
        if (message.data.conversation_id === conversationId) {
          handleTypingIndicator(message.data);
        }
        break;
      
      case 'READ_RECEIPT':
        if (message.data.conversation_id === conversationId) {
          // Update read status in messages
          setMessages(prev => prev.map(msg => {
            if (msg.id === message.data.message_id) {
              return {
                ...msg,
                read_by: [...msg.read_by, message.data.user_id]
              };
            }
            return msg;
          }));
        }
        break;
    }
  };

  const handleTypingIndicator = (data) => {
    if (data.user_id === currentUserId) return;
    
    if (data.is_typing) {
      setTypingUsers(prev => {
        if (!prev.includes(data.username)) {
          return [...prev, data.username];
        }
        return prev;
      });
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== data.username));
      }, 3000);
    } else {
      setTypingUsers(prev => prev.filter(u => u !== data.username));
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TYPING',
        data: {
          conversation_id: conversationId,
          is_typing: isTyping
        }
      }));
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    
    // Send typing indicator
    if (text.length > 0) {
      sendTypingIndicator(true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    } else {
      sendTypingIndicator(false);
    }
  };

  const handleSendMessage = async () => {
    const content = inputText.trim();
    if (!content || sending) return;
    
    setInputText('');
    sendTypingIndicator(false);
    setSending(true);
    
    try {
      await chatAPI.sendMessage(conversationId, {
        content,
        messageType: 'TEXT'
      });
      
      // Message will be added via WebSocket NEW_MESSAGE event
    } catch (err) {
      console.error('Failed to send message:', err);
      Alert.alert('Error', 'Failed to send message');
      setInputText(content); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwn = item.sender_id === currentUserId;
    const showAvatar = !isOwn && (index === messages.length - 1 || messages[index + 1]?.sender_id !== item.sender_id);
    const showTimestamp = index === 0 || messages[index - 1]?.sender_id !== item.sender_id;

    return (
      <View style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
        {!isOwn && (
          <View style={styles.avatarSpace}>
            {showAvatar ? (
              item.sender_profile_photo ? (
                <Image source={{ uri: item.sender_profile_photo }} style={styles.messageAvatar} />
              ) : (
                <View style={[styles.messageAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={16} color="#B8860B" />
                </View>
              )
            ) : null}
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {showTimestamp && !isOwn && (
            <Text style={styles.senderName}>{item.sender_username}</Text>
          )}
          
          {item.media_url && (
            <Image
              source={{ uri: item.media_url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          
          {item.content && (
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
              {item.content}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {timeAgo(item.created_at)}
            </Text>
            
            {isOwn && (
              <View style={styles.readReceiptIcon}>
                {item.read_by.length > 0 ? (
                  <Ionicons name="checkmark-done" size={14} color="#4CAF50" />
                ) : (
                  <Ionicons name="checkmark" size={14} color="#999" />
                )}
              </View>
            )}
          </View>
        </View>
        
        {isOwn && <View style={styles.avatarSpace} />}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        inverted
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#B8860B" />
            </View>
          ) : null
        }
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messagesList}
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </Text>
        </View>
      )}

      {/* Bottom Chat Input Bar */}
      <View style={styles.bottomBarWrapper}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton} onPress={() => {}}>
              <Ionicons name="add-circle-outline" size={24} color="#B8860B" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  avatarSpace: {
    width: 32,
    marginHorizontal: 4,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8DC',
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  ownBubble: {
    backgroundColor: '#B8860B',
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B8860B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  readReceiptIcon: {
    marginLeft: 4,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  typingText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFDF7',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 26,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  attachButton: {
    padding: 6,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default ChatScreen;
