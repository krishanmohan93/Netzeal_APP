/**
 * Bottom Tab Navigation
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../utils/theme';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import MyWorkScreen from '../screens/MyWorkScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AIBotScreen from '../screens/AIBotScreen';
import ProfileDashboardScreen from '../screens/ProfileDashboardScreen';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
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
        options={{ title: 'Notifications', headerShown: false }}
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
