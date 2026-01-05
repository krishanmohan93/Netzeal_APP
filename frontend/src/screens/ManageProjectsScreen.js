/**
 * Manage Projects Screen
 * Allows users to add, edit, and delete their projects and portfolio items
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { authAPI } from '../services/api';

const ManageProjectsScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [experience, setExperience] = useState([]);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [editingExperience, setEditingExperience] = useState(null);

    // Project form state
    const [projectForm, setProjectForm] = useState({
        title: '',
        subtitle: '',
        description: '',
        icon: 'briefcase',
    });

    // Experience form state
    const [experienceForm, setExperienceForm] = useState({
        title: '',
        role: '',
        year: '',
        icon: 'business',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load from AsyncStorage (local cache)
            const projectsData = await AsyncStorage.getItem('user_projects');
            const experienceData = await AsyncStorage.getItem('user_experience');

            if (projectsData) setProjects(JSON.parse(projectsData));
            if (experienceData) setExperience(JSON.parse(experienceData));

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveData = async () => {
        try {
            await AsyncStorage.setItem('user_projects', JSON.stringify(projects));
            await AsyncStorage.setItem('user_experience', JSON.stringify(experience));

            // In production, also sync to backend
            // await authAPI.updateProfile({ projects, work_experience: experience });
        } catch (error) {
            console.error('Error saving data:', error);
            Alert.alert('Error', 'Failed to save changes');
        }
    };

    // Project Management
    const handleAddProject = () => {
        setEditingProject(null);
        setProjectForm({
            title: '',
            subtitle: '',
            description: '',
            icon: 'briefcase',
        });
        setShowProjectModal(true);
    };

    const handleEditProject = (project, index) => {
        setEditingProject(index);
        setProjectForm(project);
        setShowProjectModal(true);
    };

    const handleSaveProject = async () => {
        if (!projectForm.title.trim()) {
            Alert.alert('Validation Error', 'Please enter a project title');
            return;
        }

        const newProject = {
            ...projectForm,
            id: editingProject !== null ? projects[editingProject].id : Date.now().toString(),
        };

        let updatedProjects;
        if (editingProject !== null) {
            updatedProjects = [...projects];
            updatedProjects[editingProject] = newProject;
        } else {
            updatedProjects = [...projects, newProject];
        }

        setProjects(updatedProjects);
        await AsyncStorage.setItem('user_projects', JSON.stringify(updatedProjects));
        setShowProjectModal(false);
        Alert.alert('Success', editingProject !== null ? 'Project updated' : 'Project added');
    };

    const handleDeleteProject = (index) => {
        Alert.alert(
            'Delete Project',
            'Are you sure you want to delete this project?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updatedProjects = projects.filter((_, i) => i !== index);
                        setProjects(updatedProjects);
                        await AsyncStorage.setItem('user_projects', JSON.stringify(updatedProjects));
                        Alert.alert('Success', 'Project deleted');
                    },
                },
            ]
        );
    };

    // Experience Management
    const handleAddExperience = () => {
        setEditingExperience(null);
        setExperienceForm({
            title: '',
            role: '',
            year: '',
            icon: 'business',
        });
        setShowExperienceModal(true);
    };

    const handleEditExperience = (exp, index) => {
        setEditingExperience(index);
        setExperienceForm(exp);
        setShowExperienceModal(true);
    };

    const handleSaveExperience = async () => {
        if (!experienceForm.title.trim()) {
            Alert.alert('Validation Error', 'Please enter a title');
            return;
        }

        const newExperience = {
            ...experienceForm,
            id: editingExperience !== null ? experience[editingExperience].id : Date.now().toString(),
        };

        let updatedExperience;
        if (editingExperience !== null) {
            updatedExperience = [...experience];
            updatedExperience[editingExperience] = newExperience;
        } else {
            updatedExperience = [...experience, newExperience];
        }

        setExperience(updatedExperience);
        await AsyncStorage.setItem('user_experience', JSON.stringify(updatedExperience));
        setShowExperienceModal(false);
        Alert.alert('Success', editingExperience !== null ? 'Experience updated' : 'Experience added');
    };

    const handleDeleteExperience = (index) => {
        Alert.alert(
            'Delete Experience',
            'Are you sure you want to delete this experience?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updatedExperience = experience.filter((_, i) => i !== index);
                        setExperience(updatedExperience);
                        await AsyncStorage.setItem('user_experience', JSON.stringify(updatedExperience));
                        Alert.alert('Success', 'Experience deleted');
                    },
                },
            ]
        );
    };

    const renderProjectModal = () => (
        <Modal
            visible={showProjectModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowProjectModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editingProject !== null ? 'Edit Project' : 'Add Project'}
                        </Text>
                        <TouchableOpacity onPress={() => setShowProjectModal(false)}>
                            <Icon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Project Title *</Text>
                            <TextInput
                                style={styles.input}
                                value={projectForm.title}
                                onChangeText={(text) => setProjectForm({ ...projectForm, title: text })}
                                placeholder="e.g., AI Platform"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Subtitle</Text>
                            <TextInput
                                style={styles.input}
                                value={projectForm.subtitle}
                                onChangeText={(text) => setProjectForm({ ...projectForm, subtitle: text })}
                                placeholder="e.g., Machine Learning"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={projectForm.description}
                                onChangeText={(text) => setProjectForm({ ...projectForm, description: text })}
                                placeholder="Describe your project..."
                                placeholderTextColor={colors.textLight}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={() => setShowProjectModal(false)}
                        >
                            <Text style={styles.buttonSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={handleSaveProject}
                        >
                            <Text style={styles.buttonPrimaryText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderExperienceModal = () => (
        <Modal
            visible={showExperienceModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowExperienceModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editingExperience !== null ? 'Edit Experience' : 'Add Experience'}
                        </Text>
                        <TouchableOpacity onPress={() => setShowExperienceModal(false)}>
                            <Icon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Title *</Text>
                            <TextInput
                                style={styles.input}
                                value={experienceForm.title}
                                onChangeText={(text) => setExperienceForm({ ...experienceForm, title: text })}
                                placeholder="e.g., Senior Developer at Company"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Role</Text>
                            <TextInput
                                style={styles.input}
                                value={experienceForm.role}
                                onChangeText={(text) => setExperienceForm({ ...experienceForm, role: text })}
                                placeholder="e.g., Full Stack Development"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Year/Duration</Text>
                            <TextInput
                                style={styles.input}
                                value={experienceForm.year}
                                onChangeText={(text) => setExperienceForm({ ...experienceForm, year: text })}
                                placeholder="e.g., [2020 - Present]"
                                placeholderTextColor={colors.textLight}
                            />
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={() => setShowExperienceModal(false)}
                        >
                            <Text style={styles.buttonSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={handleSaveExperience}
                        >
                            <Text style={styles.buttonPrimaryText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
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
                    <Text style={styles.headerTitle}>Manage Portfolio</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Projects Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Projects</Text>
                            <TouchableOpacity onPress={handleAddProject} style={styles.addButton}>
                                <Icon name="add-circle" size={28} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                        {projects.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Icon name="briefcase-outline" size={48} color={colors.textLight} />
                                <Text style={styles.emptyStateText}>No projects yet</Text>
                                <Text style={styles.emptyStateSubtext}>Tap + to add your first project</Text>
                            </View>
                        ) : (
                            projects.map((project, index) => (
                                <View key={project.id} style={styles.card}>
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardIcon}>
                                            <Icon name="briefcase" size={24} color={colors.primary} />
                                        </View>
                                        <View style={styles.cardText}>
                                            <Text style={styles.cardTitle}>{project.title}</Text>
                                            {project.subtitle && (
                                                <Text style={styles.cardSubtitle}>{project.subtitle}</Text>
                                            )}
                                            {project.description && (
                                                <Text style={styles.cardDescription} numberOfLines={2}>
                                                    {project.description}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity
                                            onPress={() => handleEditProject(project, index)}
                                            style={styles.cardActionButton}
                                        >
                                            <Icon name="create-outline" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteProject(index)}
                                            style={styles.cardActionButton}
                                        >
                                            <Icon name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Experience Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Experience</Text>
                            <TouchableOpacity onPress={handleAddExperience} style={styles.addButton}>
                                <Icon name="add-circle" size={28} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                        {experience.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Icon name="business-outline" size={48} color={colors.textLight} />
                                <Text style={styles.emptyStateText}>No experience yet</Text>
                                <Text style={styles.emptyStateSubtext}>Tap + to add your experience</Text>
                            </View>
                        ) : (
                            experience.map((exp, index) => (
                                <View key={exp.id} style={styles.card}>
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardIcon}>
                                            <Icon name="business" size={24} color={colors.primary} />
                                        </View>
                                        <View style={styles.cardText}>
                                            <Text style={styles.cardTitle}>{exp.title}</Text>
                                            {exp.role && <Text style={styles.cardSubtitle}>{exp.role}</Text>}
                                            {exp.year && <Text style={styles.cardYear}>{exp.year}</Text>}
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity
                                            onPress={() => handleEditExperience(exp, index)}
                                            style={styles.cardActionButton}
                                        >
                                            <Icon name="create-outline" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteExperience(index)}
                                            style={styles.cardActionButton}
                                        >
                                            <Icon name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>

                {renderProjectModal()}
                {renderExperienceModal()}
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
    scrollView: {
        flex: 1,
    },
    section: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.text,
        fontWeight: '600',
    },
    addButton: {
        padding: spacing.xs,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyStateText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    emptyStateSubtext: {
        ...typography.caption,
        color: colors.textLight,
        marginTop: spacing.xs,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    cardContent: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    cardSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    cardDescription: {
        ...typography.caption,
        color: colors.textLight,
        lineHeight: 18,
    },
    cardYear: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '500',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    cardActionButton: {
        padding: spacing.sm,
        marginLeft: spacing.sm,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        ...typography.h3,
        color: colors.text,
        fontWeight: '600',
    },
    modalBody: {
        padding: spacing.lg,
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
    modalFooter: {
        flexDirection: 'row',
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    buttonSecondary: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: spacing.sm,
    },
    buttonSecondaryText: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
    },
    buttonPrimary: {
        backgroundColor: colors.primary,
        marginLeft: spacing.sm,
    },
    buttonPrimaryText: {
        ...typography.body,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default ManageProjectsScreen;
