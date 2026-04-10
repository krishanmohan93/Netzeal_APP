/**
 * Bottom Tab Navigation
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../utils/theme';
import { notificationsAPI, getAuthToken } from '../services/api';
import { API_BASE_URL } from '../config/environment';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import MyWorkScreen from '../screens/MyWorkScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AIBotScreen from '../screens/AIBotScreen';
import ProfileDashboardScreen from '../screens/ProfileDashboardScreen';

const Tab = createBottomTabNavigator();

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

const buildNotificationWsUrl = (apiBaseUrl, token) => {
  if (!apiBaseUrl || !token) return null;
  const protocol = apiBaseUrl.startsWith('https') ? 'wss' : 'ws';
  const stripped = apiBaseUrl.replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '');
  return `${protocol}://${stripped}/ws?token=${encodeURIComponent(token)}`;
};

const BottomTabNavigator = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await notificationsAPI.list({ skip: 0, limit: 50 });
      const items = normalizeNotificationsPayload(data);
      const unread = items.filter((item) => !item?.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshUnreadCount();
      }
    });

    return () => {
      clearInterval(interval);
      subscription?.remove?.();
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let canceled = false;

    const connect = async () => {
      try {
        const token = await getAuthToken();
        const wsUrl = buildNotificationWsUrl(API_BASE_URL, token);
        if (!wsUrl || canceled) return;

        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data || '{}');
            if (payload?.type === 'NOTIFICATION') {
              refreshUnreadCount();
            }
          } catch (e) {
            // ignore malformed payloads
          }
        };
        ws.onclose = () => {
          if (!canceled) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
        ws.onerror = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch (e) {
        // silent fallback to polling
      }
    };

    connect();

    return () => {
      canceled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [refreshUnreadCount]);

  const notificationBadge = useMemo(
    () => (unreadCount > 0 ? unreadCount : undefined),
    [unreadCount]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MyWork') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'AIBot') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          marginHorizontal: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
          color: colors.text,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Feed', headerShown: false }}
      />
      <Tab.Screen 
        name="MyWork" 
        component={MyWorkScreen}
        options={{ title: 'My Work', headerShown: false }}
      />
      <Tab.Screen 
        name="AIBot" 
        component={AIBotScreen}
        options={{ title: 'AI Assistant' }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerShown: false,
          tabBarBadge: notificationBadge,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.surface,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileDashboardScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
