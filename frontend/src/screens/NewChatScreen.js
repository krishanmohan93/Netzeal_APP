/**
 * NewChatScreen - Start a new 1:1 conversation
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatAPI } from '../services/chatApi';
import api, { socialAPI } from '../services/api';
import { normalizeUri } from '../utils/media';
import { getUserFacingError } from '../utils/errorMessages';

const NewChatScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingUserId, setCreatingUserId] = useState(null);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        if (!debouncedQuery) {
          const suggestions = await socialAPI.getSuggestedUsers(20);
          if (!active) return;
          setUsers(Array.isArray(suggestions) ? suggestions : []);
          return;
        }

        const response = await api.get('/search/users', { params: { query: debouncedQuery } });
        if (!active) return;
        setUsers(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (!active) return;
        setError(getUserFacingError(err, 'Unable to load users.'));
        setUsers([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [debouncedQuery]);

  const handleStartChat = async (user) => {
    const targetId = user?.id;
    if (!targetId || creatingUserId) {
      return;
    }

    try {
      setCreatingUserId(targetId);
      const conversation = await chatAPI.createConversation('direct', [targetId], null);
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversationTitle: user.full_name || user.username || 'Chat',
      });
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to start chat.'));
    } finally {
      setCreatingUserId(null);
    }
  };

  const renderUser = ({ item }) => {
    const avatarUri = normalizeUri(item.profile_photo);
    const initials = (item.full_name || item.username || 'U').slice(0, 2).toUpperCase();
    const isCreating = creatingUserId === item.id;

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => handleStartChat(item)} disabled={isCreating}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.fullName} numberOfLines={1}>
            {item.full_name || item.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>

        {isCreating ? (
          <ActivityIndicator size="small" color="#B8860B" />
        ) : (
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#B8860B" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#777" />
        <TextInput
          style={styles.input}
          placeholder="Search people"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B8860B" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.public_id?.toString() || item.id?.toString() || item.username}
          renderItem={renderUser}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {debouncedQuery ? 'No users found.' : 'No suggestions yet.'}
              </Text>
            </View>
          }
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 10,
    height: 42,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    color: '#111',
    fontSize: 15,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#E4E4E4',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF3D8',
  },
  avatarText: {
    color: '#B8860B',
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  fullName: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    color: '#777',
    marginTop: 2,
    fontSize: 13,
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
  errorBanner: {
    borderTopWidth: 1,
    borderTopColor: '#F0D4D4',
    backgroundColor: '#FFF3F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#8B1A1A',
    fontSize: 13,
  },
});

export default NewChatScreen;

