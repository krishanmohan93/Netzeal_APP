/**
 * Settings Screen - Account settings and preferences
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';

const SettingItem = ({ icon, title, subtitle, onPress, showArrow = true, rightComponent }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
    <View style={styles.settingLeft}>
      <Icon name={icon} size={24} color={colors.primary} />
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {rightComponent || (showArrow && <Icon name="chevron-forward" size={20} color={colors.textLight} />)}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const firebaseAuth = useFirebaseAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
            Alert.alert('Success', 'Account deletion requested');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // Use Firebase Auth context to sign out
            await firebaseAuth.signOut();
            // Navigation will be handled automatically by the auth state change
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.container}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <SettingItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your profile information"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Privacy & Security"
            subtitle="Manage your privacy settings"
            onPress={() => Alert.alert('Coming Soon', 'Privacy settings coming soon!')}
          />
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => Alert.alert('Coming Soon', 'Password change coming soon!')}
          />
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <SettingItem
            icon="notifications-outline"
            title="Push Notifications"
            subtitle="Receive push notifications"
            showArrow={false}
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            icon="mail-outline"
            title="Email Notifications"
            subtitle="Receive email updates"
            onPress={() => Alert.alert('Coming Soon', 'Email preferences coming soon!')}
          />
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APPEARANCE</Text>
          <SettingItem
            icon="moon-outline"
            title="Dark Mode"
            subtitle="Enable dark theme"
            showArrow={false}
            rightComponent={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            icon="play-outline"
            title="Auto-play Videos"
            subtitle="Automatically play videos in feed"
            showArrow={false}
            rightComponent={
              <Switch
                value={autoPlay}
                onValueChange={setAutoPlay}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* Content Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTENT</Text>
          <SettingItem
            icon="language-outline"
            title="Language"
            subtitle="English"
            onPress={() => Alert.alert('Coming Soon', 'Language selection coming soon!')}
          />
          <SettingItem
            icon="cloud-download-outline"
            title="Data Usage"
            subtitle="Manage data and storage"
            onPress={() => Alert.alert('Coming Soon', 'Data usage settings coming soon!')}
          />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <SettingItem
            icon="information-circle-outline"
            title="About NetZeal"
            subtitle="Version 1.0.0"
            onPress={() => Alert.alert('NetZeal', 'Version 1.0.0\n© 2025 NetZeal Inc.')}
          />
          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help or contact us"
            onPress={() => navigation.navigate('Help')}
          />
          <SettingItem
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Read our terms"
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="How we protect your data"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <SettingItem
            icon="log-out-outline"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
          />
          <SettingItem
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ by NetZeal Team</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textLight,
    marginLeft: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingTitle: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  settingSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.textLight,
  },
});

export default SettingsScreen;
