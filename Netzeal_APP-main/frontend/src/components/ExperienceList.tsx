/**
 * ExperienceList Component
 * Vertical list of experience/portfolio items with NETZEAL styling
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../utils/theme';

interface Experience {
  id: string;
  title: string;
  role: string;
  year: string;
  icon?: string;
  iconUrl?: string;
}

interface ExperienceListProps {
  title: string;
  experiences: Experience[];
  onItemPress?: (experience: Experience) => void;
}

const getIconName = (icon?: string): any => {
  const iconMap: Record<string, any> = {
    company: 'briefcase',
    intern: 'school',
    research: 'flask',
    startup: 'rocket',
    default: 'briefcase',
  };
  return iconMap[icon || 'default'] || 'briefcase';
};

const ExperienceList: React.FC<ExperienceListProps> = ({
  title,
  experiences,
  onItemPress,
}) => {
  const renderExperienceItem = ({ item }: { item: Experience }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => onItemPress?.(item)}
      activeOpacity={0.6}
    >
      {/* Icon on Left */}
      <View style={styles.iconContainer}>
        {item.iconUrl ? (
          <Image
            source={{ uri: item.iconUrl }}
            style={styles.iconImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.iconPlaceholder}>
            <MaterialCommunityIcons
              name={getIconName(item.icon)}
              size={20}
              color={colors.primary}
            />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemRole} numberOfLines={1}>
          {item.role}
        </Text>
        <Text style={styles.itemYear}>{item.year}</Text>
      </View>

      {/* Chevron Icon */}
      <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        data={experiences}
        renderItem={renderExperienceItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  iconImage: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  itemTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemRole: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  itemYear: {
    fontSize: typography.caption.fontSize,
    color: colors.textLight,
  },
  separator: {
    height: spacing.sm,
  },
});

export default ExperienceList;
