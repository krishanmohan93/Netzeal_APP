import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notificationsAPI } from '../services/api';
import { colors } from '../utils/theme';
import { normalizeUri } from '../utils/media';
import { getUserFacingError } from '../utils/errorMessages';

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
    if (item.type === 'follow') {
      const targetId = item.sender?.public_id || item.sender?.id;
      if (targetId) {
        navigation.navigate('ProfileDashboard', { userId: targetId });
      }
    } else if (item.type === 'like' || item.type === 'comment') {
      if (item.entity_id) {
        navigation.navigate('PostDetail', { postId: item.entity_id });
      }
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.unreadItem]}
      onPress={() => handlePress(item)}
      disabled={pendingReadId === item.id}
    >
      <View style={styles.avatarContainer}>
        {normalizeUri(item.sender?.profile_photo) ? (
          <Image
            source={{ uri: normalizeUri(item.sender?.profile_photo) }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{getSenderInitials(item.sender)}</Text>
          </View>
        )}
      </View>
      <View style={[styles.content, pendingReadId === item.id && { opacity: 0.6 }]}>
        <Text style={styles.text}>
          <Text style={styles.username}>{item.sender?.username || 'NetZeal'} </Text>
          {item.text || 'New notification'}
        </Text>
        <Text style={styles.time}>{formatNotificationDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

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
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubText}>Follow, like, and comment activity will appear here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item, index) => String(item?.id ?? `notification-${index}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingBottom: 12,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    alignItems: 'flex-start',
  },
  unreadItem: {
    backgroundColor: '#f0f9ff',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    marginRight: 12,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ddd',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9d9d9',
  },
  avatarFallbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  text: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  username: {
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: 8,
    color: '#b3b3b3',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default NotificationsScreen;
