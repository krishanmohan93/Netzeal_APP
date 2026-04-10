import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { contentAPI, getAuthToken } from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { normalizeUri } from '../utils/media';
import { getUserFacingError } from '../utils/errorMessages';
import { API_BASE_URL } from '../config/environment';

const getFirstMediaUrl = (post) => {
  const primary =
    post?.media_url ||
    post?.thumbnail_url ||
    post?.image_url ||
    (Array.isArray(post?.media_urls) ? post.media_urls[0] : null);
  return normalizeUri(primary || '');
};

const PostDetailScreen = ({ route }) => {
  const { postId } = route.params || {};
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [likeBusyIds, setLikeBusyIds] = useState({});

  const loadPost = useCallback(async () => {
    if (!postId) {
      setError('Invalid post');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const data = await contentAPI.getPost(postId);
      setPost(data);
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to load post.'));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    try {
      setCommentsLoading(true);
      const data = await contentAPI.getComments(postId, 0, 50);
      const items = Array.isArray(data) ? data : data?.items || data?.comments || [];
      setComments(Array.isArray(items) ? items : []);
    } catch (err) {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [loadPost, loadComments]);

  useEffect(() => {
    setReplyTarget(null);
  }, [postId]);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let canceled = false;

    const connect = async () => {
      try {
        const token = await getAuthToken();
        if (!token || !API_BASE_URL) return;
        const protocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
        const stripped = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '');
        const wsUrl = `${protocol}://${stripped}/ws?token=${encodeURIComponent(token)}`;

        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data || '{}');
            if (!payload?.type || !payload?.data) return;
            if (payload.type === 'COMMENT_CREATED' && payload.data?.post_id === postId) {
              const newComment = payload.data.comment;
              if (!newComment?.id) return;
              let wasAdded = false;
              setComments((prev) => {
                if (prev.some((c) => c.id === newComment.id)) return prev;
                wasAdded = true;
                return [newComment, ...prev];
              });
              if (wasAdded) {
                setPost((prev) =>
                  prev ? { ...prev, comments_count: Number(prev.comments_count || 0) + 1 } : prev
                );
              }
            }
            if (payload.type === 'COMMENT_LIKED' && payload.data?.post_id === postId) {
              const { comment_id, likes_count } = payload.data || {};
              setComments((prev) =>
                prev.map((c) =>
                  c.id === comment_id
                    ? { ...c, likes_count: typeof likes_count === 'number' ? likes_count : c.likes_count }
                    : c
                )
              );
            }
            if (payload.type === 'COMMENT_UNLIKED' && payload.data?.comment_id) {
              const { comment_id, likes_count } = payload.data || {};
              setComments((prev) =>
                prev.map((c) =>
                  c.id === comment_id
                    ? { ...c, likes_count: typeof likes_count === 'number' ? likes_count : c.likes_count }
                    : c
                )
              );
            }
          } catch (e) {
            // ignore
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
        // ignore
      }
    };

    connect();

    return () => {
      canceled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [postId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPost}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  const mediaUrl = getFirstMediaUrl(post);
  const caption = post?.caption || post?.content || post?.description || '';
  const authorUsername = post?.author_username || post?.author?.username || 'user';
  const authorName = post?.author_full_name || post?.author?.name || authorUsername;

  const handleLikeToggle = async (item) => {
    if (!item?.id) return;
    if (likeBusyIds[item.id]) return;
    setLikeBusyIds((prev) => ({ ...prev, [item.id]: true }));

    const wasLiked = Boolean(item.is_liked);
    setComments((prev) =>
      prev.map((c) =>
        c.id === item.id
          ? {
              ...c,
              is_liked: !wasLiked,
              likes_count: Math.max(0, Number(c.likes_count || 0) + (wasLiked ? -1 : 1)),
            }
          : c
      )
    );

    try {
      if (wasLiked) {
        await contentAPI.unlikeComment(item.id);
      } else {
        await contentAPI.likeComment(item.id);
      }
    } catch (e) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === item.id
            ? {
                ...c,
                is_liked: wasLiked,
                likes_count: Math.max(0, Number(c.likes_count || 0) + (wasLiked ? 1 : -1)),
              }
            : c
        )
      );
    } finally {
      setLikeBusyIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const renderComment = ({ item }) => {
    const commentAuthor = item?.author?.username || item?.author_username || 'user';
    const commentText = item?.content || item?.text || '';
    return (
      <View>
        <View style={styles.commentCard}>
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>{String(commentAuthor).slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.commentBody}>
            <Text style={styles.commentAuthor}>@{commentAuthor}</Text>
            <Text style={styles.commentText}>{commentText}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.commentActionButton}
                onPress={() => setReplyTarget(item)}
              >
                <Text style={styles.commentActionText}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentActionButton}
                onPress={() => handleLikeToggle(item)}
                disabled={likeBusyIds[item.id]}
              >
                <Icon
                  name={item.is_liked ? 'heart' : 'heart-outline'}
                  size={14}
                  color={item.is_liked ? colors.primary : colors.textSecondary}
                />
                <Text style={styles.commentActionText}>{Number(item.likes_count || 0)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {Array.isArray(item.replies) && item.replies.length > 0 ? (
          <View style={styles.replyGroup}>
            {item.replies.map((reply) => {
              const replyAuthor = reply?.author?.username || reply?.author_username || 'user';
              return (
                <View key={reply.id} style={styles.replyCard}>
                  <View style={styles.replyAvatar}>
                    <Text style={styles.replyAvatarText}>{String(replyAuthor).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.replyBody}>
                    <Text style={styles.replyAuthor}>@{replyAuthor}</Text>
                    <Text style={styles.replyText}>{reply?.content || ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const handleSendComment = async () => {
    const text = commentInput.trim();
    if (!text || commentSending || !postId) return;
    setCommentSending(true);
    setCommentInput('');

    try {
      const created = await contentAPI.createComment(postId, text, replyTarget?.id || null);
      if (created) {
        setComments((prev) => [created, ...prev]);
        if (created.parent_id) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === created.parent_id
                ? { ...c, replies_count: Number(c.replies_count || 0) + 1 }
                : c
            )
          );
        }
        setPost((prev) =>
          prev
            ? { ...prev, comments_count: Number(prev.comments_count || 0) + 1 }
            : prev
        );
      }
    } catch (err) {
      setCommentInput(text);
    } finally {
      setReplyTarget(null);
      setCommentSending(false);
    }
  };

  const commentTree = useMemo(() => {
    const map = new Map();
    comments.forEach((c) => {
      map.set(c.id, { ...c, replies: [] });
    });
    const roots = [];
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id).replies.push(c);
      } else {
        roots.push(c);
      }
    });

    const sortByDateDesc = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
    roots.sort(sortByDateDesc);
    roots.forEach((c) => c.replies.sort(sortByDateDesc));
    return roots;
  }, [comments]);

  const headerComponent = useMemo(
    () => (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{String(authorUsername).slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.username}>@{authorUsername}</Text>
            <Text style={styles.name}>{authorName}</Text>
          </View>
        </View>

        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Icon name="image" size={40} color={colors.textLight} />
            <Text style={styles.placeholderText}>Media unavailable</Text>
          </View>
        )}

        {post?.title ? <Text style={styles.title}>{post.title}</Text> : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon name="thumbs-up-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.metaText}>{Number(post?.likes_count || 0)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="chatbubble-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.metaText}>{Number(post?.comments_count || 0)}</Text>
          </View>
        </View>
      </View>
    ),
    [authorUsername, authorName, mediaUrl, post, caption]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={commentTree}
        keyExtractor={(item, index) => String(item?.id ?? `comment-${index}`)}
        renderItem={renderComment}
        ListHeaderComponent={headerComponent}
        ListHeaderComponentStyle={styles.headerSpacer}
        ListEmptyComponent={
          commentsLoading ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.commentsLoadingText}>Loading comments...</Text>
            </View>
          ) : (
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>No comments yet. Be the first to comment.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.content}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
        style={[styles.commentComposer, replyTarget && styles.commentComposerWithReply]}
      >
        <View style={styles.commentInputRow}>
          {replyTarget ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                Replying to @{replyTarget?.author_username || 'user'}
              </Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <Icon name="close" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TextInput
            style={styles.commentInput}
            placeholder={replyTarget ? 'Write a reply...' : 'Add a comment...'}
            placeholderTextColor={colors.textLight}
            value={commentInput}
            onChangeText={setCommentInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.commentSendButton, (!commentInput.trim() || commentSending) && styles.commentSendDisabled]}
            onPress={handleSendComment}
            disabled={!commentInput.trim() || commentSending}
          >
            {commentSending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Icon name="send" size={16} color={colors.surface} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  retryText: {
    color: colors.surface,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  username: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  name: {
    fontSize: typography.bodySmall.fontSize,
    color: colors.textSecondary,
  },
  media: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  placeholderText: {
    marginTop: spacing.sm,
    color: colors.textLight,
  },
  title: {
    fontSize: typography.h4.fontSize,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  caption: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  headerSpacer: {
    paddingBottom: spacing.md,
  },
  commentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  commentAvatarText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthor: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  commentText: {
    color: colors.textSecondary,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commentActionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  replyGroup: {
    marginLeft: 40,
    marginBottom: spacing.sm,
  },
  replyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  replyAvatarText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 10,
  },
  replyBody: {
    flex: 1,
  },
  replyAuthor: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
    fontSize: 12,
  },
  replyText: {
    color: colors.textSecondary,
    lineHeight: 18,
    fontSize: 12,
  },
  commentsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  commentsLoadingText: {
    color: colors.textSecondary,
  },
  emptyComments: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: colors.textSecondary,
  },
  commentComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  commentComposerWithReply: {
    paddingTop: spacing.lg,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    position: 'relative',
  },
  replyBanner: {
    position: 'absolute',
    top: -34,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyBannerText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    maxHeight: 120,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendDisabled: {
    opacity: 0.6,
  },
});

export default PostDetailScreen;
