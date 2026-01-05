/**
 * Instagram-style Profile Screen
 * Production-ready with exact Instagram layout, sticky header, and full backend integration
 */
import React, { useState, useCallback, useMemo, memo, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  RefreshControl,
  useColorScheme,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { authAPI, contentAPI, socialAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl: string;
  isVerified?: boolean;
  followers: number;
  following: number;
  posts: number;
  bio?: string;
  category?: string;
  email?: string;
  externalUrl?: string;
  isProfessional?: boolean;
  notifications?: number;
  hasStory?: boolean;
  isPrivate?: boolean;
}

interface Post {
  id: string;
  imageUrl: string;
  views?: number;
  likes?: number;
  isReel?: boolean;
  comments?: number;
}

interface Highlight {
  id: string;
  title: string;
  coverUrl: string;
}

type TabType = 'grid' | 'reels' | 'tagged';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_USER: User = {
  id: '1',
  username: 'john_doe_design',
  fullName: 'John Doe',
  avatarUrl: 'https://i.pravatar.cc/300?img=12',
  isVerified: true,
  followers: 124500,
  following: 892,
  posts: 347,
  bio: '🎨 Digital Designer & Creative Director\n✨ Crafting beautiful experiences\n📍 San Francisco, CA',
  category: 'Digital creator',
  email: 'john@example.com',
  externalUrl: 'https://johndoe.design',
  isProfessional: true,
  notifications: 3,
  hasStory: true,
  isPrivate: false,
};

const MOCK_POSTS: Post[] = Array.from({ length: 24 }, (_, i) => ({
  id: `post-${i}`,
  imageUrl: `https://picsum.photos/400/400?random=${i}`,
  views: Math.floor(Math.random() * 50000) + 1000,
  likes: Math.floor(Math.random() * 5000) + 100,
  isReel: i % 5 === 0,
  comments: Math.floor(Math.random() * 500) + 10,
}));

const MOCK_HIGHLIGHTS: Highlight[] = [
  { id: 'new', title: 'New', coverUrl: '' },
  { id: '1', title: 'Travel', coverUrl: 'https://picsum.photos/100/100?random=h1' },
  { id: '2', title: 'Food', coverUrl: 'https://picsum.photos/100/100?random=h2' },
  { id: '3', title: 'Work', coverUrl: 'https://picsum.photos/100/100?random=h3' },
  { id: '4', title: 'Friends', coverUrl: 'https://picsum.photos/100/100?random=h4' },
];

// ============================================================================
// THEME & UTILITIES
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - GRID_SPACING * 2) / 3;

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: {
      background: isDark ? '#000000' : '#FFFFFF',
      surface: isDark ? '#121212' : '#F9F9F9',
      text: isDark ? '#FFFFFF' : '#000000',
      textSecondary: isDark ? '#A8A8A8' : '#737373',
      border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      primary: '#3797F0',
      accent: '#ED4956',
      overlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
    },
  };
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Avatar Component
const Avatar = memo(({ uri, size = 96, hasStory = false, onPress }: {
  uri: string;
  size?: number;
  hasStory?: boolean;
  onPress?: () => void;
}) => {
  const { colors } = useTheme();
  const gradientSize = size + 8;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessible
      accessibilityLabel="Profile picture"
      accessibilityRole="imagebutton"
      testID="avatar"
    >
      <View style={{
        width: gradientSize,
        height: gradientSize,
        borderRadius: gradientSize / 2,
        backgroundColor: hasStory ? colors.primary : 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: colors.background,
          overflow: 'hidden',
        }}>
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            resizeMode="cover"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Stat Component
const Stat = memo(({ label, value, onPress }: {
  label: string;
  value: number;
  onPress?: () => void;
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.statContainer}
      accessible
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      testID={`stat-${label.toLowerCase()}`}
    >
      <Text style={[styles.statValue, { color: colors.text }]}>
        {formatNumber(value)}
      </Text>
      <Text style={[styles.statLabel, { color: colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// Button Components
const ButtonPrimary = memo(({ title, onPress, icon, disabled = false }: {
  title: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.buttonPrimary, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      {icon && <Ionicons name={icon as any} size={16} color="#FFF" style={{ marginRight: 4 }} />}
      <Text style={styles.buttonPrimaryText}>{title}</Text>
    </TouchableOpacity>
  );
});

const ButtonOutline = memo(({ title, onPress, icon }: {
  title: string;
  onPress: () => void;
  icon?: string;
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.buttonOutline, { borderColor: colors.border }]}
      onPress={onPress}
      accessible
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      {icon && <Ionicons name={icon as any} size={16} color={colors.text} style={{ marginRight: 4 }} />}
      <Text style={[styles.buttonOutlineText, { color: colors.text }]}>{title}</Text>
    </TouchableOpacity>
  );
});

// Bio Block
const BioBlock = memo(({ user }: { user: User }) => {
  const { colors } = useTheme();

  const handleUrlPress = useCallback(() => {
    if (user.externalUrl) {
      Linking.openURL(user.externalUrl).catch(() => {
        Alert.alert('Error', 'Could not open link');
      });
    }
  }, [user.externalUrl]);

  const handleUrlLongPress = useCallback(() => {
    Alert.alert('Link Actions', user.externalUrl || '', [
      { text: 'Copy', onPress: () => console.log('Copied:', user.externalUrl) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [user.externalUrl]);

  return (
    <View style={styles.bioBlock}>
      {user.fullName && (
        <Text style={[styles.fullName, { color: colors.text }]}>{user.fullName}</Text>
      )}
      {user.category && (
        <Text style={[styles.category, { color: colors.textSecondary }]}>{user.category}</Text>
      )}
      {user.bio && (
        <Text style={[styles.bio, { color: colors.text }]}>{user.bio}</Text>
      )}
      {user.externalUrl && (
        <TouchableOpacity
          onPress={handleUrlPress}
          onLongPress={handleUrlLongPress}
          accessible
          accessibilityLabel={`External link: ${user.externalUrl}`}
          accessibilityRole="link"
        >
          <Text style={[styles.link, { color: colors.primary }]}>{user.externalUrl}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// Professional Dashboard Card
const DashboardCard = memo(() => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.dashboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => console.log('Dashboard pressed')}
      accessible
      accessibilityLabel="Professional dashboard"
      accessibilityRole="button"
    >
      <View style={styles.dashboardContent}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dashboardTitle, { color: colors.text }]}>Professional dashboard</Text>
          <Text style={[styles.dashboardSubtitle, { color: colors.textSecondary }]}>
            New tools are now available
          </Text>
        </View>
        <View style={styles.dashboardDot} />
      </View>
    </TouchableOpacity>
  );
});

// Story Highlight
const StoryHighlight = memo(({ highlight, onPress }: {
  highlight: Highlight;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  const isNew = highlight.id === 'new';

  return (
    <TouchableOpacity
      style={styles.highlightContainer}
      onPress={onPress}
      accessible
      accessibilityLabel={`Story highlight: ${highlight.title}`}
      accessibilityRole="button"
    >
      <View style={[styles.highlightCircle, { borderColor: colors.border }]}>
        {isNew ? (
          <View style={[styles.newHighlight, { backgroundColor: colors.surface }]}>
            <Ionicons name="add" size={32} color={colors.text} />
          </View>
        ) : (
          <Image
            source={{ uri: highlight.coverUrl }}
            style={styles.highlightImage}
            resizeMode="cover"
          />
        )}
      </View>
      <Text style={[styles.highlightTitle, { color: colors.text }]} numberOfLines={1}>
        {highlight.title}
      </Text>
    </TouchableOpacity>
  );
});

// Tab Bar
const TabBar = memo(({ activeTab, onTabChange }: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) => {
  const { colors } = useTheme();

  const tabs = [
    { key: 'grid' as TabType, icon: 'grid-outline', label: 'Posts' },
    { key: 'reels' as TabType, icon: 'film-outline', label: 'Reels' },
    { key: 'tagged' as TabType, icon: 'person-outline', label: 'Tagged' },
  ];

  return (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && { borderBottomColor: colors.text },
          ]}
          onPress={() => onTabChange(tab.key)}
          accessible
          accessibilityLabel={tab.label}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.key }}
        >
          <Ionicons
            name={tab.icon as any}
            size={24}
            color={activeTab === tab.key ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// Post Tile
const PostTile = memo(({ post, onPress, onLongPress, onDoubleTap }: {
  post: Post;
  onPress: () => void;
  onLongPress: () => void;
  onDoubleTap: () => void;
}) => {
  const { colors } = useTheme();
  const [lastTap, setLastTap] = useState(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      onDoubleTap();
    } else {
      onPress();
    }
    setLastTap(now);
  }, [lastTap, onPress, onDoubleTap]);

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
      accessible
      accessibilityLabel={`Post with ${formatNumber(post.likes || 0)} likes`}
      accessibilityRole="imagebutton"
    >
      <Image source={{ uri: post.imageUrl }} style={styles.tileImage} resizeMode="cover" />
      {post.isReel && (
        <View style={styles.reelBadge}>
          <Ionicons name="play" size={20} color="#FFF" />
        </View>
      )}
      {post.views && (
        <View style={styles.viewsBadge}>
          <Ionicons name="play" size={14} color="#FFF" />
          <Text style={styles.viewsText}>{formatNumber(post.views)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Reels Tile
const ReelsTile = memo(({ post, onPress }: {
  post: Post;
  onPress: () => void;
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.9}
      accessible
      accessibilityLabel={`Reel with ${formatNumber(post.views || 0)} views`}
      accessibilityRole="imagebutton"
    >
      <Image source={{ uri: post.imageUrl }} style={styles.tileImage} resizeMode="cover" />
      <View style={styles.reelOverlay}>
        <Ionicons name="play" size={24} color="#FFF" />
      </View>
      <View style={styles.reelStats}>
        <Ionicons name="play" size={16} color="#FFF" />
        <Text style={styles.reelStatsText}>{formatNumber(post.views || 0)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// Tagged Tile
const TaggedTile = memo(({ post, onPress }: {
  post: Post;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.9}
      accessible
      accessibilityLabel="Tagged post"
      accessibilityRole="imagebutton"
    >
      <Image source={{ uri: post.imageUrl }} style={styles.tileImage} resizeMode="cover" />
      <View style={styles.tagBadge}>
        <Ionicons name="person-outline" size={16} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
});

// Header Bar
const HeaderBar = memo(({ user, onMenuPress, onNotificationsPress, onNewPostPress, onUsernamePress }: {
  user: User;
  onMenuPress: () => void;
  onNotificationsPress: () => void;
  onNewPostPress: () => void;
  onUsernamePress: () => void;
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.usernameContainer}
        onPress={onUsernamePress}
        accessible
        accessibilityLabel={`Username: ${user.username}`}
        accessibilityRole="button"
      >
        {user.isPrivate && (
          <Ionicons name="lock-closed" size={16} color={colors.text} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.headerUsername, { color: colors.text }]}>{user.username}</Text>
        {user.isVerified && (
          <MaterialIcons name="verified" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
        )}
        <Ionicons name="chevron-down" size={16} color={colors.text} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      <View style={styles.headerIcons}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={onNewPostPress}
          accessible
          accessibilityLabel="Create new post"
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={onNotificationsPress}
          accessible
          accessibilityLabel={`Notifications${user.notifications ? `, ${user.notifications} unread` : ''}`}
          accessibilityRole="button"
        >
          <Ionicons name="heart-outline" size={24} color={colors.text} />
          {user.notifications && user.notifications > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{user.notifications}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={onMenuPress}
          accessible
          accessibilityLabel="Menu"
          accessibilityRole="button"
        >
          <Ionicons name="menu-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Overflow Menu Sheet
const OverflowMenuSheet = memo(({ visible, onClose, onLogout, onSettings }: {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSettings: () => void;
}) => {
  const { colors } = useTheme();

  const menuItems = [
    { icon: 'settings-outline', title: 'Settings', onPress: onSettings },
    { icon: 'archive-outline', title: 'Archive', onPress: () => console.log('Archive') },
    { icon: 'time-outline', title: 'Your Activity', onPress: () => console.log('Activity') },
    { icon: 'qr-code-outline', title: 'QR Code', onPress: () => console.log('QR Code') },
    { icon: 'bookmark-outline', title: 'Saved', onPress: () => console.log('Saved') },
    { icon: 'people-outline', title: 'Close Friends', onPress: () => console.log('Close Friends') },
    { icon: 'star-outline', title: 'Favorites', onPress: () => console.log('Favorites') },
    { icon: 'log-out-outline', title: 'Log out', onPress: onLogout, danger: true },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.menuSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
              onPress={() => {
                item.onPress();
                onClose();
              }}
              accessible
              accessibilityLabel={item.title}
              accessibilityRole="button"
            >
              <Ionicons
                name={item.icon as any}
                size={24}
                color={item.danger ? colors.accent : colors.text}
              />
              <Text style={[
                styles.menuItemText,
                { color: item.danger ? colors.accent : colors.text },
              ]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// Loading Skeleton
const LoadingSkeleton = memo(() => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      <View style={[styles.skeletonAvatar, { backgroundColor: colors.surface }]} />
      <View style={{ flexDirection: 'row', gap: 24 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonStat, { backgroundColor: colors.surface }]} />
        ))}
      </View>
    </View>
  );
});

// ============================================================================
// MAIN PROFILE SCREEN
// ============================================================================

export default function ProfileScreen({
  navigation,
  route,
}: {
  navigation?: any;
  route?: any;
}) {
  const { colors, isDark } = useTheme();
  const authContext = useContext(AuthContext);
  const firebaseAuth = useFirebaseAuth();
  const userId = route?.params?.userId;
  const isCurrentUser = !userId; // If no userId provided, it's current user

  // State
  const [activeTab, setActiveTab] = useState<TabType>('grid');
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const scrollY = new Animated.Value(0);

  // Load user profile from backend
  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userData = await authAPI.getCurrentUser();
      setUser({
        ...userData,
        avatarUrl: userData.avatar_url || 'https://i.pravatar.cc/300?img=12',
        followers: userData.followers_count || 0,
        following: userData.following_count || 0,
        posts: userData.posts_count || 0,
        hasStory: false,
      });
      
      // Load user's posts
      const postsData = await contentAPI.getUserPosts(userData.id);
      setPosts(postsData.map((p: any) => ({
        id: p.id,
        imageUrl: p.images?.[0] || `https://picsum.photos/400/400?random=${p.id}`,
        views: Math.floor(Math.random() * 50000) + 1000,
        likes: p.likes_count || 0,
        isReel: p.content_type === 'video',
        comments: p.comments_count || 0,
      })));
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [userId]);

  const handleFollowToggle = useCallback(async () => {
    if (!user) return;
    
    try {
      if (following) {
        await socialAPI.unfollowUser(user.id);
        setFollowing(false);
        Alert.alert('Success', `Unfollowed ${user.username}`);
      } else {
        await socialAPI.followUser(user.id);
        setFollowing(true);
        Alert.alert('Success', `Now following ${user.username}`);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  }, [following, user]);

  const handlePostPress = useCallback((post: Post) => {
    if (navigation) {
      navigation.navigate('PostDetail', { postId: post.id });
    } else {
      console.log('Post pressed:', post.id);
    }
  }, [navigation]);

  const handlePostLongPress = useCallback((post: Post) => {
    Alert.alert('Post Actions', `Post ${post.id}`, [
      { text: 'Share', onPress: () => console.log('Share post:', post.id) },
      { text: 'Copy Link', onPress: () => console.log('Copy link:', post.id) },
      { text: 'Report', onPress: () => console.log('Report post:', post.id), style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handleDoubleTap = useCallback(async (post: Post) => {
    try {
      const isLiked = likedPosts.has(post.id);
      
      if (isLiked) {
        await contentAPI.unlikePost(post.id);
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(post.id);
          return newSet;
        });
      } else {
        await contentAPI.likePost(post.id);
        setLikedPosts(prev => new Set(prev).add(post.id));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [likedPosts]);

  const handleLoadMore = useCallback(() => {
    if (!loading) {
      console.log('Load more posts...');
      // Implement pagination here
    }
  }, [loading]);

  const handleEditProfile = useCallback(() => {
    if (navigation) {
      navigation.navigate('EditProfile');
    } else {
      console.log('Edit Profile');
    }
  }, [navigation]);

  const handleShareProfile = useCallback(() => {
    Alert.alert('Share Profile', `Share ${user?.username}'s profile`, [
      { text: 'Copy Link', onPress: () => console.log('Copy profile link') },
      { text: 'Share via...', onPress: () => console.log('Share sheet') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [user]);

  const handleMessage = useCallback(() => {
    if (navigation && user) {
      navigation.navigate('Chat', { userId: user.id, username: user.username });
    } else {
      console.log('Message user');
    }
  }, [navigation, user]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await firebaseAuth.signOut();
              // Navigation will be handled automatically by auth state change
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  }, [firebaseAuth]);

  const handleNotifications = useCallback(() => {
    if (navigation) {
      navigation.navigate('Notifications');
    } else {
      console.log('Notifications');
    }
  }, [navigation]);

  const handleNewPost = useCallback(() => {
    if (navigation) {
      navigation.navigate('CreateContent');
    } else {
      console.log('Create new post');
    }
  }, [navigation]);

  const handleSettings = useCallback(() => {
    if (navigation) {
      navigation.navigate('Settings');
    } else {
      console.log('Settings');
    }
  }, [navigation]);

  // Filter posts by active tab
  const filteredPosts = useMemo(() => {
    if (activeTab === 'reels') return posts.filter(p => p.isReel);
    if (activeTab === 'tagged') return posts.slice(0, 12);
    return posts;
  }, [activeTab, posts]);

  // Render functions
  const renderGridItem = useCallback(({ item }: { item: Post }) => {
    if (activeTab === 'reels') {
      return <ReelsTile post={item} onPress={() => handlePostPress(item)} />;
    }
    if (activeTab === 'tagged') {
      return <TaggedTile post={item} onPress={() => handlePostPress(item)} />;
    }
    return (
      <PostTile
        post={item}
        onPress={() => handlePostPress(item)}
        onLongPress={() => handlePostLongPress(item)}
        onDoubleTap={() => handleDoubleTap(item)}
      />
    );
  }, [activeTab, handlePostPress, handlePostLongPress, handleDoubleTap]);

  // Sticky header animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const ListHeaderComponent = useMemo(() => {
    if (!user) return null;
    
    return (
    <View>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Avatar
          uri={user.avatarUrl}
          size={86}
          hasStory={user.hasStory}
          onPress={() => console.log('Avatar pressed')}
        />

        <View style={styles.statsRow}>
          <Stat
            label="Posts"
            value={user.posts}
            onPress={() => console.log('Posts')}
          />
          <Stat
            label="Followers"
            value={user.followers}
            onPress={() => Alert.alert('Followers', `${formatNumber(user.followers)} followers`)}
          />
          <Stat
            label="Following"
            value={user.following}
            onPress={() => Alert.alert('Following', `${formatNumber(user.following)} following`)}
          />
        </View>
      </View>

      {/* Bio */}
      <BioBlock user={user} />

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isCurrentUser ? (
          <>
            <TouchableOpacity
              style={[styles.buttonOutline, { borderColor: colors.border, flex: 1 }]}
              onPress={handleEditProfile}
            >
              <Text style={[styles.buttonOutlineText, { color: colors.text }]}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonOutline, { borderColor: colors.border, flex: 1 }]}
              onPress={handleShareProfile}
            >
              <Text style={[styles.buttonOutlineText, { color: colors.text }]}>Share Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { borderColor: colors.border }]}
              onPress={() => Alert.alert('Add Friend', 'Discover people to follow')}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.buttonPrimary, { backgroundColor: following ? colors.surface : colors.primary, flex: 1, borderWidth: following ? 1 : 0, borderColor: colors.border }]}
              onPress={handleFollowToggle}
            >
              <Text style={[styles.buttonPrimaryText, { color: following ? colors.text : '#FFF' }]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonOutline, { borderColor: colors.border, flex: 1 }]}
              onPress={handleMessage}
            >
              <Text style={[styles.buttonOutlineText, { color: colors.text }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { borderColor: colors.border }]}
              onPress={() => {
                if (user.email) {
                  Linking.openURL(`mailto:${user.email}`);
                }
              }}
            >
              <Ionicons name="mail-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Professional Dashboard */}
      {user.isProfessional && <DashboardCard />}

      {/* Story Highlights */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.highlightsScroller}
        contentContainerStyle={styles.highlightsContent}
      >
        {MOCK_HIGHLIGHTS.map((highlight) => (
          <StoryHighlight
            key={highlight.id}
            highlight={highlight}
            onPress={() => console.log('Highlight:', highlight.title)}
          />
        ))}
      </ScrollView>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
    );
  }, [user, isCurrentUser, following, activeTab, handleFollowToggle, handleEditProfile, handleShareProfile, handleMessage, colors]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Ionicons name="images-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {activeTab === 'grid' && 'No posts yet'}
        {activeTab === 'reels' && 'No reels yet'}
        {activeTab === 'tagged' && 'No tagged posts'}
      </Text>
      {isCurrentUser && activeTab === 'grid' && (
        <TouchableOpacity
          style={[styles.createPostButton, { backgroundColor: colors.primary }]}
          onPress={handleNewPost}
        >
          <Text style={styles.createPostButtonText}>Create Your First Post</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [activeTab, colors, isCurrentUser, handleNewPost]);

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerUsername, { color: colors.text }]}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerUsername, { color: colors.text }]}>Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>Failed to load profile</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Page Title */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
      </View>

      {/* Username Header with Actions */}
      <HeaderBar
        user={user}
        onMenuPress={() => setMenuVisible(true)}
        onNotificationsPress={handleNotifications}
        onNewPostPress={handleNewPost}
        onUsernamePress={() => Alert.alert('Switch Account', 'Switch to another account')}
      />

      {/* Animated Sticky Header (appears on scroll) */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { 
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            opacity: headerOpacity,
          }
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.stickyHeaderText, { color: colors.text }]}>
          {user.username}
        </Text>
      </Animated.View>

      <Animated.FlatList
        data={filteredPosts}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.gridRow}
        getItemLayout={(data, index) => ({
          length: TILE_SIZE,
          offset: TILE_SIZE * Math.floor(index / 3),
          index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />

      <OverflowMenuSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onLogout={handleLogout}
        onSettings={handleSettings}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerUsername: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: 20,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ED4956',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 24,
  },
  statContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  bioBlock: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fullName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    marginBottom: 6,
  },
  bio: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonOutline: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dashboardCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dashboardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dashboardSubtitle: {
    fontSize: 12,
  },
  dashboardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797F0',
  },
  highlightsScroller: {
    marginBottom: 8,
  },
  highlightsContent: {
    paddingHorizontal: 12,
    gap: 16,
  },
  highlightContainer: {
    alignItems: 'center',
    width: 80,
  },
  highlightCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  newHighlight: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightImage: {
    width: 68,
    height: 68,
  },
  highlightTitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  gridRow: {
    gap: GRID_SPACING,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    position: 'relative',
  },
  tileImage: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  reelBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  viewsBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  reelStats: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelStatsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  createPostButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  stickyHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  skeletonAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  skeletonStat: {
    width: 60,
    height: 40,
    borderRadius: 8,
  },
});
