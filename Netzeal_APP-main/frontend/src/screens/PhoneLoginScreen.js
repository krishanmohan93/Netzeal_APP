/**
 * Phone Number Login Screen
 * Firebase Phone Authentication - Step 1: Enter Phone Number
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';

const PhoneLoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaVerifier = useRef(null);

  // Validate phone number (10 digits for India, adjust as needed)
  const isValidPhone = phoneNumber.replace(/\D/g, '').length === 10;

  // Format phone number with country code
  const formatPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    return `+91${cleaned}`; // Change +91 to your country code
  };

  // Send OTP using Firebase
  const handleSendOTP = async () => {
    if (!isValidPhone) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log('Sending OTP to:', formattedPhone);

      // Create phone auth provider
      const phoneProvider = new PhoneAuthProvider(auth);
      
      // Send verification code
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhone,
        recaptchaVerifier.current
      );

      console.log('Verification ID:', verificationId);

      // Navigate to OTP screen with verification ID and phone number
      navigation.navigate('OTPVerification', {
        verificationId,
        phoneNumber: formattedPhone
      });

    } catch (error) {
      console.error('OTP Send Error:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'Verification failed. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Format input to show as (XXX) XXX-XXXX
  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    setPhoneNumber(cleaned.slice(0, 10)); // Limit to 10 digits
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Firebase Recaptcha Verifier - Required for Expo */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={auth.app.options}
        attemptInvisibleVerification={true}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Enter your phone number</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code
          </Text>
        </View>

        {/* Phone Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <View style={styles.countryCodeContainer}>
              <Text style={styles.countryCode}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              maxLength={10}
              editable={!loading}
            />
          </View>

          {phoneNumber.length > 0 && phoneNumber.length < 10 && (
            <Text style={styles.helperText}>
              {10 - phoneNumber.length} more digits needed
            </Text>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!isValidPhone || loading) && styles.continueButtonDisabled
          ]}
          onPress={handleSendOTP}
          disabled={!isValidPhone || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        {/* Terms & Privacy */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text 
            style={styles.link}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text 
            style={styles.link}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            Privacy Policy
          </Text>
        </Text>

        {/* Login with Email Option */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.emailLoginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Ionicons name="mail-outline" size={20} color="#B8860B" />
          <Text style={styles.emailLoginText}>Login with Email</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  titleSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  inputSection: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  countryCodeContainer: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  countryCode: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    paddingVertical: 16,
    paddingLeft: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    marginLeft: 4,
  },
  continueButton: {
    backgroundColor: '#B8860B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#B8860B',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#D3D3D3',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  link: {
    color: '#B8860B',
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  emailLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#B8860B',
    gap: 8,
  },
  emailLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B8860B',
  },
});

export default PhoneLoginScreen;
