/**
 * Placeholder screens (can be expanded later)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../utils/theme';

const PlaceholderScreen = ({ title, icon }) => (
  <View style={styles.container}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>Coming Soon</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export const MyWorkScreen = () => <PlaceholderScreen title="My Work" icon="💼" />;
export const NotificationsScreen = () => <PlaceholderScreen title="Notifications" icon="🔔" />;
export const PostDetailScreen = () => <PlaceholderScreen title="Post Details" icon="📄" />;
export const UserProfileScreen = () => <PlaceholderScreen title="User Profile" icon="👤" />;
export const CreatePostScreen = () => <PlaceholderScreen title="Create Post" icon="✍️" />;
