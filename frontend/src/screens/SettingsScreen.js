/**
 * Settings Screen - Account settings and preferences
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

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
  const auth = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const values = await AsyncStorage.multiGet(['darkMode', 'pushNotifications']);
        const storedDarkMode = values.find(([key]) => key === 'darkMode')?.[1];
        const storedPush = values.find(([key]) => key === 'pushNotifications')?.[1];
        if (storedDarkMode !== null) {
          setDarkMode(storedDarkMode === 'true');
        }
        if (storedPush !== null) {
          setNotificationsEnabled(storedPush === 'true');
        }
      } catch (error) {
        console.error('Error loading settings preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  const passwordValidationMessage = useMemo(() => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      return 'All password fields are required.';
    }
    if (passwordForm.new_password.length < 8) {
      return 'New password must be at least 8 characters.';
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return 'New password and confirm password do not match.';
    }
    if (passwordForm.current_password === passwordForm.new_password) {
      return 'New password must be different from current password.';
    }
    return '';
  }, [passwordForm]);

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

  const handleChangePassword = async () => {
    if (passwordValidationMessage) {
      Alert.alert('Validation Error', passwordValidationMessage);
      return;
    }

    try {
      setChangePasswordLoading(true);
      await authAPI.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setChangePasswordVisible(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      Alert.alert('Success', 'Password updated successfully.');
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('Error', error?.userMessage || error?.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleToggleDarkMode = async (value) => {
    try {
      setDarkMode(value);
      await AsyncStorage.setItem('darkMode', value.toString());
      Alert.alert('Theme Preference Saved', 'Theme changes apply after app restart.');
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const handleTogglePushNotifications = async (value) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('pushNotifications', value.toString());
    } catch (error) {
      console.error('Error saving notification preference:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            // Use Auth context to logout
            await auth.logout();
            // Navigation will be handled automatically by the auth state change
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          } finally {
            setLoggingOut(false);
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
            subtitle="Your privacy controls are managed in Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => setChangePasswordVisible(true)}
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
                onValueChange={handleTogglePushNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            icon="mail-outline"
            title="Email Notifications"
            subtitle="Email updates are currently tied to account alerts"
            showArrow={false}
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
                onValueChange={handleToggleDarkMode}
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
            subtitle="English (app default)"
            showArrow={false}
          />
          <SettingItem
            icon="cloud-download-outline"
            title="Data Usage"
            subtitle="Adaptive quality is managed automatically"
            showArrow={false}
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
            subtitle={loggingOut ? 'Signing out...' : 'Sign out of your account'}
            onPress={loggingOut ? undefined : handleLogout}
            rightComponent={loggingOut ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
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

      <Modal
        animationType="slide"
        transparent
        visible={changePasswordVisible}
        onRequestClose={() => setChangePasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <TextInput
              style={styles.passwordInput}
              placeholder="Current password"
              secureTextEntry
              value={passwordForm.current_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, current_password: text }))}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              secureTextEntry
              value={passwordForm.new_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, new_password: text }))}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm new password"
              secureTextEntry
              value={passwordForm.confirm_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, confirm_password: text }))}
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setChangePasswordVisible(false)}
                disabled={changePasswordLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.savePasswordButton]}
                onPress={handleChangePassword}
                disabled={changePasswordLoading}
              >
                {changePasswordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.savePasswordButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
    minWidth: 90,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  savePasswordButton: {
    backgroundColor: colors.primary,
  },
  savePasswordButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default SettingsScreen;
