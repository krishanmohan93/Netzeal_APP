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
      setNotifications(data || []);
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
      <Image
        source={{ uri: normalizeUri(item.sender?.profile_photo) || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={[styles.content, pendingReadId === item.id && { opacity: 0.6 }]}>
        <Text style={styles.text}>
          <Text style={styles.username}>{item.sender?.username} </Text>
          {item.text || 'New notification'}
        </Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
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

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
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
  item: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: '#f0f9ff',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#ddd',
  },
  content: {
    flex: 1,
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
