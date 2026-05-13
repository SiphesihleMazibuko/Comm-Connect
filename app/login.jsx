import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { router } from 'expo-router';
import { signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db, firebaseConfig } from '../config/firebase';
import colors from '../Utils/colors';

const COUNTRY_CODES = [
  { code: '+27', flag: '🇿🇦', name: 'ZA' },
  { code: '+1',  flag: '🇺🇸', name: 'US' },
  { code: '+44', flag: '🇬🇧', name: 'GB' },
  { code: '+91', flag: '🇮🇳', name: 'IN' },
  { code: '+61', flag: '🇦🇺', name: 'AU' },
];

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [confirmation, setConfirmation] = useState(null); // stores the signInWithPhoneNumber result
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('phone');

  const otpRefs = useRef([]);
  const recaptchaVerifier = useRef(null); // ref for the reCAPTCHA modal

  const handleSendOTP = async () => {
    const cleaned = phoneNumber.trim().replace(/\s/g, '');
    if (!cleaned) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    const local = cleaned.replace(/^0/, '');
    const e164 = `${selectedCountry.code}${local}`;

    setLoading(true);
    try {
      // Pass the recaptchaVerifier ref — required for native reCAPTCHA verification
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        e164,
        recaptchaVerifier.current
      );
      setConfirmation(confirmationResult);
      setStep('otp');
      Alert.alert('OTP Sent', `A verification code was sent to ${e164}`);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    if (value.length > 1) {
      const digits = value.split('').slice(0, OTP_LENGTH - index);
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length < OTP_LENGTH) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP');
      return;
    }
    if (!confirmation) {
      Alert.alert('Error', 'No verification session found. Please request a new OTP.');
      return;
    }

    setLoading(true);
    try {
      // Use confirmation.confirm() instead of PhoneAuthProvider.credential + signInWithCredential
      const userCredential = await confirmation.confirm(otpString);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        router.replace('/(tabs)/communityfeed');
        return;
      }

      const userData = userSnap.data();

      if (['resident', 'community_leader', 'emergency_responder'].includes(userData.role)) {
        router.replace('/(tabs)/communityfeed');
      } else {
        Alert.alert('Error', 'Invalid user role');
      }
    } catch (error) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setConfirmation(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/*
        FirebaseRecaptchaVerifierModal must be rendered in the tree.
        attemptInvisibleVerification={true} tries invisible reCAPTCHA first
        and only shows the modal if that fails.
      */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 80,
            height: 80,
            backgroundColor: colors.primary,
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 40 }}>🤝</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>Welcome Back</Text>
          <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>
            {step === 'phone'
              ? 'Sign in with your phone number'
              : 'Enter the code sent to your phone'}
          </Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
              Phone Number
            </Text>

            {/* Phone input row */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {/* Country code button */}
              <TouchableOpacity
                onPress={() => setShowCountryPicker(!showCountryPicker)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>
                  {selectedCountry.code}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textLight }}>▼</Text>
              </TouchableOpacity>

              {/* Number input */}
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder="81 234 5678"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            {/* Country picker dropdown */}
            {showCountryPicker && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 12,
                overflow: 'hidden',
              }}>
                {COUNTRY_CODES.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    onPress={() => {
                      setSelectedCountry(country);
                      setShowCountryPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.border,
                      backgroundColor:
                        selectedCountry.code === country.code
                          ? colors.background
                          : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                    <Text style={{ fontSize: 15, color: colors.text }}>{country.name}</Text>
                    <Text style={{ fontSize: 15, color: colors.textLight, marginLeft: 'auto' }}>
                      {country.code}
                    </Text>
                    {selectedCountry.code === country.code && (
                      <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 24 }}>
              Don&apos;t include the country code or leading zero
            </Text>
          </>
        ) : (
          <>
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: colors.text,
              marginBottom: 16,
              textAlign: 'center'
            }}>
              Enter verification code
            </Text>

            {/* OTP boxes */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (otpRefs.current[index] = ref)}
                  style={{
                    width: 46,
                    height: 56,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: digit ? 2 : 1,
                    borderColor: digit ? colors.accent : colors.border,
                    fontSize: 22,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: colors.text,
                  }}
                  value={digit}
                  onChangeText={(val) => handleOtpChange(val, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <TouchableOpacity onPress={handleBack} style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: colors.accent, fontSize: 13 }}>← Change phone number</Text>
            </TouchableOpacity>
          </>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.accent,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 16,
            opacity: loading ? 0.7 : 1,
          }}
          onPress={step === 'phone' ? handleSendOTP : handleVerifyOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              {step === 'phone' ? 'Send OTP' : 'Verify & Login'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>Don&apos;t have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={{ fontWeight: 'bold', color: colors.accent }}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border,
};