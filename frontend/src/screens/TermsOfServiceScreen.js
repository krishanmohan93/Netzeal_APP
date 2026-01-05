/**
 * Terms of Service Screen
 * Professional legal terms for the application
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

const TermsOfServiceScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.section}>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.subtitle}>
            Last Updated: {currentDate}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Welcome to <Text style={styles.bold}>Netzeal</Text>. By creating an
            account or using our services, you agree to the following Terms of
            Service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using our app, you confirm that you have read,
            understood, and agree to be bound by these Terms of Service. If you
            do not agree to these terms, please discontinue use of the
            application immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Eligibility</Text>
          <Text style={styles.paragraph}>
            You must be at least 13 years old to use this app. By using the
            app, you confirm that all information you provide is accurate and
            complete. Users under 18 must have parental or guardian consent to
            use this service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Registration</Text>
          <Text style={styles.paragraph}>
            To use our app, you must register using your phone number.
          </Text>
          <Text style={styles.paragraph}>You agree to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Provide a valid phone number
            </Text>
            <Text style={styles.bulletPoint}>
              • Verify your identity using the OTP sent to your device
            </Text>
            <Text style={styles.bulletPoint}>
              • Maintain the confidentiality of your account credentials
            </Text>
            <Text style={styles.bulletPoint}>
              • Notify us immediately of any unauthorized account access
            </Text>
            <Text style={styles.bulletPoint}>
              • Be responsible for all activities under your account
            </Text>
          </View>
          <Text style={styles.paragraph}>
            We are not responsible for any unauthorized access to your account
            due to your failure to keep your credentials secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Use of Services</Text>
          <Text style={styles.paragraph}>You agree not to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Use the app for illegal or harmful activities
            </Text>
            <Text style={styles.bulletPoint}>
              • Attempt to hack, reverse engineer, or disrupt our systems
            </Text>
            <Text style={styles.bulletPoint}>
              • Upload or send harmful, spam, or abusive content
            </Text>
            <Text style={styles.bulletPoint}>
              • Impersonate others or create fake accounts
            </Text>
            <Text style={styles.bulletPoint}>
              • Scrape, data mine, or harvest information from the platform
            </Text>
            <Text style={styles.bulletPoint}>
              • Interfere with other users' access to the service
            </Text>
            <Text style={styles.bulletPoint}>
              • Distribute malware, viruses, or harmful code
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Violation of these rules may result in account suspension or
            permanent ban without prior notice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. User Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of any content you post, upload, or share
            through the app. However, by posting content, you grant Netzeal a
            worldwide, non-exclusive, royalty-free license to use, display,
            reproduce, and distribute your content within the app.
          </Text>
          <Text style={styles.paragraph}>
            You are responsible for ensuring that your content does not violate
            any laws, infringe on intellectual property rights, or contain
            offensive material.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            All content, designs, logos, and features in the app belong to
            Netzeal. You may not copy, modify, or distribute our assets without
            explicit written permission. This includes but is not limited to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>• Application source code</Text>
            <Text style={styles.bulletPoint}>• UI/UX designs and layouts</Text>
            <Text style={styles.bulletPoint}>
              • Trademarks, logos, and branding
            </Text>
            <Text style={styles.bulletPoint}>
              • Proprietary algorithms and features
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            Our app may integrate with third-party services including:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • SMS/OTP providers (Firebase Authentication)
            </Text>
            <Text style={styles.bulletPoint}>
              • Cloud storage (Cloudinary, Firebase Storage)
            </Text>
            <Text style={styles.bulletPoint}>
              • Analytics tools (Firebase Analytics)
            </Text>
            <Text style={styles.bulletPoint}>
              • Payment gateways (if applicable)
            </Text>
            <Text style={styles.bulletPoint}>
              • Social media integration
            </Text>
          </View>
          <Text style={styles.paragraph}>
            We are not responsible for their policies, actions, or service
            availability. Please review their terms and privacy policies
            separately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Netzeal is provided "as is" without warranties of any kind. We are
            not liable for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Service interruptions or downtime
            </Text>
            <Text style={styles.bulletPoint}>
              • Data loss due to technical issues
            </Text>
            <Text style={styles.bulletPoint}>
              • Unauthorized account access due to user negligence
            </Text>
            <Text style={styles.bulletPoint}>
              • Content posted by other users
            </Text>
            <Text style={styles.bulletPoint}>
              • Indirect, incidental, or consequential damages
            </Text>
            <Text style={styles.bulletPoint}>
              • Lost profits or business opportunities
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Use the app at your own risk. Our maximum liability shall not
            exceed the amount paid by you (if any) in the last 12 months.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or close your account if:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • You violate these terms of service
            </Text>
            <Text style={styles.bulletPoint}>
              • You engage in fraudulent or illegal activities
            </Text>
            <Text style={styles.bulletPoint}>
              • Your account remains inactive for an extended period
            </Text>
            <Text style={styles.bulletPoint}>
              • We are required to do so by law
            </Text>
          </View>
          <Text style={styles.paragraph}>
            You may stop using the app and delete your account at any time
            through the settings menu or by contacting support.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            10. Dispute Resolution
          </Text>
          <Text style={styles.paragraph}>
            Any disputes arising from these terms shall be resolved through:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • Initial contact with customer support
            </Text>
            <Text style={styles.bulletPoint}>
              • Mediation if direct resolution fails
            </Text>
            <Text style={styles.bulletPoint}>
              • Binding arbitration as a final resort
            </Text>
          </View>
          <Text style={styles.paragraph}>
            These terms are governed by the laws of your jurisdiction.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms from time to time. We will notify you of
            significant changes via:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletPoint}>
              • In-app notifications
            </Text>
            <Text style={styles.bulletPoint}>
              • Email (if provided)
            </Text>
            <Text style={styles.bulletPoint}>
              • SMS to your registered phone number
            </Text>
          </View>
          <Text style={styles.paragraph}>
            Continued use of the app after changes means you accept the updated
            Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms of Service, please
            contact us at:
          </Text>
          <View style={styles.contactBox}>
            <Text style={styles.contactLabel}>Email:</Text>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
            <Text style={styles.contactLabel}>Support:</Text>
            <Text style={styles.contactValue}>netzeal.in@gmail.com</Text>
            <Text style={styles.contactLabel}>Legal:</Text>
            <Text style={styles.contactValue}>legal@netzeal.in</Text>
          </View>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.footerText}>
            By using Netzeal, you acknowledge that you have read and understood
            these Terms of Service and agree to be bound by them.
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

export default TermsOfServiceScreen;
