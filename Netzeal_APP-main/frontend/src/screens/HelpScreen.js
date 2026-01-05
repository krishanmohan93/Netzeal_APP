/**
 * Help & Support Screen - FAQs, contact support, documentation
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';

const FAQItem = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestion}>{question}</Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textLight}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

const QuickLinkCard = ({ icon, title, subtitle, onPress, color }) => (
  <TouchableOpacity style={styles.quickLinkCard} onPress={onPress}>
    <View style={[styles.quickLinkIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={28} color={color} />
    </View>
    <View style={styles.quickLinkText}>
      <Text style={styles.quickLinkTitle}>{title}</Text>
      <Text style={styles.quickLinkSubtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-forward" size={20} color={colors.textLight} />
  </TouchableOpacity>
);

const HelpScreen = ({ navigation }) => {
  const [supportMessage, setSupportMessage] = useState('');

  const faqs = [
    {
      question: 'How do I update my profile?',
      answer: 'Go to your Profile tab, tap the edit button, and update your information including skills, interests, bio, and profile photo.',
    },
    {
      question: 'How does the AI Assistant work?',
      answer: 'Our AI Assistant analyzes your profile, skills, and interests to provide personalized career guidance, learning recommendations, and project ideas. It learns from your activity to give better suggestions over time.',
    },
    {
      question: 'How can I connect with other developers?',
      answer: 'Browse the Home feed, discover developers in your field, and send connection requests. You can also join communities and engage with posts to grow your network.',
    },
    {
      question: 'What are skill recommendations based on?',
      answer: 'Skill recommendations are based on your current skills, career goals, industry trends, and what successful developers in your field are learning.',
    },
    {
      question: 'Can I share my projects?',
      answer: 'Yes! Use the Create Post button to share your projects, code snippets, tutorials, or achievements. You can add images, links, and detailed descriptions.',
    },
    {
      question: 'How do notifications work?',
      answer: 'You\'ll receive notifications for connection requests, post interactions, messages, and personalized recommendations. Manage your notification preferences in Settings.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we take security seriously. Your data is encrypted, and we never share your personal information without consent. Read our Privacy Policy for details.',
    },
  ];

  const handleContactSupport = () => {
    if (supportMessage.trim()) {
      Alert.alert(
        'Message Sent',
        'Thank you for contacting us! We\'ll get back to you within 24 hours.',
        [{ text: 'OK', onPress: () => setSupportMessage('') }]
      );
    } else {
      Alert.alert('Message Empty', 'Please enter a message before sending.');
    }
  };

  const openEmail = () => {
    Linking.openURL('mailto:support@netzeal.com?subject=Support Request');
  };

  const openWebsite = () => {
    Linking.openURL('https://netzeal.com/help');
  };

  const openCommunity = () => {
    Alert.alert('Coming Soon', 'Community forums coming soon!');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>How can we help you?</Text>
          <Text style={styles.headerSubtitle}>
            Find answers, contact support, or explore resources
          </Text>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <QuickLinkCard
            icon="mail-outline"
            title="Email Support"
            subtitle="Get help via email"
            onPress={openEmail}
            color={colors.primary}
          />
          <QuickLinkCard
            icon="globe-outline"
            title="Help Center"
            subtitle="Browse documentation"
            onPress={openWebsite}
            color={colors.secondary}
          />
          <QuickLinkCard
            icon="people-outline"
            title="Community Forums"
            subtitle="Ask the community"
            onPress={openCommunity}
            color="#10B981"
          />
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
          <View style={styles.faqContainer}>
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SEND US A MESSAGE</Text>
          <View style={styles.contactForm}>
            <Text style={styles.contactFormLabel}>Describe your issue or question</Text>
            <TextInput
              style={styles.contactInput}
              placeholder="Type your message here..."
              multiline
              numberOfLines={6}
              value={supportMessage}
              onChangeText={setSupportMessage}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleContactSupport}>
              <Text style={styles.submitButtonText}>Send Message</Text>
              <Icon name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESOURCES</Text>
          <View style={styles.resourcesContainer}>
            <TouchableOpacity style={styles.resourceItem}>
              <Icon name="book-outline" size={20} color={colors.primary} />
              <Text style={styles.resourceText}>User Guide</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceItem}>
              <Icon name="videocam-outline" size={20} color={colors.primary} />
              <Text style={styles.resourceText}>Video Tutorials</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceItem}>
              <Icon name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.resourceText}>API Docs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resourceItem}>
              <Icon name="logo-github" size={20} color={colors.primary} />
              <Text style={styles.resourceText}>GitHub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Still need help? Email us at{' '}
            <Text style={styles.footerLink}>support@netzeal.com</Text>
          </Text>
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
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textLight,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  quickLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quickLinkText: {
    flex: 1,
  },
  quickLinkTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  quickLinkSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  faqContainer: {
    marginHorizontal: spacing.md,
  },
  faqItem: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  faqQuestion: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  faqAnswerText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  contactForm: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactFormLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  contactInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resourcesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  resourceText: {
    ...typography.body,
    color: colors.text,
  },
  footer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default HelpScreen;
