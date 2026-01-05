/**
 * ProjectCarousel Component
 * Horizontal scrollable list of project cards with NETZEAL styling
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';

interface Project {
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
}

interface ProjectCarouselProps {
  projects: Project[];
  onProjectPress?: (project: Project) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

const ProjectCarousel: React.FC<ProjectCarouselProps> = ({
  projects,
  onProjectPress,
}) => {
  // Map icon names to actual icon components - using standard icon sets
  const getIconName = (icon?: string): any => {
    const iconMap: Record<string, any> = {
      neural: 'brain',
      city: 'city',
      blockchain: 'link',
      ai: 'robot',
      data: 'database',
      cloud: 'cloud',
      default: 'folder',
    };
    return iconMap[icon || 'default'] || 'folder';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Projects</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {projects.map((project, index) => (
          <TouchableOpacity
            key={project.id}
            style={[
              styles.card,
              index === projects.length - 1 && styles.cardLast,
            ]}
            onPress={() => onProjectPress?.(project)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                  name={getIconName(project.icon)}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <TouchableOpacity style={styles.openButton}>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {project.title}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {project.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  scrollView: {
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingRight: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    ...shadows.md,
  },
  cardLast: {
    marginRight: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },
});

export default ProjectCarousel;
