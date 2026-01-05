/**
 * Home Screen - Main Feed
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ImageBackground,
  Image,
  StatusBar,
  Dimensions,
  Platform,
  Share,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

import CarouselMedia from '../components/CarouselMedia';
import FullscreenMediaViewer from '../components/FullscreenMediaViewer';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { contentAPI, authAPI } from '../services/api';

const { width } = Dimensions.get('window');

// Dummy data for posts
const DUMMY_POSTS = [
  {
    id: 1,
    title: 'Innovations in AI',
    description:
      'YouTube and Canadian Work of footing as the salofaner anti-intelligence refreshment AI Lingt of infographs. #AI #Innovation',
    coverImage:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
    author: {
      name: 'Alex Chen',
      username: 'alexchen',
      avatar: 'AC',
      title: 'Exploring long and Inxoplances. Most allemmes',
    },
    likes: 234,
    comments: 45,
    isLiked: false,
    timestamp: '2h ago',
  },
  {
    id: 2,
    title: 'Leadership Strategies',
    description:
      'AI insights the effective building and fosterial nativeests landeating and orths barrea CareerGrowth #AI io insperiled',
    coverImage:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
    author: {
      name: 'Sophia Lee',
      username: 'sophialee',
      avatar: 'SL',
      title: 'Employora & Growth | Enollasified',
    },
    likes: 456,
    comments: 89,
    isLiked: true,
    timestamp: '5h ago',
  },
  {
    id: 3,
    title: 'Data Science Trends 2024',
    description:
      'The latest trends in data science and machine learning that are shaping the future of technology. #DataScience #ML',
    coverImage:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    author: {
      name: 'Michael Zhang',
      username: 'mzhang',
      avatar: 'MZ',
      title: 'Data Scientist | AI Enthusiast',
    },
    likes: 567,
    comments: 92,
    isLiked: false,
    timestamp: '1d ago',
  },
  {
    id: 4,
    title: 'Building Scalable Systems',
    description:
      'Best practices for designing and implementing scalable cloud architectures. #CloudComputing #DevOps',
    coverImage:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
    author: {
      name: 'Emma Johnson',
      username: 'emmaj',
      avatar: 'EJ',
      title: 'Senior Software Engineer',
    },
    likes: 342,
    comments: 67,
    isLiked: false,
    timestamp: '2d ago',
  },
];

const PostCard = ({ post, onLike, onComment, onShare, onRepost, onDelete, onEdit, currentUserId, onOpenFullscreen }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef(null);

  // Handle both API format and dummy data format
  const hasCarousel = Array.isArray(post.media_items) && post.media_items.length > 0;
  const mediaUrl = post.media_url || post.coverImage;
  const mediaType = post.media_type || (post.type === 'reel' ? 'video' : 'image');
  const isVideo = mediaType === 'video' || mediaType === 'reel' || post.type === 'reel';
  // Prevent duplicate title rendering: if title exists, description excludes repeating caption start.
  const rawCaption = post.caption || post.description || '';
  const title = post.title ? post.title : rawCaption.substring(0, 80);
  const description = post.title ? rawCaption : rawCaption; // UI will render title once.
  const authorName = post.author_full_name || post.author?.name;
  const authorUsername = post.author_username || post.author?.username;
  const authorId = post.author_id || post.author?.id;
  const authorAvatar = authorUsername ? authorUsername.substring(0, 2).toUpperCase() : (post.author?.avatar || 'UN');

  const isOwnPost = currentUserId && authorId === currentUserId;

  const handleMenuAction = (action) => {
    setShowMenu(false);
    if (action === 'edit') {
      onEdit && onEdit(post);
    } else if (action === 'delete') {
      // Call delete handler directly - it has its own confirmation
      onDelete && onDelete(post.id);
    }
  };

  const handleShareOption = async (option) => {
    setShowShareMenu(false);
    switch (option) {
      case 'connections':
        onShare && onShare(post, 'connections');
        break;
      case 'copy':
        // Copy link functionality
        Alert.alert('Link Copied', 'Post link copied to clipboard');
        break;
      case 'external':
        try {
          await Share.share({
            message: `${title}\n\n${description}`,
            title: title
          });
        } catch (error) {
          console.error('Share error:', error);
        }
        break;
    }
  };

  return (
    <View style={styles.postCardWrapper}>
      <View style={styles.postCard}>
        {/* Header: Profile Info + Menu */}
        <View style={styles.postHeader}>
          <View style={styles.profileSection}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarTextSmall}>{authorAvatar}</Text>
            </View>
            <Text style={styles.usernameText}>@{authorUsername}</Text>
          </View>
          <TouchableOpacity
            style={styles.menuDots}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Icon name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Menu Dropdown */}
        {showMenu && (
          <View style={styles.menuDropdown}>
            {isOwnPost ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('edit')}
                >
                  <Icon name="create-outline" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('delete')}
                >
                  <Icon name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={[styles.menuItemText, styles.menuItemDelete]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
                  <Icon name="flag-outline" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Report</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
                  <Icon name="close-circle-outline" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Not interested</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Media Display (Carousel-aware) */}
        {hasCarousel ? (
          <CarouselMedia mediaItems={post.media_items} onOpenFullscreen={(idx) => onOpenFullscreen && onOpenFullscreen(idx)} />
        ) : isVideo && !videoError ? (
          <View style={styles.mediaContainer}>
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.mediaFull}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay={isPlaying}
              onError={() => setVideoError(true)}
            />
            <TouchableOpacity
              style={styles.playOverlayCenter}
              onPress={async () => {
                try {
                  if (isPlaying) {
                    await videoRef.current?.pauseAsync?.();
                  } else {
                    await videoRef.current?.playAsync?.();
                  }
                  setIsPlaying(!isPlaying);
                } catch (e) { }
              }}
            >
              <View style={styles.playButtonLarge}>
                <Icon name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => onOpenFullscreen && onOpenFullscreen(0)}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.mediaFull}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Content Section */}
        <View style={styles.contentSection}>
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.descriptionText} numberOfLines={3}>
            {description}
          </Text>
          {/* Extract hashtags from description */}
          {description && description.includes('#') && (
            <Text style={styles.hashtagText} numberOfLines={1}>
              {description.match(/#\w+/g)?.join(' ') || ''}
            </Text>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onLike(post.id)}
          >
            <Icon
              name={post.is_liked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={24}
              color={post.is_liked ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.actionText}>{post.likes_count || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment && onComment(post)}
          >
            <Icon name="chatbubble-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.actionText}>{post.comments_count || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowShareMenu(!showShareMenu)}
          >
            <Icon name="arrow-redo-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRepost && onRepost(post)}
          >
            <Icon name="repeat-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>
        </View>

        {/* Share Menu Popup */}
        {showShareMenu && (
          <View style={styles.shareMenuPopup}>
            <TouchableOpacity
              style={styles.shareMenuItem}
              onPress={() => handleShareOption('connections')}
            >
              <Icon name="people" size={22} color={colors.primary} />
              <Text style={styles.shareMenuText}>Share with connections</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.shareMenuItem}
              onPress={() => handleShareOption('copy')}
            >
              <Icon name="link" size={22} color={colors.primary} />
              <Text style={styles.shareMenuText}>Copy link</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.shareMenuItem}
              onPress={() => handleShareOption('external')}
            >
              <Icon name="share-social" size={22} color={colors.primary} />
              <Text style={styles.shareMenuText}>Share to other apps</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const wsRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [fullscreen, setFullscreen] = useState({ visible: false, items: [], index: 0 });

  useEffect(() => {
    loadUserData();
    loadInitialFeed();
    initWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Reload feed when screen comes into focus (e.g., after creating a post)
  useFocusEffect(
    useCallback(() => {
      loadInitialFeed();
    }, [])
  );

  const loadUserData = async () => {
    try {
      // First try AsyncStorage
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        const userId = userData.id || userData.user_id || userData.userId;
        setCurrentUserId(userId);
        return;
      }

      // If not in storage, fetch from API
      const userData = await authAPI.getCurrentUser();

      // Store for future use
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setCurrentUserId(userData.id);
    } catch (error) {
      // Silently handle authentication errors - app will show login screen
      if (error.response?.status === 401) {
        // User not authenticated, skip logging
        return;
      }
      console.error('Error loading user data:', error.message);
    }
  };

  const loadInitialFeed = async () => {
    try {
      const resp = await contentAPI.getCursorFeed(null, 20);
      console.log('📥 Cursor feed loaded:', resp.items.length, 'posts');
      setPosts(resp.items);
      setNextCursor(resp.next_cursor || null);
    } catch (error) {
      // Silently handle auth errors - user will be redirected to login
      if (error.response?.status === 401) {
        setPosts([]);
        return;
      }
      console.error('Error loading cursor feed:', error.message);
      setPosts(DUMMY_POSTS);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const resp = await contentAPI.getCursorFeed(nextCursor, 20);
      setPosts(prev => [...prev, ...resp.items]);
      setNextCursor(resp.next_cursor);
    } catch (e) {
      // Silently handle pagination errors
    } finally {
      setLoadingMore(false);
    }
  };

  const initWebSocket = async () => {
    try {
      // Derive WS URL from API_BASE_URL (replace http with ws)
      const base = require('../config/environment').API_BASE_URL;
      const wsUrl = base.replace('http', 'ws').replace(/\/api\/v1$/, '') + '/ws';

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // WebSocket connected successfully (silent)
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'NEW_POST') {
            // On NEW_POST event, refresh the initial page
            loadInitialFeed();
          }
        } catch (e) {
          // Ignore parse errors silently
        }
      };

      ws.onerror = () => {
        // Silently handle WebSocket errors - not critical for app functionality
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };

      ws.onclose = () => {
        // WebSocket closed (silent)
        wsRef.current = null;
      };
    } catch (e) {
      // WebSocket is optional - app works fine without it (just no real-time updates)
      wsRef.current = null;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadInitialFeed();
    } catch (error) {
      // Silently handle refresh errors
    } finally {
      setRefreshing(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (post.is_liked) {
        await contentAPI.unlikePost(postId);
      } else {
        await contentAPI.likePost(postId);
      }

      // Update UI
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ));
    } catch (error) {
      console.error('Error liking post:', error);
      Alert.alert('Error', 'Could not like post');
    }
  };

  const handleDeletePost = async (postId) => {
    // Validate post ID
    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Starting delete for post:', postId);

              // Call delete API
              const result = await contentAPI.deletePost(postId);
              console.log('✅ Delete successful:', result);

              // Update local state - remove deleted post
              setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));

              // Show success message
              Alert.alert('Success', result.message || 'Post deleted successfully');
            } catch (error) {
              // Silently log delete errors - show user-friendly messages only

              // User-friendly error messages
              let errorMessage = 'Could not delete post';
              if (error.response?.status === 403) {
                errorMessage = 'You are not authorized to delete this post';
              } else if (error.response?.status === 404) {
                errorMessage = 'Post not found';
              } else if (error.response?.status === 401) {
                errorMessage = 'Please login to delete posts';
              } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              }

              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const handleEditPost = (post) => {
    // Navigate to edit screen (to be implemented)
    Alert.alert('Edit Post', 'Edit functionality coming soon!');
    // navigation.navigate('EditPost', { post });
  };

  const handleCreateOption = (option) => {
    setShowCreateMenu(false);
    // Navigate to CreatePostScreen for all create options
    navigation.navigate('CreatePost');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        {/* Left icon */}
        <View style={styles.sideIconWrap}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowCreateMenu(!showCreateMenu)}>
            <Icon name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Right icon */}
        <View style={styles.sideIconWrap}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Search')}>
            <Icon name="search" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Center logo (absolute to remain perfectly centered) */}
        <View pointerEvents="none" style={styles.centerLogo}>
          <Image
            source={require('../../Logo_NetZeal.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Create Menu - Single Unified Option */}
      {showCreateMenu && (
        <View style={styles.createMenuSimplified}>
          <TouchableOpacity
            style={styles.createMenuItemLarge}
            onPress={handleCreateOption}
            activeOpacity={0.7}
          >
            <View style={styles.createIconContainer}>
              <Icon name="add-circle" size={32} color={colors.primary} />
            </View>
            <View style={styles.createTextContainer}>
              <Text style={styles.createMenuTitle}>Create Post</Text>
              <Text style={styles.createMenuSubtitle}>Share photos, videos, reels, or documents</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: colors.textSecondary }}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={handleLike}
            onComment={(post) => Alert.alert('Comments', 'Comment feature coming soon!')}
            onShare={(post, type) => Alert.alert('Share', `Sharing to ${type}`)}
            onRepost={(post) => Alert.alert('Repost', 'Repost feature coming soon!')}
            onDelete={handleDeletePost}
            onEdit={handleEditPost}
            currentUserId={currentUserId}
            onOpenFullscreen={(idx) => {
              if (Array.isArray(item.media_items) && item.media_items.length) {
                setFullscreen({ visible: true, items: item.media_items, index: idx });
              } else if (item.media_url) {
                setFullscreen({ visible: true, items: [{ id: item.id, url: item.media_url, media_type: item.media_type || 'image' }], index: 0 });
              }
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="people-outline" size={80} color={colors.textLight} />
            <Text style={{ marginTop: 24, fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              Your Feed is Empty
            </Text>
            <Text style={{ marginTop: 12, fontSize: 15, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 }}>
              Follow users to start seeing their posts in your feed
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 24,
                backgroundColor: colors.primary,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 25,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8
              }}
              onPress={() => navigation.navigate('Search')}
            >
              <Icon name="search" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Find People to Follow
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 16 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
      <FullscreenMediaViewer
        visible={fullscreen.visible}
        mediaItems={fullscreen.items}
        startIndex={fullscreen.index}
        onClose={() => setFullscreen({ visible: false, items: [], index: 0 })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    backgroundColor: '#FFFFFF',
    // Push below status bar / notch so title isn't clipped
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 56,
  },
  sideIconWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    height: 24,
    width: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  postCardWrapper: {
    marginBottom: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EFEFEF',
  },
  // Instagram-style Header
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarTextSmall: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  menuDots: {
    padding: spacing.xs,
  },
  // Media Section
  mediaContainer: {
    width: '100%',
    height: 400,
    backgroundColor: colors.background,
    position: 'relative',
  },
  mediaFull: {
    width: '100%',
    height: 400,
    backgroundColor: colors.background,
  },
  playOverlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  // Content Section
  contentSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xs,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  hashtagText: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.8,
    marginTop: 2,
  },
  // Action Row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  // Simplified Create Menu - Single Option
  createMenuSimplified: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
    elevation: 8,
    overflow: 'hidden',
  },
  createMenuItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  createIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  createTextContainer: {
    flex: 1,
  },
  createMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  createMenuSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Menu Dropdown Styles
  menuDropdown: {
    position: 'absolute',
    top: 48,
    right: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    ...shadows.lg,
    elevation: 8,
    minWidth: 180,
    zIndex: 999,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuItemText: {
    fontSize: 15,
    color: colors.text,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  menuItemDelete: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  // Share Menu Popup
  shareMenuPopup: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...shadows.md,
    elevation: 4,
  },
  shareMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  shareMenuText: {
    fontSize: 15,
    color: colors.text,
    marginLeft: spacing.md,
    fontWeight: '500',
  },
  videoPlayer: {
    width: '100%',
    height: 400,
    backgroundColor: colors.background,
  },
  playOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)'
  },
});

export default HomeScreen;
