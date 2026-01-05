/**
 * My Work Screen - Network Messages & Connections
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

// Dummy conversation data
const CONVERSATIONS = [
  {
    id: 1,
    name: 'John Doe',
    message: 'Sounds good!',
    timestamp: '0.318.70',
    avatar: 'JD',
    verified: true,
    unread: false,
  },
  {
    id: 2,
    name: 'John Doe',
    message: 'Sounds good!',
    timestamp: '0.918.75',
    avatar: 'JD',
    verified: false,
    unread: false,
  },
  {
    id: 3,
    name: 'Sarah K.',
    message: 'Project update',
    timestamp: '0.315.70',
    avatar: 'SK',
    verified: false,
    unread: false,
    liked: true,
  },
  {
    id: 4,
    name: 'Sarah K.',
    message: 'Project updatey week?',
    timestamp: '0.317.78',
    avatar: 'SK',
    verified: false,
    unread: false,
  },
  {
    id: 5,
    name: 'Alex Chen',
    message: "Le's connect...",
    timestamp: '0.7.17.78',
    avatar: 'AC',
    verified: false,
    unread: false,
    icons: true,
  },
  {
    id: 6,
    name: 'Alex Chen',
    message: "Let's to stalde for ty week?",
    timestamp: '0.315.75',
    avatar: 'AC',
    verified: false,
    unread: false,
  },
];

const ConversationItem = ({ conversation, onPress }) => {
  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{conversation.avatar}</Text>
        </View>
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName}>{conversation.name}</Text>
            {conversation.verified && (
              <Icon name="checkmark-circle" size={16} color={colors.primaryLight} style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.timestamp}>{conversation.timestamp}</Text>
        </View>
        
        <View style={styles.messageRow}>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {conversation.message}
          </Text>
          {conversation.liked && (
            <Icon name="heart" size={14} color={colors.textSecondary} style={styles.likeIcon} />
          )}
          {conversation.icons && (
            <View style={styles.iconGroup}>
              <Icon name="location" size={14} color={colors.textSecondary} />
              <Icon name="attach" size={14} color={colors.textSecondary} style={styles.attachIcon} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MyWorkScreen = ({ navigation }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleConversationPress = (conversation) => {
    navigation.navigate('Chat', { 
      conversationId: conversation.id,
      conversationTitle: conversation.name,
      name: conversation.name 
    });
  };

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('CreatePost')}>
          <Icon name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Image
            source={require('../../Logo_NetZeal.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Search')}>
          <Icon name="search" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Network</Text>
        <TouchableOpacity>
          <Icon name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={CONVERSATIONS}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    // Push content below the status bar/notch, especially on Android
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 56,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logoImage: {
    height: 28,
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
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  likeIcon: {
    marginLeft: spacing.xs,
  },
  iconGroup: {
    flexDirection: 'row',
    marginLeft: spacing.xs,
  },
  attachIcon: {
    marginLeft: 4,
  },
});

export default MyWorkScreen;
