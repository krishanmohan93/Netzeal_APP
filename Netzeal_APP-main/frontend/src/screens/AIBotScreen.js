/**
 * AI Bot Screen - Chat with AI Assistant
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { aiAPI, collabAPI, socialAPI } from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';

const MessageBubble = ({ message, isUser }) => {
  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
      <Text style={[styles.messageText, isUser && styles.userMessageText]}>
        {message.content}
      </Text>
      <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
        {new Date(message.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </Text>
    </View>
  );
};

const RecommendationCard = ({ recommendation }) => {
  return (
    <View style={styles.recommendationCard}>
      <Text style={styles.recTitle}>{recommendation.course_name || recommendation.title}</Text>
      <Text style={styles.recPlatform}>{recommendation.platform || 'NetZeal'}</Text>
      <Text style={styles.recReason} numberOfLines={2}>
        {recommendation.reason || recommendation.description}
      </Text>
    </View>
  );
};

const UserRecCard = ({ user, onConnect }) => (
  <View style={styles.recommendationCard}>
    <Text style={styles.recTitle}>{user.full_name || user.username}</Text>
    <Text style={styles.recPlatform}>@{user.username}</Text>
    {!!(user.skills && user.skills.length) && (
      <Text style={styles.recReason} numberOfLines={2}>Skills: {user.skills.slice(0,5).join(', ')}</Text>
    )}
    <TouchableOpacity style={[styles.smallBtn, { marginTop: spacing.sm }]} onPress={onConnect}>
      <Text style={styles.smallBtnText}>Connect</Text>
    </TouchableOpacity>
  </View>
);

const OpportunityCard = ({ item, onApply }) => (
  <View style={styles.recommendationCard}>
    <Text style={styles.recTitle}>{item.title || 'Opportunity'}</Text>
    {!!item.content && (<Text style={styles.recReason} numberOfLines={3}>{item.content}</Text>)}
    <TouchableOpacity style={[styles.smallBtn, { marginTop: spacing.sm }]} onPress={onApply}>
      <Text style={styles.smallBtnText}>Apply</Text>
    </TouchableOpacity>
  </View>
);

const AIBotScreen = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [inputBarHeight, setInputBarHeight] = useState(56);
  const [composerInputHeight, setComposerInputHeight] = useState(44);

  useEffect(() => {
    loadUserProfile();
    loadConversationHistory();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await aiAPI.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      // 401 errors are handled by API interceptor (auto-redirect to login)
      // Only log other errors
      if (error.response?.status !== 401) {
        console.error('Error loading user profile:', error);
      }
    }
  };

  const loadConversationHistory = async () => {
    try {
      const history = await aiAPI.getConversationHistory(10);
      const formattedMessages = [];
      
      history.reverse().forEach(conv => {
        formattedMessages.push({
          id: `user-${conv.id}`,
          content: conv.message,
          isUser: true,
          timestamp: conv.created_at,
        });
        formattedMessages.push({
          id: `ai-${conv.id}`,
          content: conv.response,
          isUser: false,
          timestamp: conv.created_at,
          recommendations: conv.recommendations,
        });
      });
      
      setMessages(formattedMessages);
    } catch (error) {
      // 401 errors are handled by API interceptor (auto-redirect to login)
      // Only log other errors
      if (error.response?.status !== 401) {
        console.error('Error loading conversation history:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      content: inputText.trim(),
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Build user context for AI
      const userContext = userProfile ? {
        skills: userProfile.skills || [],
        interests: userProfile.interests || [],
        career_stage: userProfile.headline || 'Developer',
        recent_activity: 'Active on NetZeal',
      } : null;

      const response = await aiAPI.chat(inputText.trim(), userContext);
      
      const aiMessage = {
        id: `ai-${Date.now()}`,
        content: response.response,
        isUser: false,
        timestamp: response.created_at,
        recommendations: response.recommendations,
        recommendations_content: response.recommendations_content,
        recommendations_users: response.recommendations_users,
        recommendations_opportunities: response.recommendations_opportunities,
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      // 401 errors are handled by API interceptor (auto-redirect to login)
      // Only show error message for other errors
      if (error.response?.status !== 401) {
        console.error('Error sending message:', error);
        
        let errorText = 'Sorry, I encountered an error. Please try again.';
        
        // Provide more specific error messages
        if (error.response?.status === 500) {
          errorText = 'The AI service is temporarily unavailable. Please try again in a moment.';
        } else if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
          errorText = 'Network connection issue. Please check your internet and try again.';
        } else if (error.response?.data?.detail) {
          errorText = error.response.data.detail;
        }
        
        const errorMessage = {
          id: `error-${Date.now()}`,
          content: errorText,
          isUser: false,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View>
        <MessageBubble message={item} isUser={item.isUser} />
        {item.recommendations && item.recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recHeader}>📚 Recommended for you:</Text>
            {item.recommendations.map((rec, index) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </View>
        )}
        {item.recommendations_content && item.recommendations_content.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recHeader}>✨ Content you may like</Text>
            {item.recommendations_content.map((rec, index) => (
              <RecommendationCard key={`c-${index}`} recommendation={rec} />
            ))}
          </View>
        )}
        {item.recommendations_users && item.recommendations_users.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recHeader}>🤝 People to connect</Text>
            {item.recommendations_users.map((u, index) => (
              <UserRecCard
                key={`u-${index}`}
                user={u}
                onConnect={async () => {
                  try {
                    await socialAPI.followUser(u.id);
                  } catch (e) { /* noop */ }
                }}
              />
            ))}
          </View>
        )}
        {item.recommendations_opportunities && item.recommendations_opportunities.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recHeader}>💼 Opportunities for you</Text>
            {item.recommendations_opportunities.map((op, index) => (
              <OpportunityCard
                key={`o-${index}`}
                item={op}
                onApply={async () => {
                  try {
                    await collabAPI.apply({ toUserId: op.author_id, topic: op.title, message: 'Hi! I saw this and would like to collaborate/work on it.' });
                  } catch (e) { /* noop */ }
                }}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.avatarContainer}>
            <Icon name="rocket-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your AI Tech Mentor 🚀</Text>
          <Text style={styles.emptyText}>
            I'm here to help you learn faster, build more, and grow your tech career like a pro!
          </Text>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('Create a personalized learning path for me')}
            >
              <Icon name="school-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Learning Path</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('Suggest project ideas based on my skills')}
            >
              <Icon name="bulb-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Project Ideas</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('What skills should I focus on for career growth?')}
            >
              <Icon name="trending-up-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Career Guide</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('Recommend tutorials and resources for my interests')}
            >
              <Icon name="book-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Resources</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('Find me coding challenges to practice')}
            >
              <Icon name="code-slash-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Challenges</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setInputText('Help me connect with relevant developers')}
            >
              <Icon name="people-outline" size={28} color={colors.primary} />
              <Text style={styles.quickActionLabel}>Network</Text>
            </TouchableOpacity>
          </View>

          {/* Sample Prompts */}
          <View style={styles.samplePromptsContainer}>
            <Text style={styles.samplePromptsTitle}>Or try asking:</Text>
            <TouchableOpacity
              style={styles.promptChip}
              onPress={() => setInputText('What are the trending technologies in 2025?')}
            >
              <Text style={styles.promptText}>💡 What's trending in tech?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.promptChip}
              onPress={() => setInputText('Review my portfolio and suggest improvements')}
            >
              <Text style={styles.promptText}>📈 Review my portfolio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: (inputBarHeight || 56) + insets.bottom },
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      
      {/* Composer anchored to bottom and only this area avoids the keyboard to prevent full-screen jumps */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.composerContainer}
      >
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
          ]}
          onLayout={(e) =>
            setInputBarHeight(Math.max(44, Math.ceil(e.nativeEvent.layout.height)))
          }
        >
          <TextInput
            style={[styles.input, { height: composerInputHeight }]}
            placeholder="Ask me anything..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)}
            onContentSizeChange={(e) => {
              const h = Math.min(140, Math.max(44, Math.ceil(e.nativeEvent.contentSize.height)));
              setComposerInputHeight(h);
            }}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flexBasis: '45%',
    maxWidth: '45%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
    margin: spacing.xs,
    ...shadows.sm,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
    fontSize: 11,
  },
  samplePromptsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  samplePromptsTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  promptChip: {
    backgroundColor: colors.primaryLight + '15',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  promptText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  messagesList: {
    padding: spacing.md,
  },
  composerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  recommendationsContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginBottom: spacing.md,
  },
  recHeader: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  recommendationCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  recTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  recPlatform: {
    ...typography.caption,
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  recReason: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  smallBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  smallBtnText: { color: '#fff', ...typography.caption },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    minHeight: 44,
    maxHeight: 140,
    ...typography.body,
    color: colors.text,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default AIBotScreen;
