/**
 * UserPostsFeed Component
 * Displays posts filtered by current user using existing Feed Post component
 */
import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { colors, spacing, typography } from '../utils/theme';

interface Post {
  id: string;
  title?: string;
  description?: string;
  caption?: string;
  media_url?: string;
  media_type?: string;
  author_id?: string;
  is_liked?: boolean;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  [key: string]: any;
}

interface UserPostsFeedProps {
  posts: Post[];
  loading?: boolean;
  onLoadMore?: () => void;
  onPostLike?: (postId: string) => void;
  onPostComment?: (post: Post) => void;
  onPostShare?: (post: Post) => void;
  onPostRepost?: (post: Post) => void;
  onPostDelete?: (postId: string) => void;
  onPostEdit?: (post: Post) => void;
  onOpenFullscreen?: (index: number) => void;
  renderPostItem: (post: Post, handlers: any) => React.ReactElement;
}

const UserPostsFeed: React.FC<UserPostsFeedProps> = ({
  posts,
  loading = false,
  onLoadMore,
  onPostLike,
  onPostComment,
  onPostShare,
  onPostRepost,
  onPostDelete,
  onPostEdit,
  onOpenFullscreen,
  renderPostItem,
}) => {
  const handleEndReached = () => {
    if (!loading && onLoadMore) {
      onLoadMore();
    }
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => {
    if (posts.length === 0 && !loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No posts yet</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Posts</Text>
      <FlatList
        data={posts}
        renderItem={({ item }) =>
          renderPostItem(item, {
            onLike: onPostLike,
            onComment: onPostComment,
            onShare: onPostShare,
            onRepost: onPostRepost,
            onDelete: onPostDelete,
            onEdit: onPostEdit,
            onOpenFullscreen,
          })
        }
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  footer: {
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
});

export default UserPostsFeed;
