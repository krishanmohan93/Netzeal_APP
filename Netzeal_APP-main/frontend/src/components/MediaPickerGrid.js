/**
 * MediaPickerGrid Component
 * Displays a grid of selected media with reorder and remove capabilities
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, borderRadius } from '../utils/theme';

const MediaPickerGrid = ({ items = [], onRemove, onReorder }) => {
  if (items.length === 0) {
    return null;
  }

  const moveUp = (index) => {
    if (index > 0 && onReorder) {
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      onReorder(newItems);
    }
  };

  const moveDown = (index) => {
    if (index < items.length - 1 && onReorder) {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      onReorder(newItems);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selected Media ({items.length})</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.grid}>
          {items.map((item, index) => (
            <View key={index} style={styles.mediaItem}>
              {/* Media Preview */}
              <Image 
                source={{ uri: item.uri }} 
                style={styles.thumbnail}
                resizeMode="cover"
              />
              
              {/* Media Type Indicator */}
              {item.type === 'video' && (
                <View style={styles.videoIndicator}>
                  <Icon name="play-circle" size={20} color="#FFFFFF" />
                </View>
              )}

              {/* Index Badge */}
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>

              {/* Remove Button */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemove && onRemove(index)}
              >
                <Icon name="close-circle" size={24} color="#FF4444" />
              </TouchableOpacity>

              {/* Reorder Buttons */}
              <View style={styles.reorderButtons}>
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.reorderButton}
                    onPress={() => moveUp(index)}
                  >
                    <Icon name="chevron-back" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {index < items.length - 1 && (
                  <TouchableOpacity
                    style={styles.reorderButton}
                    onPress={() => moveDown(index)}
                  >
                    <Icon name="chevron-forward" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  scrollView: {
    marginHorizontal: -spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  mediaItem: {
    width: 100,
    height: 100,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  reorderButtons: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MediaPickerGrid;
