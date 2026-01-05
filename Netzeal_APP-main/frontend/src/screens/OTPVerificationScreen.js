/**
 * OTP Verification Screen
 * Firebase Phone Authentication - Step 2: Verify OTP Code
 */
import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as SecureStore from 'expo-secure-store';

const OTPVerificationScreen = ({ route, navigation }) => {
  const { verificationId, phoneNumber } = route.params;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  
  // Refs for OTP input boxes
  const inputRefs = useRef([]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Handle OTP input change
  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  // Handle backspace
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP with Firebase
  const handleVerifyOTP = async (code = otp.join('')) => {
    if (code.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);

    try {
      console.log('Verifying OTP:', code);

      // Create credential with verification ID and OTP code
      const credential = PhoneAuthProvider.credential(verificationId, code);
      
      // Sign in with credential
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      console.log('User signed in:', user.uid);

      // Get Firebase ID token
      const idToken = await user.getIdToken();
      console.log('Got Firebase ID token');

      // Save token securely
      await SecureStore.setItemAsync('firebaseToken', idToken);
      await SecureStore.setItemAsync('userId', user.uid);
      await SecureStore.setItemAsync('phoneNumber', user.phoneNumber);

      // Optional: Send token to backend for verification
      await verifyWithBackend(idToken);

      // Navigate to home
      Alert.alert('Success', 'Phone number verified successfully!', [
        {
          text: 'Continue',
          onPress: () => {
            // Reset navigation stack and go to Main
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }
        }
      ]);

    } catch (error) {
      console.error('OTP Verification Error:', error);
      
      let errorMessage = 'Verification failed. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid OTP code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP code expired. Please request a new one.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Verification Failed', errorMessage);
      
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Verify token with backend (optional)
  const verifyWithBackend = async (idToken) => {
    try {
      const response = await fetch('http://10.97.116.75:8000/api/v1/auth/verify-firebase-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Backend verification successful:', data);
        
        // Save backend tokens if provided
        if (data.access_token) {
          await SecureStore.setItemAsync('access_token', data.access_token);
        }
        if (data.refresh_token) {
          await SecureStore.setItemAsync('refresh_token', data.refresh_token);
        }
      } else {
        console.warn('Backend verification failed:', response.status);
      }
    } catch (error) {
      console.error('Backend verification error:', error);
      // Don't fail the login if backend verification fails
    }
  };

  // Resend OTP
  const handleResendOTP = () => {
    setResendTimer(30);
    setCanResend(false);
    
    // Navigate back to phone login to resend
    Alert.alert(
      'Resend OTP',
      'Return to the previous screen to resend OTP',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color="#B8860B" />
        </View>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a code to {phoneNumber}
        </Text>
      </View>

      {/* OTP Input Boxes */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit && styles.otpInputFilled
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!loading}
          />
        ))}
      </View>

      {/* Resend OTP */}
      <View style={styles.resendContainer}>
        {canResend ? (
          <TouchableOpacity onPress={handleResendOTP}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.timerText}>
            Resend OTP in {resendTimer}s
          </Text>
        )}
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[
          styles.verifyButton,
          (otp.some(d => !d) || loading) && styles.verifyButtonDisabled
        ]}
        onPress={() => handleVerifyOTP()}
        disabled={otp.some(d => !d) || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.verifyButtonText}>Verify & Continue</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
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
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8DC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  otpInputFilled: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF8DC',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resendText: {
    fontSize: 15,
    color: '#B8860B',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 14,
    color: '#999',
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    backgroundColor: '#D3D3D3',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default OTPVerificationScreen;
