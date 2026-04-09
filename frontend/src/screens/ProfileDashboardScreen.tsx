/**
 * ProfileDashboardScreen
 * Complete profile screen with all sections: header, bio, projects, experience, posts, and CV upload
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toSafeString = (value: any): string =>
  value === null || value === undefined ? '' : String(value);

const normalizeUserId = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const id = String(value).trim();
  return id.length > 0 ? id : null;
};

const normalizeInternalUserId = (...values: any[]): number | null => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }
  return null;
};

const extractApiErrorMessage = (error: any, fallback: string): string => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail === 'object') {
    const innerDetail = detail?.message || detail?.error || detail?.detail;
    if (typeof innerDetail === 'string' && innerDetail.trim()) {
      return innerDetail;
    }
  }
  const message = error?.userMessage || error?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
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

const mapProjectsFromProfilePayload = (projectItems: any[] = []): Project[] => {
  return (Array.isArray(projectItems) ? projectItems : [])
    .map((item, index) => ({
      id: toSafeString(item?.id || `project-${index}`),
      title: toSafeString(item?.title || item?.content || 'Project'),
      subtitle: toSafeString(item?.type || 'Project'),
      description: toSafeString(item?.content || ''),
    }))
    .filter((item) => item.title.length > 0);
};

const normalizeMediaItems = (mediaItems: any[] = []): any[] => {
  return (Array.isArray(mediaItems) ? mediaItems : [])
    .map((item) => {
      const resolvedUrl = normalizeUri(
        item?.url || item?.media_url || item?.thumb_url || item?.thumbnail_url || ''
      );
      if (!resolvedUrl) {
        return null;
      }
      return {
        ...item,
        url: resolvedUrl,
        media_type: item?.media_type || item?.type || 'image',
      };
    })
    .filter(Boolean);
};

const normalizePostsPayload = (rawPosts: any[] = []): Post[] => {
  const sourcePosts = Array.isArray(rawPosts) ? rawPosts : [];
  const seen = new Set<string>();
  const normalized: Post[] = [];

  sourcePosts.forEach((rawPost, index) => {
    const postId = toSafeString(rawPost?.id || rawPost?.post_id || rawPost?.uuid || `post-${index}`);
    if (!postId || seen.has(postId)) {
      return;
    }

    const mediaUrls = Array.isArray(rawPost?.media_urls)
      ? rawPost.media_urls.map((url: any) => normalizeUri(url)).filter(Boolean)
      : [];
    const mediaItems = normalizeMediaItems(rawPost?.media_items || []);
    const primaryMediaUrl = normalizeUri(
      rawPost?.media_url ||
        rawPost?.thumbnail_url ||
        rawPost?.image_url ||
        mediaUrls[0] ||
        mediaItems[0]?.url ||
        ''
    );

    const normalizedPost: Post = {
      ...rawPost,
      id: postId,
      title: toSafeString(rawPost?.title || ''),
      caption: toSafeString(rawPost?.caption ?? rawPost?.content ?? ''),
      description: toSafeString(rawPost?.description ?? rawPost?.content ?? ''),
      media_url: primaryMediaUrl || '',
      media_type: toSafeString(rawPost?.media_type || rawPost?.type || rawPost?.content_type || 'image').toLowerCase(),
      media_items: mediaItems.length > 0 ? mediaItems : undefined,
      author_id: toSafeString(rawPost?.author_id || rawPost?.author?.id || ''),
      author_full_name: toSafeString(rawPost?.author_full_name || rawPost?.author?.full_name || rawPost?.author?.name || ''),
      author_username: toSafeString(rawPost?.author_username || rawPost?.author?.username || ''),
      likes_count: Number(rawPost?.likes_count || 0) || 0,
      comments_count: Number(rawPost?.comments_count || 0) || 0,
    };

    normalized.push(normalizedPost);
    seen.add(postId);
  });

  return normalized;
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
  const hasExplicitTitle = Boolean(post.title && String(post.title).trim());
  const title = hasExplicitTitle ? String(post.title) : '';
  const description = String(rawCaption);
  const authorName = post.author_full_name || post.author?.name || '';
  const authorUsername = post.author_username || post.author?.username || 'user';
  const authorId = post.author_id || post.author?.id || '';
  const authorAvatar = authorUsername
    ? String(authorUsername).substring(0, 2).toUpperCase()
    : post.author?.avatar || 'UN';

  const isOwnPost = String(authorId || '') === String(currentUserId || '');

  useEffect(() => {
    return () => {
      videoRef.current?.pauseAsync?.().catch(() => { });
      videoRef.current?.unloadAsync?.().catch(() => { });
    };
  }, []);

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
          {hasExplicitTitle ? (
            <Text style={styles.titleText} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
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

        </View>

        {/* Share Menu */}
        {showShareMenu && (
          <View style={styles.shareMenuPopup}>
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
  const [cvUploading, setCvUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInternalId, setCurrentUserInternalId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null); // For viewing other users
  const [viewingUserInternalId, setViewingUserInternalId] = useState<number | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState({ visible: false, items: [], index: 0 });
  const scrollViewRef = useRef<ScrollView>(null);

  // Get userId from route params if viewing another user's profile
  const paramUserId = normalizeUserId(route?.params?.userId);
  const paramUsername = toSafeString(route?.params?.username);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [paramUserId, paramUsername])
  );

  const loadUserData = async () => {
    setProfileLoading(true);
    setProfileError(null);
    let loadedPostsFromFullProfile = false;
    let loadedProjectsFromFullProfile = false;

    try {
      // First get current logged-in user
      const userDataStr = await AsyncStorage.getItem('userData');
      const legacyUserDataStr = await AsyncStorage.getItem('user_data');
      let loggedInUserId: string | null = null;
      let loggedInUserInternalId: number | null = null;
      let loggedInUsername = '';
      let storedUserData: any = null;

      if (userDataStr || legacyUserDataStr) {
        try {
          storedUserData = JSON.parse(userDataStr || legacyUserDataStr || '{}');
          loggedInUserId = normalizeUserId(
            storedUserData?.public_id || storedUserData?.id || storedUserData?.user_id || storedUserData?.userId
          );
          if (loggedInUserId) {
            setCurrentUserId(loggedInUserId);
          }
          const resolvedInternalId = normalizeInternalUserId(
            storedUserData?.id,
            storedUserData?.user_id,
            storedUserData?.userId
          );
          if (resolvedInternalId) {
            setCurrentUserInternalId(resolvedInternalId);
            loggedInUserInternalId = resolvedInternalId;
          }
          loggedInUsername = toSafeString(storedUserData?.username).trim().toLowerCase();
          if (loggedInUsername) {
            setCurrentUsername(loggedInUsername);
          }
        } catch (parseError) {
          await AsyncStorage.removeItem('userData');
        }
      }

      // Storage can occasionally miss public_id/username; fetch auth profile once for reliable self checks.
      if (!loggedInUserId || !loggedInUserInternalId || !loggedInUsername) {
        try {
          const latestUser = await authAPI.getCurrentUser();
          if (latestUser) {
            storedUserData = latestUser;

            const resolvedPublicId = normalizeUserId(
              latestUser?.public_id || latestUser?.id || latestUser?.user_id || latestUser?.userId
            );
            if (resolvedPublicId) {
              loggedInUserId = resolvedPublicId;
              setCurrentUserId(resolvedPublicId);
            }

            const resolvedInternalId = normalizeInternalUserId(
              latestUser?.id,
              latestUser?.user_id,
              latestUser?.userId
            );
            if (resolvedInternalId) {
              loggedInUserInternalId = resolvedInternalId;
              setCurrentUserInternalId(resolvedInternalId);
            }

            const resolvedUsername = toSafeString(latestUser?.username).trim().toLowerCase();
            if (resolvedUsername) {
              loggedInUsername = resolvedUsername;
              setCurrentUsername(resolvedUsername);
            }

            await AsyncStorage.setItem('userData', JSON.stringify(latestUser));
            await AsyncStorage.setItem('user_data', JSON.stringify(latestUser));
          }
        } catch (identityError) {
          // Keep best-effort identity from storage when network call fails.
        }
      }

      const normalizedParamUsername = toSafeString(paramUsername).trim().toLowerCase();
      const paramUserInternalId = normalizeInternalUserId(paramUserId);
      const isSameByPublicId = Boolean(paramUserId && loggedInUserId && paramUserId === loggedInUserId);
      const isSameByInternalId = Boolean(
        paramUserInternalId &&
        loggedInUserInternalId &&
        paramUserInternalId === loggedInUserInternalId
      );
      const isSameByUsername = Boolean(
        normalizedParamUsername &&
        loggedInUsername &&
        normalizedParamUsername === loggedInUsername
      );

      const viewingOtherUser = Boolean(
        (paramUserId && !isSameByPublicId && !isSameByInternalId) ||
        (!paramUserId && normalizedParamUsername && !isSameByUsername)
      );
      const userIdToLoad = viewingOtherUser ? paramUserId : loggedInUserId;

      if (viewingOtherUser) {
        // Viewing another user's profile
        setIsOwnProfile(false);
        setViewingUserId(paramUserId || null);
        setViewingUserInternalId(null);
        setIsFollowing(false);

        try {
          if (paramUserId && UUID_REGEX.test(paramUserId)) {
            const fullProfile = await socialAPI.getPublicProfileFull(paramUserId);
            if (!fullProfile?.user) {
              throw new Error('Empty profile response');
            }

            const otherUserProfile = fullProfile.user;
            setProfile(
              normalizeProfile(otherUserProfile, EMPTY_PROFILE, {
                id: paramUserId,
                username: toSafeString(otherUserProfile.username || paramUsername || 'user'),
                tagline: '',
              })
            );
            setViewingUserInternalId(
              normalizeInternalUserId(
                otherUserProfile?.internal_id,
                otherUserProfile?.user_id,
                otherUserProfile?.id
              )
            );
            setIsFollowing(Boolean(otherUserProfile?.is_following));

            const projectCards = mapProjectsFromProfilePayload(fullProfile.projects || []);
            setProjects(projectCards);
            loadedProjectsFromFullProfile = projectCards.length > 0;

            const profilePosts = [
              ...(Array.isArray(fullProfile.posts) ? fullProfile.posts : []),
              ...(Array.isArray(fullProfile.shorts) ? fullProfile.shorts : []),
            ];
            const normalizedPosts = normalizePostsPayload(profilePosts);
            setUserPosts(normalizedPosts);
            if (normalizedPosts.length > 0) {
              setLoading(false);
              loadedPostsFromFullProfile = true;
            }
          } else if (paramUserId) {
            const otherUserProfile = await authAPI.getUserProfile(paramUserId);
            setProfile(
              normalizeProfile(otherUserProfile, EMPTY_PROFILE, {
                id: paramUserId,
                username: toSafeString(otherUserProfile?.username || paramUsername || 'user'),
                tagline: '',
              })
            );
            setViewingUserInternalId(
              normalizeInternalUserId(otherUserProfile?.id, otherUserProfile?.user_id)
            );
            setIsFollowing(Boolean(otherUserProfile?.is_following));
          } else if (paramUsername) {
            const fullProfile = await socialAPI.getProfileByUsername(paramUsername);
            if (!fullProfile?.user) {
              throw new Error('Empty username profile response');
            }

            const otherUserProfile = fullProfile.user;
            const resolvedPublicId = normalizeUserId(
              otherUserProfile?.id || otherUserProfile?.public_id
            );
            setViewingUserId(resolvedPublicId || null);
            setProfile(
              normalizeProfile(otherUserProfile, EMPTY_PROFILE, {
                id: resolvedPublicId || '',
                username: toSafeString(otherUserProfile?.username || paramUsername || 'user'),
                tagline: '',
              })
            );
            setViewingUserInternalId(
              normalizeInternalUserId(
                otherUserProfile?.internal_id,
                otherUserProfile?.user_id,
                otherUserProfile?.id
              )
            );
            setIsFollowing(Boolean(otherUserProfile?.is_following));

            const projectCards = mapProjectsFromProfilePayload(fullProfile.projects || []);
            setProjects(projectCards);
            loadedProjectsFromFullProfile = projectCards.length > 0;

            const profilePosts = [
              ...(Array.isArray(fullProfile.posts) ? fullProfile.posts : []),
              ...(Array.isArray(fullProfile.shorts) ? fullProfile.shorts : []),
            ];
            const normalizedPosts = normalizePostsPayload(profilePosts);
            setUserPosts(normalizedPosts);
            if (normalizedPosts.length > 0) {
              setLoading(false);
              loadedPostsFromFullProfile = true;
            }
          }
        } catch (error) {
          setProfileError('Failed to load user profile');
          setIsFollowing(false);
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
        setViewingUserInternalId(null);
        setIsFollowing(false);

        if (storedUserData) {
          setProfile(normalizeProfile(storedUserData, EMPTY_PROFILE));
        } else {
          const userData = await authAPI.getCurrentUser();
          if (userData) {
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            await AsyncStorage.setItem('user_data', JSON.stringify(userData));
            const resolvedUserId = normalizeUserId(
              userData.public_id || userData.id || userData.user_id || userData.userId
            );
            if (resolvedUserId) {
              setCurrentUserId(resolvedUserId);
              setViewingUserId(resolvedUserId);
            }
            const resolvedInternalId = normalizeInternalUserId(
              userData?.id,
              userData?.user_id,
              userData?.userId
            );
            if (resolvedInternalId) {
              setCurrentUserInternalId(resolvedInternalId);
              loggedInUserInternalId = resolvedInternalId;
            }
            const resolvedUsername = toSafeString(userData?.username).trim().toLowerCase();
            if (resolvedUsername) {
              setCurrentUsername(resolvedUsername);
              loggedInUsername = resolvedUsername;
            }
            setProfile(normalizeProfile(userData, EMPTY_PROFILE));
          } else {
            setProfileError('Failed to load your profile');
            setProfile(normalizeProfile({}, EMPTY_PROFILE));
          }
        }

        const resolvedPublicId = normalizeUserId(
          storedUserData?.public_id || storedUserData?.id || storedUserData?.user_id || storedUserData?.userId || userIdToLoad
        );

        if (resolvedPublicId && UUID_REGEX.test(resolvedPublicId)) {
          try {
            const fullProfile = await socialAPI.getPublicProfileFull(resolvedPublicId);
            if (fullProfile?.user) {
              setProfile((prev) =>
                normalizeProfile(
                  fullProfile.user,
                  prev || EMPTY_PROFILE,
                  { id: resolvedPublicId }
                )
              );
            }

            const projectCards = mapProjectsFromProfilePayload(fullProfile?.projects || []);
            if (projectCards.length > 0) {
              setProjects(projectCards);
              loadedProjectsFromFullProfile = true;
            }

            const profilePosts = [
              ...(Array.isArray(fullProfile?.posts) ? fullProfile.posts : []),
              ...(Array.isArray(fullProfile?.shorts) ? fullProfile.shorts : []),
            ];
            const normalizedPosts = normalizePostsPayload(profilePosts);
            if (normalizedPosts.length > 0) {
              setUserPosts(normalizedPosts);
              setLoading(false);
              loadedPostsFromFullProfile = true;
            }
          } catch (error) {}
        }

        // Load projects and experience from AsyncStorage (only for own profile)
        const projectsData = await AsyncStorage.getItem('user_projects');
        const experienceData = await AsyncStorage.getItem('user_experience');

        if (projectsData && !loadedProjectsFromFullProfile) {
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

      const effectiveUserId =
        userIdToLoad ||
        viewingUserId ||
        loggedInUserId ||
        normalizeUserId(storedUserData?.public_id || storedUserData?.id || storedUserData?.user_id || storedUserData?.userId);

      if (!loadedPostsFromFullProfile) {
        await loadUserPosts(effectiveUserId);
      }
    } catch (error) {
      setProfileError('Failed to load profile');
      setProfile(normalizeProfile({}, EMPTY_PROFILE));
      if (!loadedPostsFromFullProfile) {
        await loadUserPosts(paramUserId || currentUserId);
      }
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
          setUserPosts(normalizePostsPayload(response));
        } else if (Array.isArray(response?.items)) {
          setUserPosts(normalizePostsPayload(response.items));
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
      await RNShare.share({
        message: `${post.title || 'NetZeal Post'}\n\n${post.caption || post.description || ''}`,
        title: post.title || 'NetZeal Post',
      });
    } catch (error) {
    }
  };

  const handleRepost = async (post: Post) => {
    Alert.alert('Unavailable', 'Repost is currently unavailable in this build.');
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

  const handleMessagePress = useCallback(async () => {
    const isSameInternalUser = Boolean(
      viewingUserInternalId && currentUserInternalId && viewingUserInternalId === currentUserInternalId
    );
    const isSamePublicUser = Boolean(
      viewingUserId && currentUserId && String(viewingUserId) === String(currentUserId)
    );

    if (isSameInternalUser || isSamePublicUser) {
      Alert.alert('Unavailable', 'You cannot message yourself.');
      return;
    }

    let targetInternalId = viewingUserInternalId;
    if (!targetInternalId && viewingUserId && UUID_REGEX.test(viewingUserId)) {
      try {
        const fullProfile = await socialAPI.getPublicProfileFull(viewingUserId);
        const resolvedId = normalizeInternalUserId(
          fullProfile?.user?.internal_id,
          fullProfile?.user?.id,
          fullProfile?.user?.user_id
        );
        if (resolvedId) {
          targetInternalId = resolvedId;
          setViewingUserInternalId(resolvedId);
        }
      } catch (error) {
        // Keep graceful fallback below
      }
    }

    if (!targetInternalId) {
      Alert.alert('Unavailable', 'Message is not available for this profile yet.');
      return;
    }

    navigation.navigate('Chat', {
      userId: targetInternalId,
      username: profile?.username,
      conversationTitle: profile?.fullName || profile?.username || 'Chat',
    });
  }, [
    navigation,
    viewingUserInternalId,
    viewingUserId,
    currentUserInternalId,
    currentUserId,
    profile?.username,
    profile?.fullName,
  ]);

  const handleFollowToggle = useCallback(async () => {
    if (isOwnProfile || followLoading) {
      return;
    }

    const targetPublicId = viewingUserId;
    const targetInternalId = viewingUserInternalId;
    const isSameInternalUser = Boolean(
      targetInternalId && currentUserInternalId && targetInternalId === currentUserInternalId
    );
    const isSamePublicUser = Boolean(
      targetPublicId && currentUserId && String(targetPublicId) === String(currentUserId)
    );

    if (isSameInternalUser || isSamePublicUser) {
      Alert.alert('Unavailable', 'You cannot follow yourself.');
      return;
    }

    if (!targetPublicId && !targetInternalId) {
      Alert.alert('Error', 'Unable to update follow status for this user.');
      return;
    }

    const wasFollowing = isFollowing;
    const followerDelta = wasFollowing ? -1 : 1;

    setFollowLoading(true);
    setIsFollowing(!wasFollowing);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            peers: Math.max(0, (Number(prev.peers) || 0) + followerDelta),
          }
        : prev
    );

    try {
      if (targetInternalId) {
        if (wasFollowing) {
          await socialAPI.unfollowUser(targetInternalId);
        } else {
          await socialAPI.followUser(targetInternalId);
        }
      } else if (targetPublicId && UUID_REGEX.test(targetPublicId)) {
        await socialAPI.toggleConnection(targetPublicId);
      } else {
        throw new Error('No valid user id for follow action');
      }
    } catch (error) {
      // Fallback: if internal-id API failed but public UUID exists, try graph toggle once.
      let resolved = false;
      if (targetPublicId && UUID_REGEX.test(targetPublicId) && targetInternalId) {
        try {
          await socialAPI.toggleConnection(targetPublicId);
          resolved = true;
        } catch (fallbackError) {
          resolved = false;
        }
      }

      if (!resolved) {
        setIsFollowing(wasFollowing);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                peers: Math.max(0, (Number(prev.peers) || 0) - followerDelta),
              }
            : prev
        );
        Alert.alert('Error', extractApiErrorMessage(error, 'Failed to update follow status.'));
      }
    } finally {
      setFollowLoading(false);
    }
  }, [
    isOwnProfile,
    followLoading,
    isFollowing,
    viewingUserId,
    viewingUserInternalId,
    currentUserInternalId,
    currentUserId,
  ]);

  const handleCVUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = result.assets?.[0];
      if (!selectedFile) {
        Alert.alert('Upload Error', 'No file selected.');
        return;
      }

      const isPdfByMime = selectedFile.mimeType === 'application/pdf';
      const isPdfByName = String(selectedFile.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdfByMime && !isPdfByName) {
        Alert.alert('Invalid File', 'Please select a PDF file.');
        return;
      }

      const maxSizeBytes = 10 * 1024 * 1024;
      if (typeof selectedFile.size === 'number' && selectedFile.size > maxSizeBytes) {
        Alert.alert('File Too Large', 'PDF must be 10MB or smaller.');
        return;
      }

      setCvUploading(true);
      await authAPI.uploadResume(selectedFile);

      const latestUser = await authAPI.getCurrentUser();
      await AsyncStorage.setItem('userData', JSON.stringify(latestUser));
      await AsyncStorage.setItem('user_data', JSON.stringify(latestUser));

      Alert.alert('Success', 'CV uploaded successfully.');
    } catch (error: any) {
      Alert.alert('Upload Error', error?.userMessage || error?.response?.data?.detail || 'Failed to upload CV.');
    } finally {
      setCvUploading(false);
    }
  };

  const handleOpenFullscreen = (index: number) => {
    if (userPosts.length > 0) {
      const items = userPosts
        .flatMap((p) => {
          if (Array.isArray(p.media_items) && p.media_items.length > 0) {
            return p.media_items
              .map((m: any, mediaIndex: number) => ({
                id: `${p.id}-${mediaIndex}`,
                url: normalizeUri(m?.url || m?.media_url || m?.thumbnail_url || ''),
                media_type: m?.media_type || m?.type || p.media_type || 'image',
              }))
              .filter((item: any) => Boolean(item.url));
          }

          return [
            {
              id: p.id,
              url: normalizeUri(
                p.media_url || (Array.isArray(p.media_urls) ? p.media_urls[0] : '')
              ),
              media_type: p.media_type || p.type || 'image',
            },
          ];
        })
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
        <View style={styles.profileLoadingContainer}>
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
  const normalizedDisplayUsername = toSafeString(displayProfile.username).trim().toLowerCase();
  const displayProfilePublicId = normalizeUserId(displayProfile.id);
  const displayProfileInternalId = normalizeInternalUserId(
    (profile as any)?.internal_id,
    (profile as any)?.user_id,
    (profile as any)?.id,
    viewingUserInternalId
  );
  const normalizedParamUsername = toSafeString(paramUsername).trim().toLowerCase();
  const paramInternalId = normalizeInternalUserId(paramUserId);
  const isSameByPublicRoute = Boolean(
    paramUserId && currentUserId && String(paramUserId) === String(currentUserId)
  );
  const isSameByInternalRoute = Boolean(
    paramInternalId && currentUserInternalId && paramInternalId === currentUserInternalId
  );
  const isSameByUsernameRoute = Boolean(
    normalizedParamUsername &&
    currentUsername &&
    normalizedParamUsername === currentUsername
  );
  const isOtherProfileByRoute = Boolean(
    (paramUserId && !isSameByPublicRoute && !isSameByInternalRoute) ||
    (!paramUserId && normalizedParamUsername && !isSameByUsernameRoute)
  );
  const isSameInternalUser = Boolean(
    viewingUserInternalId && currentUserInternalId && viewingUserInternalId === currentUserInternalId
  );
  const isSamePublicUser = Boolean(
    viewingUserId && currentUserId && String(viewingUserId) === String(currentUserId)
  );
  const isSameByDisplayedPublicId = Boolean(
    displayProfilePublicId && currentUserId && String(displayProfilePublicId) === String(currentUserId)
  );
  const isSameByDisplayedInternalId = Boolean(
    displayProfileInternalId && currentUserInternalId && displayProfileInternalId === currentUserInternalId
  );
  const isSameByDisplayedUsername = Boolean(
    normalizedDisplayUsername &&
    currentUsername &&
    normalizedDisplayUsername === currentUsername
  );
  const isActuallyOwnProfile =
    isOwnProfile ||
    isSameInternalUser ||
    isSamePublicUser ||
    isSameByPublicRoute ||
    isSameByInternalRoute ||
    isSameByUsernameRoute ||
    isSameByDisplayedPublicId ||
    isSameByDisplayedInternalId ||
    isSameByDisplayedUsername;
  const showSocialActions = !isActuallyOwnProfile && isOtherProfileByRoute;
  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header with background */}
        <View style={styles.headerBackground}>
          <View style={styles.headerContent}>
            {showSocialActions && canGoBack && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Icon name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            <Image
              source={require('../../assets/netzeal-app-logo.png')}
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
            {showSocialActions && (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={handleMessagePress}
              >
                <Icon name="chatbubble-outline" size={22} color={colors.primary} />
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

          {showSocialActions && (
            <View style={styles.profileActionRow}>
              <TouchableOpacity
                style={[
                  styles.followActionButton,
                  isFollowing && styles.followingActionButton,
                  followLoading && styles.profileActionDisabled,
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                <Text
                  style={[
                    styles.followActionText,
                    isFollowing && styles.followingActionText,
                  ]}
                >
                  {followLoading ? 'Please wait...' : isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageActionButton}
                onPress={handleMessagePress}
              >
                <Text style={styles.messageActionText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}

          {profileError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{profileError}</Text>
            </View>
          )}

          {/* Bio Card */}
          {displayBio ? (
            <BioCard title="Professional Bio" description={displayBio} />
          ) : null}

          {/* Projects Carousel */}
          {projects.length > 0 && (
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
        {isOwnProfile && <CVUploadCard onPress={handleCVUpload} isSticky loading={cvUploading} />}

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
  profileLoadingContainer: {
    flex: 1,
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
  profileActionRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  followActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  followingActionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  followActionText: {
    color: colors.surface,
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  followingActionText: {
    color: colors.text,
  },
  messageActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  messageActionText: {
    color: colors.text,
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  profileActionDisabled: {
    opacity: 0.6,
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
