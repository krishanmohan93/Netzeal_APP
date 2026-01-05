/**
 * CVUploadCard Component
 * Sticky CTA card for CV/Resume upload with NETZEAL styling
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';

interface CVUploadCardProps {
  onPress: () => void;
  isSticky?: boolean;
}

const CVUploadCard: React.FC<CVUploadCardProps> = ({
  onPress,
  isSticky = false,
}) => {
  return (
    <View style={[styles.container, isSticky && styles.stickyContainer]}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons
          name="cloud-upload-outline"
          size={24}
          color={colors.surface}
          style={styles.icon}
        />
        <View style={styles.content}>
          <Text style={styles.cardTitle}>CV Upload</Text>
          <Text style={styles.cardSubtitle}>Upload CV / Resume</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.surface}
          style={styles.chevron}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
    ...Platform.select({
      ios: {
        paddingBottom: spacing.lg + 20, // Account for home indicator
      },
    }),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  icon: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.surface,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.secondary,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});

export default CVUploadCard;
