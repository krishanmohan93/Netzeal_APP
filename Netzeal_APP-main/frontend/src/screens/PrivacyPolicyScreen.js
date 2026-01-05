/**
 * Privacy Policy Screen
 * Professional privacy policy for the application
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyPolicyScreen = ({ navigation }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.section}>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subtitle}>
            Last Updated: {currentDate}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Your privacy is important to us. This Privacy Policy explains how{' '}
            <Text style={styles.bold}>Netzeal</Text> collects, uses, and
            protects your information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          
          <Text style={styles.subSectionTitle}>a. Phone Number</Text>
          <Text style={styles.paragraph}>Used for:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Account creation and registration
            </Text>
            <Text style={styles.bulletPoint}>
              • Login verification (OTP authentication)
            </Text>
            <Text style={styles.bulletPoint}>
              • Security notifications and alerts
            </Text>
            <Text style={styles.bulletPoint}>
              • Account recovery
            </Text>
          </View>

          <Text style={styles.subSectionTitle}>b. Device Information</Text>
          <Text style={styles.paragraph}>We may collect:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>• Device model and manufacturer</Text>
            <Text style={styles.bulletPoint}>
              • Operating system version (Android/iOS)
            </Text>
            <Text style={styles.bulletPoint}>• IP address and location data</Text>
            <Text style={styles.bulletPoint}>• App usage statistics and patterns</Text>
            <Text style={styles.bulletPoint}>• Device identifiers (UDID, IMEI)</Text>
            <Text style={styles.bulletPoint}>• Network information (WiFi/Mobile)</Text>
            <Text style={styles.bulletPoint}>• Browser type and version</Text>
          </View>
          <Text style={styles.paragraph}>
            This information is used for analytics, security, fraud prevention,
            and improving app performance.
          </Text>

          <Text style={styles.subSectionTitle}>c. Uploaded Media</Text>
          <Text style={styles.paragraph}>
            If your app supports image/video upload:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • We store files securely using Cloudinary / Firebase Storage
            </Text>
            <Text style={styles.bulletPoint}>
              • Files are encrypted during transmission
            </Text>
            <Text style={styles.bulletPoint}>
              • You can delete your uploaded content at any time
            </Text>
            <Text style={styles.bulletPoint}>
              • Media is accessible only to authorized users
            </Text>
          </View>

          <Text style={styles.subSectionTitle}>d. Usage Data</Text>
          <Text style={styles.paragraph}>We collect:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Features and pages you interact with
            </Text>
            <Text style={styles.bulletPoint}>
              • Time spent on different screens
            </Text>
            <Text style={styles.bulletPoint}>
              • Actions performed within the app
            </Text>
            <Text style={styles.bulletPoint}>
              • Error logs and crash reports
            </Text>
            <Text style={styles.bulletPoint}>
              • Performance metrics
            </Text>
          </View>

          <Text style={styles.subSectionTitle}>e. Profile Information</Text>
          <Text style={styles.paragraph}>
            Information you voluntarily provide:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>• Username and display name</Text>
            <Text style={styles.bulletPoint}>• Profile photo</Text>
            <Text style={styles.bulletPoint}>• Bio and description</Text>
            <Text style={styles.bulletPoint}>
              • Professional details (education, work experience)
            </Text>
            <Text style={styles.bulletPoint}>
              • Skills and interests
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. How We Use Your Information
          </Text>
          <Text style={styles.paragraph}>We use collected data to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Authenticate your account securely
            </Text>
            <Text style={styles.bulletPoint}>
              • Improve app performance and user experience
            </Text>
            <Text style={styles.bulletPoint}>
              • Provide personalized content and recommendations
            </Text>
            <Text style={styles.bulletPoint}>
              • Provide customer support and respond to inquiries
            </Text>
            <Text style={styles.bulletPoint}>
              • Ensure security and prevent fraud
            </Text>
            <Text style={styles.bulletPoint}>
              • Comply with legal obligations
            </Text>
            <Text style={styles.bulletPoint}>
              • Send important service notifications
            </Text>
            <Text style={styles.bulletPoint}>
              • Analyze usage patterns and trends
            </Text>
            <Text style={styles.bulletPoint}>
              • Develop new features and services
            </Text>
          </View>
          <Text style={styles.highlightBox}>
            We do not sell your information to third parties for advertising or
            marketing purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Sharing Your Information</Text>
          <Text style={styles.paragraph}>
            We may share your data with trusted third-party services:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • OTP/SMS providers (Firebase Authentication)
            </Text>
            <Text style={styles.bulletPoint}>
              • Cloud storage services (Cloudinary, Firebase Storage)
            </Text>
            <Text style={styles.bulletPoint}>
              • Analytics tools (Firebase Analytics, Google Analytics)
            </Text>
            <Text style={styles.bulletPoint}>
              • Crash reporting services (Sentry, Firebase Crashlytics)
            </Text>
            <Text style={styles.bulletPoint}>
              • Payment processors (if applicable)
            </Text>
          </View>
          <Text style={styles.paragraph}>
            These services only receive information required to perform their
            specific function and are bound by confidentiality agreements.
          </Text>
          <Text style={styles.highlightBox}>
            We never share your data for advertising purposes or sell it to data
            brokers.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We use industry-standard security practices to protect your data:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Encrypted network communication (HTTPS/TLS)
            </Text>
            <Text style={styles.bulletPoint}>
              • Secure cloud storage with encryption at rest
            </Text>
            <Text style={styles.bulletPoint}>
              • OTP-based two-factor authentication
            </Text>
            <Text style={styles.bulletPoint}>
              • Regular security audits and vulnerability testing
            </Text>
            <Text style={styles.bulletPoint}>
              • Secure server infrastructure
            </Text>
            <Text style={styles.bulletPoint}>
              • Access controls and authentication
            </Text>
            <Text style={styles.bulletPoint}>
              • Encrypted database storage
            </Text>
            <Text style={styles.bulletPoint}>
              • Secure token management (SecureStore)
            </Text>
          </View>
          <Text style={styles.paragraph}>
            However, no system is 100% secure. We cannot guarantee absolute
            security but continuously work to improve our protection measures.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your information for as long as:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Your account remains active
            </Text>
            <Text style={styles.bulletPoint}>
              • Necessary to provide our services
            </Text>
            <Text style={styles.bulletPoint}>
              • Required by law or regulation
            </Text>
            <Text style={styles.bulletPoint}>
              • Needed for dispute resolution
            </Text>
          </View>
          <Text style={styles.paragraph}>
            When you delete your account, we remove your personal data within 30
            days, except where retention is legally required.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. User Rights</Text>
          <Text style={styles.paragraph}>You have the right to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Access your personal data
            </Text>
            <Text style={styles.bulletPoint}>
              • Update your account information
            </Text>
            <Text style={styles.bulletPoint}>
              • Delete your account and data
            </Text>
            <Text style={styles.bulletPoint}>
              • Export your data in a portable format
            </Text>
            <Text style={styles.bulletPoint}>
              • Opt-out of non-essential data collection
            </Text>
            <Text style={styles.bulletPoint}>
              • Withdraw consent at any time
            </Text>
            <Text style={styles.bulletPoint}>
              • Lodge a complaint with a supervisory authority
            </Text>
          </View>
          <Text style={styles.paragraph}>
            To exercise these rights, contact us at:
          </Text>
          <View style={styles.contactBox}>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Cookies & Tracking</Text>
          <Text style={styles.paragraph}>
            We may use cookies or similar technologies for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Analytics and usage tracking
            </Text>
            <Text style={styles.bulletPoint}>
              • Security and fraud prevention
            </Text>
            <Text style={styles.bulletPoint}>
              • Improving user experience
            </Text>
            <Text style={styles.bulletPoint}>
              • Remembering your preferences
            </Text>
            <Text style={styles.bulletPoint}>
              • Session management
            </Text>
          </View>
          <Text style={styles.paragraph}>
            You can control cookie preferences through your device settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            We do not knowingly collect data from children under 13 years of
            age. If we discover that a child under 13 has provided personal
            information, we will:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Delete the information immediately
            </Text>
            <Text style={styles.bulletPoint}>
              • Terminate the account
            </Text>
            <Text style={styles.bulletPoint}>
              • Notify the parent or guardian if possible
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Users between 13-18 must have parental consent to use the service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. International Data Transfers</Text>
          <Text style={styles.paragraph}>
            Your data may be transferred to and processed in countries other
            than your own. We ensure appropriate safeguards are in place,
            including:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Standard contractual clauses
            </Text>
            <Text style={styles.bulletPoint}>
              • Adequate data protection certifications
            </Text>
            <Text style={styles.bulletPoint}>
              • Compliance with GDPR, CCPA, and other regulations
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time to reflect
            changes in:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Our data practices
            </Text>
            <Text style={styles.bulletPoint}>
              • Legal requirements
            </Text>
            <Text style={styles.bulletPoint}>
              • New features or services
            </Text>
          </View>
          <Text style={styles.paragraph}>
            We will notify you of significant changes via:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • In-app notifications
            </Text>
            <Text style={styles.bulletPoint}>
              • SMS to your registered phone number
            </Text>
            <Text style={styles.bulletPoint}>
              • Updated "Last Updated" date at the top
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Continued use of the app after changes means you accept the updated
            policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.paragraph}>
            For privacy-related questions, concerns, or requests, please contact:
          </Text>
          <View style={styles.contactBox}>
            <Text style={styles.contactLabel}>General Inquiries:</Text>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
            <Text style={styles.contactLabel}>Privacy Officer:</Text>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
            <Text style={styles.contactLabel}>Data Protection:</Text>
            <Text style={styles.contactValue}>privacy@netzeal.in</Text>
            <Text style={styles.contactLabel}>Support:</Text>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
          </View>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.footerText}>
            By using Netzeal, you acknowledge that you have read and understood
            this Privacy Policy and agree to the collection, use, and disclosure
            of your information as described herein.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#B8860B',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: '#B8860B',
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    marginBottom: 6,
  },
  highlightBox: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#B8860B',
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    fontWeight: '500',
  },
  contactBox: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  contactValue: {
    fontSize: 15,
    color: '#B8860B',
    fontWeight: '500',
    marginTop: 2,
  },
  footerSection: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PrivacyPolicyScreen;
