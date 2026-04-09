/**
 * Search Screen - Instagram-style search with tabs
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import api, { authAPI, socialAPI } from '../services/api';
import { normalizeUri } from '../utils/media';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'posts', label: 'Posts' },
  { id: 'reels', label: 'Shorts' },
  { id: 'projects', label: 'Projects' },
];

const toSafeString = (value) => (value === null || value === undefined ? '' : String(value).trim());

const normalizeInternalUserId = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }
  return null;
};

const buildUserIdentity = (source = {}) => ({
  publicId: toSafeString(source.public_id || source.publicId) || null,
  internalId: normalizeInternalUserId(source.id, source.user_id, source.userId),
  username: toSafeString(source.username).toLowerCase(),
});

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('people');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [followPendingMap, setFollowPendingMap] = useState({});
  const [currentUserIdentity, setCurrentUserIdentity] = useState({
    publicId: null,
    internalId: null,
    username: '',
  });

  // Focus effect to possibly clear or refresh? No, keep state.

  const performSearch = useCallback(async (searchText, tab) => {
    setLoading(true);
    try {
      let response;

      if (tab === 'people') {
        if (!searchText.trim()) {
          const suggestions = await socialAPI.getSuggestedUsers(20);
          setResults(Array.isArray(suggestions) ? suggestions : []);
          return;
        }
        response = await api.get('/search/users', { params: { query: searchText } });
      } else if (tab === 'posts') {
        if (!searchText.trim()) {
          setResults([]);
          return;
        }
        response = await api.get('/content/search/posts', { params: { query: searchText } });
      } else if (tab === 'reels') {
        if (!searchText.trim()) {
          setResults([]);
          return;
        }
        response = await api.get('/content/search/reels', { params: { query: searchText } });
      } else if (tab === 'projects') {
        if (!searchText.trim()) {
          setResults([]);
          return;
        }
        response = await api.get('/content/search/projects', { params: { query: searchText } });
      }

      setResults(response.data || []);
    } catch (error) {
      console.error('Search error:', error);
      // Fail silently for user, just clear results or keep old
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (text) => {
    setQuery(text);
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!text.trim()) {
      if (activeTab === 'people') {
        performSearch('', activeTab);
      } else {
        setResults([]);
      }
      return;
    }

    const timeout = setTimeout(() => {
      performSearch(text, activeTab);
    }, 500); // 500ms debounce
    setSearchTimeout(timeout);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (query.trim()) {
      performSearch(query, tabId);
    } else if (tabId === 'people') {
      performSearch('', tabId);
    } else {
      setResults([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'people' && !query.trim()) {
      performSearch('', 'people');
    }
  }, [activeTab, query, performSearch]);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUserIdentity = async () => {
      let resolvedIdentity = { publicId: null, internalId: null, username: '' };

      try {
        const rawUserData = await AsyncStorage.getItem('userData');
        const rawLegacyUserData = await AsyncStorage.getItem('user_data');
        const storedPayload = rawUserData || rawLegacyUserData;

        if (storedPayload) {
          const storedUser = JSON.parse(storedPayload);
          resolvedIdentity = buildUserIdentity(storedUser);
        }
      } catch (error) {
        // Non-blocking: fallback to API below.
      }

      if (!resolvedIdentity.publicId || !resolvedIdentity.internalId || !resolvedIdentity.username) {
        try {
          const latestUser = await authAPI.getCurrentUser();
          const apiIdentity = buildUserIdentity(latestUser || {});
          resolvedIdentity = {
            publicId: apiIdentity.publicId || resolvedIdentity.publicId,
            internalId: apiIdentity.internalId || resolvedIdentity.internalId,
            username: apiIdentity.username || resolvedIdentity.username,
          };

          if (latestUser) {
            await AsyncStorage.setItem('userData', JSON.stringify(latestUser));
            await AsyncStorage.setItem('user_data', JSON.stringify(latestUser));
          }
        } catch (error) {
          // Keep best available identity from storage.
        }
      }

      if (isMounted) {
        setCurrentUserIdentity(resolvedIdentity);
      }
    };

    loadCurrentUserIdentity();
    return () => {
      isMounted = false;
    };
  }, []);

  const isCurrentUser = useCallback(
    (user) => {
      if (!user) return false;

      const userPublicId = toSafeString(user.public_id || user.publicId) || null;
      const userInternalId = normalizeInternalUserId(user.id, user.user_id, user.userId);
      const userUsername = toSafeString(user.username).toLowerCase();

      if (
        currentUserIdentity.publicId &&
        userPublicId &&
        currentUserIdentity.publicId === userPublicId
      ) {
        return true;
      }

      if (
        currentUserIdentity.internalId &&
        userInternalId &&
        currentUserIdentity.internalId === userInternalId
      ) {
        return true;
      }

      if (
        currentUserIdentity.username &&
        userUsername &&
        currentUserIdentity.username === userUsername
      ) {
        return true;
      }

      return false;
    },
    [currentUserIdentity]
  );

  const handleUserPress = (user) => {
    if (user.public_id) {
      // Navigate to ProfileDashboard with userId to view other user's profile
      navigation.navigate('ProfileDashboard', { userId: user.public_id, username: user.username });
    }
  };

  const handlePostPress = (post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  };

  const handleFollowToggle = async (user) => {
    if (isCurrentUser(user)) {
      return;
    }

    const userKey = user.public_id || user.id;
    if (!userKey || followPendingMap[userKey]) {
      return;
    }

    const wasFollowing = Boolean(user.is_following);
    setFollowPendingMap((prev) => ({ ...prev, [userKey]: true }));
    setResults((prev) =>
      prev.map((item) =>
        (item.public_id || item.id) === userKey
          ? { ...item, is_following: !wasFollowing }
          : item
      )
    );

    try {
      if (user.public_id) {
        await socialAPI.toggleConnection(user.public_id);
      } else if (user.id) {
        if (wasFollowing) {
          await socialAPI.unfollowUser(user.id);
        } else {
          await socialAPI.followUser(user.id);
        }
      }
    } catch (error) {
      setResults((prev) =>
        prev.map((item) =>
          (item.public_id || item.id) === userKey
            ? { ...item, is_following: wasFollowing }
            : item
        )
      );
    } finally {
      setFollowPendingMap((prev) => {
        const next = { ...prev };
        delete next[userKey];
        return next;
      });
    }
  };

  // RENDERERS
  const getValidUri = (...candidates) => {
    for (const candidate of candidates) {
      const uri = normalizeUri(candidate);
      if (uri) return uri;
    }
    return null;
  };

  const renderUserItem = ({ item }) => {
    // Handle potential data mismatch
    const name = item.full_name || item.username || 'User';
    const username = item.username || '';
    const initials = name.substring(0, 2).toUpperCase();
    const avatarUri = getValidUri(item.profile_photo);
    const userKey = item.public_id || item.id;
    const followPending = Boolean(userKey && followPendingMap[userKey]);
    const isFollowing = Boolean(item.is_following);
    const isSelfUser = isCurrentUser(item);

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(item)}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.placeholderText}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userHandle}>@{username}</Text>
        </View>
        {!isSelfUser ? (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followingButton,
              followPending && styles.followButtonDisabled,
            ]}
            onPress={(event) => {
              event?.stopPropagation?.();
              handleFollowToggle(item);
            }}
            disabled={followPending}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.followButtonSpacer} />
        )}
      </TouchableOpacity>
    );
  };

  const renderPostGridItem = ({ item }) => {
    // Determine image source
    const firstMedia = Array.isArray(item.media_urls) ? item.media_urls[0] : null;
    const imageUrl = getValidUri(item.thumbnail_url, item.image_url, firstMedia, item.media_url);

    return (
      <TouchableOpacity style={styles.gridItem} onPress={() => handlePostPress(item)}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.gridImage, styles.textPostPlaceholder]}>
            <Text numberOfLines={3} style={styles.textPostContent}>{item.content}</Text>
          </View>
        )}
        {item.type === 'reel' && (
          <View style={styles.reelBadge}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderProjectItem = ({ item }) => {
    // Projects might look like LinkedIn cards
    const firstMedia = Array.isArray(item.media_urls) ? item.media_urls[0] : null;
    const imageUrl = getValidUri(item.thumbnail_url, firstMedia);

    return (
      <TouchableOpacity style={styles.projectItem} onPress={() => handlePostPress(item)}>
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.projectImage} />
        )}
        <View style={styles.projectInfo}>
          <Text style={styles.projectTitle} numberOfLines={1}>{item.title || item.content?.substring(0, 30)}</Text>
          <Text style={styles.projectAuthor} numberOfLines={1}>By @{item.author_username}</Text>
          <Text style={styles.projectDesc} numberOfLines={2}>{item.content}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    if (activeTab === 'people') return renderUserItem({ item });
    if (activeTab === 'projects') return renderProjectItem({ item });
    return renderPostGridItem({ item }); // Posts and Reels as grid
  };

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => handleTabChange(tab.id)}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Search..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.public_id?.toString() || item.id?.toString() || `${item.username}`}
          renderItem={renderItem}
          numColumns={activeTab === 'people' || activeTab === 'projects' ? 1 : 3}
          key={activeTab} // Force re-render when switching columns
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {query
                  ? `No ${activeTab} found.`
                  : activeTab === 'people'
                    ? 'No people suggestions available.'
                    : 'Start searching...'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#efefef',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
    paddingVertical: 0, // Fix alignment on Android
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  // User Item Styles
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5, // Optional separator
    borderBottomColor: '#efefef'
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderAvatar: {
    backgroundColor: '#dbdbdb',
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  followButton: {
    minWidth: 86,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  followingButtonText: {
    color: '#111',
  },
  followButtonDisabled: {
    opacity: 0.65,
  },
  followButtonSpacer: {
    minWidth: 86,
    height: 34,
  },
  userName: {
    fontWeight: '600',
    fontSize: 16,
  },
  userHandle: {
    color: '#666',
    fontSize: 14,
  },
  // Grid Item Styles
  gridItem: {
    width: SCREEN_WIDTH / 3,
    height: SCREEN_WIDTH / 3,
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  textPostPlaceholder: {
    padding: 8,
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  textPostContent: {
    fontSize: 12,
    color: '#333',
  },
  reelBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
    borderRadius: 4,
  },
  // Project Item Styles
  projectItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  projectImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 2,
  },
  projectAuthor: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 13,
    color: '#444',
  }
});

export default SearchScreen;
