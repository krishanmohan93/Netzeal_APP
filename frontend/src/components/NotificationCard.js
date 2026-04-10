import React, { memo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { colors } from '../utils/theme';
import { normalizeUri } from '../utils/media';

const NotificationCard = ({
  item,
  username,
  actionText,
  messagePreview,
  timestamp,
  isPending,
  onPress,
  getSenderInitials,
}) => {
  const profilePhoto = normalizeUri(item.sender?.profile_photo);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !item.is_read && styles.unreadCard,
        isPending && styles.pendingCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      disabled={isPending}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
    >
      <View style={styles.avatarContainer}>
        {profilePhoto ? (
          <Image source={{ uri: profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{getSenderInitials(item.sender)}</Text>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <View style={styles.headline}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.username}>
              {username}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.actionText}>
              {` ${actionText}`}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.timestamp}>
            {timestamp}
          </Text>
        </View>

        {!!messagePreview && (
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.messagePreview}>
            {messagePreview}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 2,
  },
  unreadCard: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.secondary,
  },
  pendingCard: {
    opacity: 0.62,
  },
  cardPressed: {
    opacity: Platform.OS === 'ios' ? 0.85 : 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarFallbackText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  username: {
    maxWidth: '46%',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.text,
  },
  messagePreview: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  timestamp: {
    maxWidth: 84,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textLight,
    textAlign: 'right',
  },
});

export default memo(NotificationCard);