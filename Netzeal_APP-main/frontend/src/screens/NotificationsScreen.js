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

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsAPI.list();
      setNotifications(data || []);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    if (!item.is_read) {
      try {
        await notificationsAPI.markRead(item.id);
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      } catch (e) { }
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
    >
      <Image
        source={{ uri: item.sender?.profile_photo || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.content}>
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
});

export default NotificationsScreen;
