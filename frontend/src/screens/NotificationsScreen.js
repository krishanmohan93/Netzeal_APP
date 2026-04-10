import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { notificationsAPI } from '../services/api';
import { colors } from '../utils/theme';
import { spacing } from '../utils/theme';
import { getUserFacingError } from '../utils/errorMessages';
import NotificationCard from '../components/NotificationCard';

const normalizeNotificationsPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }
  if (Array.isArray(payload?.items)) {
    return payload.items.filter(Boolean);
  }
  if (Array.isArray(payload?.notifications)) {
    return payload.notifications.filter(Boolean);
  }
  return [];
};

const formatNotificationDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
};

const getSenderInitials = (sender) => {
  const raw = sender?.username || 'U';
  return String(raw).slice(0, 2).toUpperCase();
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDefaultAction = (type) => {
  switch (String(type || '').toLowerCase()) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented';
    case 'comment_like':
      return 'liked your comment';
    case 'comment_reply':
      return 'replied to your comment';
    case 'follow':
      return 'started following you';
    default:
      return 'sent you a notification';
  }
};

const buildNotificationContent = (item) => {
  const username = item.sender?.username || 'NetZeal';
  const defaultAction = getDefaultAction(item.type);
  const text = String(item.text || '').replace(/\s+/g, ' ').trim();

  if (!text) {
    return { username, actionText: defaultAction, messagePreview: '' };
  }

  // Avoid duplicated heading when backend text already starts with sender name.
  const leadingNamePattern = new RegExp(`^${escapeRegExp(username)}[,:]?\\s+`, 'i');
  const normalized = text.replace(leadingNamePattern, '').trim();
  const lower = normalized.toLowerCase();

  if (lower.startsWith('commented')) {
    const commentText = normalized.replace(/^commented[:\s-]*/i, '').trim();
    return {
      username,
      actionText: 'commented',
      messagePreview: commentText,
    };
  }

  if (lower.startsWith('liked')) {
    return { username, actionText: normalized, messagePreview: '' };
  }

  if (lower.startsWith('started following')) {
    return { username, actionText: 'started following you', messagePreview: '' };
  }

  if (lower.startsWith('replied')) {
    const replyText = normalized.replace(/^replied[:\s-]*/i, '').trim();
    return {
      username,
      actionText: 'replied',
      messagePreview: replyText,
    };
  }

  return {
    username,
    actionText: defaultAction,
    messagePreview: normalized,
  };
};

const resolveNotificationPostId = (item) => {
  const raw =
    item?.post_id ??
    item?.post?.id ??
    item?.entity_post_id ??
    item?.entity?.post_id ??
    item?.entity?.id ??
    item?.entity_id;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pendingReadId, setPendingReadId] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsAPI.list();
      setNotifications(normalizeNotificationsPayload(data));
    } catch (error) {
      setError(getUserFacingError(error, 'Could not load notifications. Please try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handlePress = async (item) => {
    // Mark read
    if (!item.is_read && pendingReadId !== item.id) {
      try {
        setPendingReadId(item.id);
        await notificationsAPI.markRead(item.id);
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      } catch (e) {
        // non-blocking
      } finally {
        setPendingReadId(null);
      }
    }

    // Navigate logic
    const senderId =
      item.sender?.public_id ||
      item.sender?.id ||
      item.sender_public_id ||
      item.sender_id;

    if (item.type === 'follow') {
      if (senderId) {
        navigation.navigate('ProfileDashboard', { userId: senderId });
      }
      return;
    }

    const entityType = String(item.entity_type || item.entity_kind || '').toLowerCase();
    const isPostActivity =
      item.type === 'like' ||
      item.type === 'comment' ||
      item.type === 'comment_like' ||
      item.type === 'comment_reply' ||
      entityType === 'post';
    const targetPostId = resolveNotificationPostId(item);
    if (targetPostId && isPostActivity) {
      navigation.navigate('PostDetail', { postId: targetPostId });
    }
  }, [navigation, pendingReadId]);

  const renderItem = useCallback(({ item }) => {
    const { username, actionText, messagePreview } = buildNotificationContent(item);
    return (
      <NotificationCard
        item={item}
        username={username}
        actionText={actionText}
        messagePreview={messagePreview}
        timestamp={formatNotificationDate(item.created_at)}
        isPending={pendingReadId === item.id}
        onPress={() => handlePress(item)}
        getSenderInitials={getSenderInitials}
      />
    );
  }, [handlePress, pendingReadId]);

  const keyExtractor = useCallback((item, index) => String(item?.id ?? `notification-${index}`), []);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
    [refreshing]
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, retrying && styles.buttonDisabled]}
            onPress={() => {
              setRetrying(true);
              fetchNotifications();
            }}
            disabled={retrying}
          >
            {retrying ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.retryText}>Retry</Text>}
          </TouchableOpacity>
        </View>
      );
    }

    if (notifications.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>N</Text>
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubText}>Follow, like, and comment activity will appear here.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={refreshControl}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={40}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View style={styles.sectionHeader}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconText: {
    fontSize: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: colors.surface,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default NotificationsScreen;
