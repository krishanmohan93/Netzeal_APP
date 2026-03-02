/**
 * My Work Screen - Network Messages & Connections
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../utils/theme';
import { chatAPI } from '../services/chatApi';
import { timeAgo } from '../utils/formatters';
import { normalizeUri } from '../utils/media';
import { getUserFacingError } from '../utils/errorMessages';

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? parts[1][0] : (parts[0][1] || '');
  return (first + second).toUpperCase();
};

const getConversationTitle = (conversation, currentUserId) => {
  if (conversation.title) return conversation.title;
  const participants = conversation.participants || [];
  const others = currentUserId
    ? participants.filter(p => p.user_id !== currentUserId)
    : participants;
  if (conversation.type === 'direct') {
    const other = others[0] || participants[0];
    return other?.full_name || other?.username || 'Chat';
  }
  const names = others
    .slice(0, 3)
    .map(p => p.full_name || p.username)
    .filter(Boolean)
    .join(', ');
  return names || 'Group Chat';
};

const getConversationAvatar = (conversation, currentUserId) => {
  const participants = conversation.participants || [];
  const others = currentUserId
    ? participants.filter(p => p.user_id !== currentUserId)
    : participants;
  if (conversation.type === 'direct') {
    const other = others[0] || participants[0];
    return other?.profile_photo || null;
  }
  return null;
};

const ConversationItem = ({ conversation, currentUserId, onPress }) => {
  const title = getConversationTitle(conversation, currentUserId);
  const avatarUrl = normalizeUri(getConversationAvatar(conversation, currentUserId));
  const initials = getInitials(title);
  const lastMessage = conversation.last_message
    ? `${conversation.last_message_sender ? `${conversation.last_message_sender}: ` : ''}${conversation.last_message}`
    : 'No messages yet';
  const timestamp = conversation.last_message_at ? timeAgo(conversation.last_message_at) : '';
  const hasUnread = (conversation.unread_count || 0) > 0;
  const isOnline = (conversation.participants || []).some(p => p.is_online);

  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress}>
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameContainer}>
            <Text style={[styles.userName, hasUnread && styles.unreadText]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[styles.messagePreview, hasUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MyWorkScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    try {
      const userDataStr = await AsyncStorage.getItem('user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setCurrentUserId(userData.id);
      }
    } catch (err) {
      setError((prev) => prev || getUserFacingError(err, 'Unable to load your account details.'));
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      const data = await chatAPI.getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getUserFacingError(err, 'Could not load conversations. Please try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
    loadConversations();

    const unsubscribe = navigation.addListener('focus', () => {
      loadConversations();
    });

    return unsubscribe;
  }, [navigation, loadCurrentUser, loadConversations]);

  const handleConversationPress = (conversation) => {
    const title = getConversationTitle(conversation, currentUserId);
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      conversationTitle: title,
      name: title,
    });
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('CreatePost')}>
          <Icon name="add" size={28} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/netzeal-app-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Search')}>
          <Icon name="search" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Network</Text>
        <TouchableOpacity>
          <Icon name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={48} color="#999" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, retrying && styles.buttonDisabled]} onPress={() => {
          setRetrying(true);
          loadConversations();
        }} disabled={retrying}>
          {retrying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.retryText}>Retry</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            currentUserId={currentUserId}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start chatting with someone!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    // Push content below the status bar/notch, especially on Android
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 56,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logoImage: {
    height: 28,
    width: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  avatarContainer: {
    marginRight: spacing.sm,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  unreadText: {
    fontWeight: '700',
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.xs,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default MyWorkScreen;
