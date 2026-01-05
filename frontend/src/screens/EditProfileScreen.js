/**
 * Edit Profile Screen
 * Allows users to edit their profile information, upload profile picture, and manage projects
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { authAPI } from '../services/api';

const EditProfileScreen = ({ navigation, route }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profileData, setProfileData] = useState({
        full_name: '',
        bio: '',
        profile_photo: '',
        skills: [],
        interests: [],
    });
    const [darkMode, setDarkMode] = useState(false);
    const [newSkill, setNewSkill] = useState('');
    const [newInterest, setNewInterest] = useState('');

    useEffect(() => {
        loadProfile();
        loadDarkModePreference();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const user = await authAPI.getCurrentUser();
            setProfileData({
                full_name: user.full_name || '',
                bio: user.bio || '',
                profile_photo: user.profile_photo || '',
                skills: user.skills || [],
                interests: user.interests || [],
            });
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    const loadDarkModePreference = async () => {
        try {
            const darkModeValue = await AsyncStorage.getItem('darkMode');
            setDarkMode(darkModeValue === 'true');
        } catch (error) {
            console.error('Error loading dark mode preference:', error);
        }
    };

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a profile picture.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                // For now, just store the local URI
                // In production, you'd upload to a server/cloud storage
                setProfileData({ ...profileData, profile_photo: result.assets[0].uri });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);

            // Validate required fields
            if (!profileData.full_name.trim()) {
                Alert.alert('Validation Error', 'Please enter your full name');
                return;
            }

            await authAPI.updateProfile(profileData);

            // Update local storage
            const userData = await authAPI.getCurrentUser();
            await AsyncStorage.setItem('userData', JSON.stringify(userData));

            Alert.alert('Success', 'Profile updated successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleDarkModeToggle = async (value) => {
        setDarkMode(value);
        await AsyncStorage.setItem('darkMode', value.toString());
        // Note: Full dark mode implementation would require theme context
        Alert.alert('Dark Mode', value ? 'Dark mode enabled (restart app to apply)' : 'Dark mode disabled');
    };

    const handleAddSkill = () => {
        if (newSkill.trim()) {
            setProfileData({
                ...profileData,
                skills: [...profileData.skills, newSkill.trim()]
            });
            setNewSkill('');
        }
    };

    const handleRemoveSkill = (index) => {
        setProfileData({
            ...profileData,
            skills: profileData.skills.filter((_, i) => i !== index)
        });
    };

    const handleAddInterest = () => {
        if (newInterest.trim()) {
            setProfileData({
                ...profileData,
                interests: [...profileData.interests, newInterest.trim()]
            });
            setNewInterest('');
        }
    };

    const handleRemoveInterest = (index) => {
        setProfileData({
            ...profileData,
            interests: profileData.interests.filter((_, i) => i !== index)
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <TouchableOpacity
                        onPress={handleSaveProfile}
                        disabled={saving}
                        style={styles.saveButton}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={styles.saveButtonText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Profile Picture Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Profile Picture</Text>
                        <View style={styles.profilePictureContainer}>
                            <TouchableOpacity onPress={handlePickImage} style={styles.profilePictureWrapper}>
                                {profileData.profile_photo ? (
                                    <Image
                                        source={{ uri: profileData.profile_photo }}
                                        style={styles.profilePicture}
                                    />
                                ) : (
                                    <View style={styles.profilePicturePlaceholder}>
                                        <Icon name="person" size={60} color={colors.textLight} />
                                    </View>
                                )}
                                <View style={styles.cameraIconContainer}>
                                    <Icon name="camera" size={20} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                            <Text style={styles.profilePictureHint}>Tap to change photo</Text>
                        </View>
                    </View>

                    {/* Basic Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Basic Information</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={profileData.full_name}
                                onChangeText={(text) => setProfileData({ ...profileData, full_name: text })}
                                placeholder="Enter your full name"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={profileData.bio}
                                onChangeText={(text) => setProfileData({ ...profileData, bio: text })}
                                placeholder="Tell us about yourself..."
                                placeholderTextColor={colors.textLight}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                            <Text style={styles.charCount}>{profileData.bio.length}/500</Text>
                        </View>
                    </View>

                    {/* Skills Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Skills</Text>
                        <View style={styles.tagsContainer}>
                            {profileData.skills.map((skill, index) => (
                                <View key={index} style={styles.tag}>
                                    <Text style={styles.tagText}>{skill}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveSkill(index)}>
                                        <Icon name="close-circle" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        <View style={styles.addTagContainer}>
                            <TextInput
                                style={styles.tagInput}
                                value={newSkill}
                                onChangeText={setNewSkill}
                                placeholder="Add a skill"
                                placeholderTextColor={colors.textLight}
                                onSubmitEditing={handleAddSkill}
                            />
                            <TouchableOpacity onPress={handleAddSkill} style={styles.addTagButton}>
                                <Icon name="add-circle" size={28} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Interests Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Interests</Text>
                        <View style={styles.tagsContainer}>
                            {profileData.interests.map((interest, index) => (
                                <View key={index} style={styles.tag}>
                                    <Text style={styles.tagText}>{interest}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveInterest(index)}>
                                        <Icon name="close-circle" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        <View style={styles.addTagContainer}>
                            <TextInput
                                style={styles.tagInput}
                                value={newInterest}
                                onChangeText={setNewInterest}
                                placeholder="Add an interest"
                                placeholderTextColor={colors.textLight}
                                onSubmitEditing={handleAddInterest}
                            />
                            <TouchableOpacity onPress={handleAddInterest} style={styles.addTagButton}>
                                <Icon name="add-circle" size={28} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Preferences */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preferences</Text>
                        <View style={styles.preferenceItem}>
                            <View style={styles.preferenceLeft}>
                                <Icon name="moon" size={24} color={colors.text} />
                                <View style={styles.preferenceText}>
                                    <Text style={styles.preferenceTitle}>Dark Mode</Text>
                                    <Text style={styles.preferenceSubtitle}>Enable dark theme</Text>
                                </View>
                            </View>
                            <Switch
                                value={darkMode}
                                onValueChange={handleDarkModeToggle}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* Manage Projects Button */}
                    <TouchableOpacity
                        style={styles.manageButton}
                        onPress={() => navigation.navigate('ManageProjects')}
                    >
                        <Icon name="briefcase-outline" size={24} color={colors.primary} />
                        <Text style={styles.manageButtonText}>Manage Projects & Portfolio</Text>
                        <Icon name="chevron-forward" size={20} color={colors.textLight} />
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: spacing.md,
        ...typography.body,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
        fontWeight: '600',
    },
    saveButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    saveButtonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.text,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    profilePictureContainer: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    profilePictureWrapper: {
        position: 'relative',
    },
    profilePicture: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.surface,
    },
    profilePicturePlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    profilePictureHint: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.bodySmall,
        color: colors.text,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
    },
    textArea: {
        minHeight: 100,
        paddingTop: spacing.md,
    },
    charCount: {
        ...typography.caption,
        color: colors.textLight,
        textAlign: 'right',
        marginTop: spacing.xs,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.md,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
    },
    tagText: {
        ...typography.bodySmall,
        color: colors.primary,
        marginRight: spacing.xs,
    },
    addTagContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tagInput: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
        marginRight: spacing.sm,
    },
    addTagButton: {
        padding: spacing.xs,
    },
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    preferenceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    preferenceText: {
        marginLeft: spacing.md,
        flex: 1,
    },
    preferenceTitle: {
        ...typography.body,
        color: colors.text,
        fontWeight: '500',
    },
    preferenceSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    manageButtonText: {
        flex: 1,
        ...typography.body,
        color: colors.text,
        fontWeight: '500',
        marginLeft: spacing.md,
    },
});

export default EditProfileScreen;
