/**
 * INTEGRATION GUIDE - Adding Chat to Navigation
 * 
 * Follow these steps to integrate the chat screens into your app navigation
 */

// ============================================
// Step 1: Install Required Dependencies
// ============================================
/*
npm install @react-native-async-storage/async-storage
npm install @expo/vector-icons
*/

// ============================================
// Step 2: Add Chat Screens to Navigation
// ============================================

// In your main navigation file (e.g., App.js or Navigation.js)
import ConversationsScreen from './src/screens/ConversationsScreen';
import ChatScreen from './src/screens/ChatScreen';

// For Stack Navigator:
const Stack = createStackNavigator();

function ChatNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Conversations" 
        component={ConversationsScreen}
        options={{
          title: 'Chats',
          headerStyle: { backgroundColor: '#B8860B' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{
          headerStyle: { backgroundColor: '#B8860B' },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}

// ============================================
// Step 3: Add to Bottom Tab Navigator (Optional)
// ============================================

// If using bottom tabs
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="ChatTab" 
        component={ChatNavigator}
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : null, // Show unread count
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================
// Step 4: Configure API Base URL
// ============================================

// Update frontend/src/config/environment.js
export const LOCAL_IP = '10.215.120.75'; // Your computer's IP
export const API_BASE_URL = `http://${LOCAL_IP}:8000/api/v1`;

// ============================================
// Step 5: Start Chat from Any Screen
// ============================================

// Example: Start chat from user profile
import { chatAPI } from '../services/chatApi';

async function startChatWithUser(userId, username) {
  try {
    // Create or get existing conversation
    const conversation = await chatAPI.createConversation('direct', [userId]);
    
    // Navigate to chat
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      conversationTitle: username
    });
  } catch (error) {
    console.error('Failed to start chat:', error);
    Alert.alert('Error', 'Could not start chat');
  }
}

// Usage in your component:
<TouchableOpacity onPress={() => startChatWithUser(user.id, user.username)}>
  <Text>Send Message</Text>
</TouchableOpacity>

// ============================================
// Step 6: Handle Push Notifications (Future)
// ============================================

// When user taps notification, navigate to chat:
Notifications.addNotificationResponseReceivedListener(response => {
  const conversationId = response.notification.request.content.data.conversationId;
  const title = response.notification.request.content.data.conversationTitle;
  
  navigation.navigate('Chat', {
    conversationId,
    conversationTitle: title
  });
});

// ============================================
// Step 7: Test the Integration
// ============================================

/*
1. Start backend: 
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0

2. Start frontend:
   cd frontend
   npm start

3. Open app on device/emulator

4. Navigate to Chats tab

5. Create new conversation:
   - Tap + button
   - Select user (you'll need to implement user selection screen)
   - Start chatting!

6. Test features:
   - Send messages
   - See typing indicators
   - Check read receipts (double check marks)
   - Open chat on two devices to test real-time
*/

// ============================================
// Step 8: Add User Selection Screen (Optional)
// ============================================

// Create NewChatScreen.js for selecting users to chat with
import React, { useState, useEffect } from 'react';
import { FlatList, TouchableOpacity, Text } from 'react-native';
import { API } from '../services/api';

function NewChatScreen({ navigation }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      // Fetch users from your API
      const data = await API.get('/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function startChat(user) {
    try {
      const conversation = await chatAPI.createConversation('direct', [user.id]);
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversationTitle: user.full_name || user.username
      });
    } catch (error) {
      Alert.alert('Error', 'Could not start chat');
    }
  }

  return (
    <FlatList
      data={users}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => startChat(item)}>
          <Text>{item.full_name || item.username}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

// Add to navigation:
<Stack.Screen name="NewChat" component={NewChatScreen} />

// ============================================
// Troubleshooting
// ============================================

/*
Issue: Messages not loading
Solution: Check JWT token is valid, user is logged in

Issue: WebSocket not connecting
Solution: Verify backend IP is correct in environment.js

Issue: Typing indicators not working
Solution: Check WebSocket connection in console logs

Issue: Images not displaying
Solution: Verify Cloudinary credentials in backend .env

Issue: Backend error 500
Solution: Check backend terminal logs for specific error
*/

// ============================================
// API Endpoints Reference
// ============================================

/*
GET    /chat/conversations              - List conversations
POST   /chat/conversations              - Create conversation
GET    /chat/conversations/{id}         - Get conversation details
GET    /chat/conversations/{id}/messages - Get messages
POST   /chat/conversations/{id}/messages - Send message
PUT    /chat/messages/{id}              - Edit message
DELETE /chat/messages/{id}              - Delete message
POST   /chat/messages/{id}/read         - Mark as read
WS     /chat/ws/{user_id}               - WebSocket connection
*/

export default null; // This is a guide file, not a component
