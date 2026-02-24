/**
 * ProfileDashboardScreen
 * Complete profile screen with all sections: header, bio, projects, experience, posts, and CV upload
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Share as RNShare,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ProfileHeader from '../components/ProfileHeader';
import BioCard from '../components/BioCard';
import ProjectCarousel from '../components/ProjectCarousel';
import ExperienceList from '../components/ExperienceList';
import UserPostsFeed from '../components/UserPostsFeed';
import CVUploadCard from '../components/CVUploadCard';
import CarouselMedia from '../components/CarouselMedia';
import FullscreenMediaViewer from '../components/FullscreenMediaViewer';

import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { contentAPI, authAPI, socialAPI } from '../services/api';
import { normalizeUri } from '../utils/media';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UserProfile {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  bio?: string;
  tagline?: string;
  avatar?: string;
  peers: number;
  following: number;
}

interface Project {
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  description?: string;
}

interface Experience {
  id: string;
  title: string;
  role: string;
  year: string;
  icon?: string;
  iconUrl?: string;
}

interface Post {
  id: string;
  title?: string;
  description?: string;
  caption?: string;
  media_url?: string;
  media_type?: string;
  author_id?: string;
  author_full_name?: string;
  author_username?: string;
  is_liked?: boolean;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  media_items?: Array<any>;
  type?: string;
  [key: string]: any;
}

// ============================================================================
// SAFE DEFAULTS
// ============================================================================

const EMPTY_PROFILE: UserProfile = {
  id: '',
  username: 'user',
  fullName: '',
  email: '',
  bio: '',
  tagline: '',
  avatar: '',
  peers: 0,
  following: 0,
};

const toSafeString = (value: any): string =>
  value === null || value === undefined ? '' : String(value);

const normalizeUserId = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const id = String(value).trim();
  return id.length > 0 ? id : null;
};

const normalizeProfile = (
  data: any,
  fallback: UserProfile,
  overrides: Partial<UserProfile> = {}
): UserProfile => {
  const source = data || {};
  const username = toSafeString(
    source.username || source.user_name || fallback.username || 'user'
  );
  const fullName = toSafeString(
    source.full_name || source.fullName || source.name || fallback.fullName || username || 'User'
  );

  return {
    id: toSafeString(
      source.public_id || source.id || source.user_id || source.userId || fallback.id || 'unknown'
    ),
    username,
    fullName,
    email: toSafeString(source.email || fallback.email || ''),
    bio: toSafeString(source.bio ?? fallback.bio ?? ''),
    tagline: toSafeString(source.tagline ?? fallback.tagline ?? ''),
    avatar: toSafeString(
    source.profile_photo || source.profile_picture || source.avatar || fallback.avatar || ''
  ),
    peers: Number(source.followers_count ?? source.peers ?? source.followers ?? fallback.peers ?? 0) || 0,
    following: Number(source.following_count ?? source.following ?? fallback.following ?? 0) || 0,
    ...overrides,
  };
};

// ============================================================================
// POST CARD COMPONENT (Reused from HomeScreen)
// ============================================================================

const PostCard = ({
  post,
  onLike,
  onComment,
  onShare,
  onRepost,
  onDelete,
  onEdit,
  currentUserId,
  onOpenFullscreen,
}: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef(null);

  const hasCarousel = Array.isArray(post.media_items) && post.media_items.length > 0;
  const mediaUrl = normalizeUri(post.media_url || post.coverImage || '');
  const mediaType = post.media_type || (post.type === 'reel' ? 'video' : 'image');
  const isVideo = mediaType === 'video' || mediaType === 'reel' || post.type === 'reel';
  const rawCaption = post.caption || post.description || '';
  const title = post.title ? String(post.title) : rawCaption.substring(0, 80);
  const description = post.title ? String(rawCaption) : String(rawCaption);
  const authorName = post.author_full_name || post.author?.name || '';
  const authorUsername = post.author_username || post.author?.username || 'user';
  const authorId = post.author_id || post.author?.id || '';
  const authorAvatar = authorUsername
    ? String(authorUsername).substring(0, 2).toUpperCase()
    : post.author?.avatar || 'UN';

  const isOwnPost = currentUserId && authorId === currentUserId;

  const handleMenuAction = (action: string) => {
    setShowMenu(false);
    if (action === 'edit') {
      onEdit && onEdit(post);
    } else if (action === 'delete') {
      onDelete && onDelete(post.id);
    }
  };

  const handleShareOption = async (option: string) => {
    setShowShareMenu(false);
    switch (option) {
      case 'connections':
        onShare && onShare(post, 'connections');
        break;
      case 'copy':
        Alert.alert('Link Copied', 'Post link copied to clipboard');
        break;
      case 'external':
        try {
          await RNShare.share({
            message: `${title}\n\n${description}`,
            title: title,
          });
        } catch (error) {}
        break;
    }
  };

  return (
    <View style={styles.postCardWrapper}>
      <View style={styles.postCard}>
        {/* Header */}
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
                  <Text style={[styles.menuItemText, styles.menuItemDelete]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setShowMenu(false)}
                >
                  <Icon name="flag-outline" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Report</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setShowMenu(false)}
                >
                  <Icon name="close-circle-outline" size={18} color={colors.text} />
                  <Text style={styles.menuItemText}>Not interested</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Media Display */}
        {hasCarousel ? (
          <CarouselMedia
            mediaItems={post.media_items}
            onOpenFullscreen={(idx) => onOpenFullscreen && onOpenFullscreen(idx)}
          />
        ) : mediaUrl ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.mediaFull}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Icon name="image" size={40} color={colors.textLight} />
            <Text style={styles.mediaPlaceholderText}>Media unavailable</Text>
          </View>
        )}

        {/* Content Section */}
        <View style={styles.contentSection}>
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.descriptionText} numberOfLines={3}>
            {description}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => onLike(post.id)}>
            <Icon
              name={post.is_liked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={24}
              color={post.is_liked ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.actionText}>{Number(post.likes_count || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment && onComment(post)}
          >
            <Icon name="chatbubble-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.actionText}>{Number(post.comments_count || 0)}</Text>
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

        {/* Share Menu */}
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

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

const ProfileDashboardScreen = ({ navigation, route }: any) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null); // For viewing other users
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [fullscreen, setFullscreen] = useState({ visible: false, items: [], index: 0 });
  const scrollViewRef = useRef<ScrollView>(null);

  // Get userId from route params if viewing another user's profile
  const paramUserId = normalizeUserId(route?.params?.userId);
  const paramUsername = toSafeString(route?.params?.username);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [paramUserId])
  );

  const loadUserData = async () => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      // First get current logged-in user
      const userDataStr = await AsyncStorage.getItem('userData');
      let loggedInUserId: string | null = null;
      let storedUserData: any = null;

      if (userDataStr) {
        try {
          storedUserData = JSON.parse(userDataStr);
          loggedInUserId = normalizeUserId(
            storedUserData?.public_id || storedUserData?.id || storedUserData?.user_id || storedUserData?.userId
          );
          if (loggedInUserId) {
            setCurrentUserId(loggedInUserId);
          }
        } catch (parseError) {
          await AsyncStorage.removeItem('userData');
        }
      }

      const viewingOtherUser = Boolean(paramUserId && paramUserId !== loggedInUserId);
      const userIdToLoad = viewingOtherUser ? paramUserId : loggedInUserId;

      if (viewingOtherUser && paramUserId) {
        // Viewing another user's profile
        setIsOwnProfile(false);
        setViewingUserId(paramUserId);

        try {
          const otherUserProfile = await socialAPI.getPublicProfile(paramUserId);
          if (!otherUserProfile) {
            throw new Error('Empty profile response');
          }

          setProfile(
            normalizeProfile(otherUserProfile, EMPTY_PROFILE, {
              id: paramUserId,
              username: toSafeString(otherUserProfile.username || paramUsername || 'user'),
              tagline: '',
            })
          );
        } catch (error) {
          setProfileError('Failed to load user profile');
          setProfile(
            normalizeProfile({ username: paramUsername || 'user' }, EMPTY_PROFILE, {
              id: paramUserId,
              tagline: '',
            })
          );
        }
      } else {
        // Viewing own profile
        setIsOwnProfile(true);
        setViewingUserId(userIdToLoad);

        if (storedUserData) {
          setProfile(normalizeProfile(storedUserData, EMPTY_PROFILE));
        } else {
          const userData = await authAPI.getCurrentUser();
          if (userData) {
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            const resolvedUserId = normalizeUserId(
              userData.public_id || userData.id || userData.user_id || userData.userId
            );
            if (resolvedUserId) {
              setCurrentUserId(resolvedUserId);
              setViewingUserId(resolvedUserId);
            }
            setProfile(normalizeProfile(userData, EMPTY_PROFILE));
          } else {
            setProfileError('Failed to load your profile');
            setProfile(normalizeProfile({}, EMPTY_PROFILE));
          }
        }

        // Load projects and experience from AsyncStorage (only for own profile)
        const projectsData = await AsyncStorage.getItem('user_projects');
        const experienceData = await AsyncStorage.getItem('user_experience');

        if (projectsData) {
          try {
            setProjects(JSON.parse(projectsData));
          } catch (parseError) {}
        }
        if (experienceData) {
          try {
            setExperience(JSON.parse(experienceData));
          } catch (parseError) {}
        }
      }

      await loadUserPosts(userIdToLoad);
    } catch (error) {
      setProfileError('Failed to load profile');
      setProfile(normalizeProfile({}, EMPTY_PROFILE));
      await loadUserPosts(paramUserId || currentUserId);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadUserPosts = async (userIdOverride?: string | null) => {
    try {
      setLoading(true);
      // Load posts for the user being viewed (own or other user)
      const userIdToLoad = userIdOverride || viewingUserId || currentUserId;
      if (userIdToLoad) {
        const response = await contentAPI.getUserPosts(userIdToLoad, 0, 20);
        if (Array.isArray(response)) {
          setUserPosts(response);
        } else if (Array.isArray(response?.items)) {
          setUserPosts(response.items);
        } else {
          setUserPosts([]);
        }
      } else {
        setUserPosts([]);
      }
    } catch (error) {
      setUserPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserPosts(viewingUserId || currentUserId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const post = userPosts.find((p) => p.id === postId);
      if (post?.is_liked) {
        await contentAPI.unlikePost(postId);
      } else {
        await contentAPI.likePost(postId);
      }
      setUserPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
              ...p,
              is_liked: !p.is_liked,
              likes_count: (p.likes_count || 0) + (p.is_liked ? -1 : 1),
            }
            : p
        )
      );
    } catch (error) {
    }
  };

  const handleComment = (post: Post) => {
    navigation.navigate('Chat', { postId: post.id });
  };

  const handleShare = async (post: Post) => {
    try {
      await contentAPI.sharePost(post.id, 'connections');
      Alert.alert('Success', 'Post shared with your connections');
    } catch (error) {
    }
  };

  const handleRepost = async (post: Post) => {
    try {
      await contentAPI.repostContent(post.id);
      Alert.alert('Success', 'Post reposted');
      await loadUserPosts();
    } catch (error) {
    }
  };

  const handleDelete = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', onPress: () => { } },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await contentAPI.deletePost(postId);
            setUserPosts((prev) => prev.filter((p) => p.id !== postId));
            Alert.alert('Success', 'Post deleted');
          } catch (error) {}
        },
        style: 'destructive',
      },
    ]);
  };

  const handleEdit = (post: Post) => {
    navigation.navigate('CreatePost', { postToEdit: post });
  };

  const handleCVUpload = () => {
    Alert.alert('CV Upload', 'CV/Resume upload functionality');
  };

  const handleOpenFullscreen = (index: number) => {
    if (userPosts.length > 0) {
      const items = userPosts
        .map((p) => ({
          id: p.id,
          url: normalizeUri(p.media_url),
          media_type: p.media_type || 'image',
        }))
        .filter((item) => item.url);
      if (items.length > 0) {
        const safeIndex = Math.min(index, items.length - 1);
        setFullscreen({
          visible: true,
          items,
          index: safeIndex,
        });
      }
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayProfile = profile || normalizeProfile({}, EMPTY_PROFILE);
  const displayName = displayProfile.fullName || displayProfile.username || 'User';
  const displayTagline = displayProfile.tagline || '';
  const displayBio = displayProfile.bio || '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header with background */}
        <View style={styles.headerBackground}>
          <View style={styles.headerContent}>
            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Icon name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            <Image
              source={require('../../Logo_NetZeal.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Icon name="settings-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Main Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Profile Header */}
          <ProfileHeader
            name={displayName}
            tagline={displayTagline}
            peers={displayProfile.peers || 0}
            following={displayProfile.following || 0}
            avatarUrl={displayProfile.avatar}
          />

          {profileError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{profileError}</Text>
            </View>
          )}

          {/* Bio Card */}
          {displayBio ? (
            <BioCard title="Professional Bio" description={displayBio} />
          ) : null}

          {/* Projects Carousel - Only show for own profile */}
          {isOwnProfile && projects.length > 0 && (
            <ProjectCarousel
              projects={projects}
              onProjectPress={(project) => {
                Alert.alert(project.title, project.description || '');
              }}
            />
          )}

          {/* Experience List - Only show for own profile */}
          {isOwnProfile && experience.length > 0 && (
            <ExperienceList
              title="Portfolio & Experience"
              experiences={experience}
              onItemPress={(exp) => {
                Alert.alert(exp.title, exp.role);
              }}
            />
          )}

          {/* Posts Feed */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <UserPostsFeed
              posts={userPosts}
              loading={loading}
              renderPostItem={(post, handlers) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handlers.onLike}
                  onComment={handlers.onComment}
                  onShare={handlers.onShare}
                  onRepost={handlers.onRepost}
                  onDelete={handlers.onDelete}
                  onEdit={handlers.onEdit}
                  onOpenFullscreen={handlers.onOpenFullscreen}
                  currentUserId={currentUserId}
                />
              )}
              onPostLike={handleLike}
              onPostComment={handleComment}
              onPostShare={handleShare}
              onPostRepost={handleRepost}
              onPostDelete={handleDelete}
              onPostEdit={handleEdit}
              onOpenFullscreen={handleOpenFullscreen}
            />
          )}

          {/* Space for sticky CV card */}
          {isOwnProfile && <View style={styles.cvCardSpacer} />}
        </ScrollView>

        {/* Sticky CV Upload Card - Only show for own profile */}
        {isOwnProfile && <CVUploadCard onPress={handleCVUpload} isSticky />}

        {/* Fullscreen Media Viewer */}
        <FullscreenMediaViewer
          visible={fullscreen.visible}
          mediaItems={fullscreen.items}
          startIndex={fullscreen.index}
          onClose={() => setFullscreen({ ...fullscreen, visible: false })}
        />
      </View>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBackground: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: spacing.xs,
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.bodySmall.fontSize,
    color: colors.textSecondary,
  },
  cvCardSpacer: {
    height: 120,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.bodySmall.fontSize,
  },

  // Post Card Styles
  postCardWrapper: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarTextSmall: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  usernameText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  menuDots: {
    padding: spacing.sm,
  },
  menuDropdown: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuItemText: {
    marginLeft: spacing.sm,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  menuItemDelete: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  mediaFull: {
    width: '100%',
    height: 250,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPlaceholderText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
  },
  contentSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: typography.bodySmall.fontSize,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  shareMenuPopup: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  shareMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareMenuText: {
    marginLeft: spacing.sm,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
});

export default ProfileDashboardScreen;
