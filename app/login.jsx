import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import TouchableOpacity from '../components/FeedbackTouchableOpacity';
import { getFriendlySupabaseError, getSupabaseClient, getUserProfile, withRequestTimeout } from '../config/supabase';
import { useTheme } from './context/ThemeContext';
import { FALLBACK_COUNTRY_CODES, fetchCountryCodes, getDefaultCountryCode, searchCountryCodes } from '../Utils/countryCodes';
import { clearOtpAttempts, formatLockoutTime, getOtpAttemptState, isInvalidOtpError, recordFailedOtpAttempt } from '../Utils/otpSecurity';

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const { colors, isDark } = useTheme();

  const [countryCodes, setCountryCodes] = useState(FALLBACK_COUNTRY_CODES);
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountryCode());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loadingCountryCodes, setLoadingCountryCodes] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [verificationId, setVerificationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('phone');

  const otpRefs = useRef([]);
  const filteredCountryCodes = searchCountryCodes(countryCodes, countrySearch);

  useEffect(() => {
    let isMounted = true;
    const loadCountryCodes = async () => {
      setLoadingCountryCodes(true);
      try {
        const apiCountryCodes = await fetchCountryCodes();
        if (!isMounted || apiCountryCodes.length === 0) return;
        setCountryCodes(apiCountryCodes);
        setSelectedCountry((currentCountry) =>
          apiCountryCodes.find((country) => country.code === currentCountry.code && country.name === currentCountry.name) ||
          getDefaultCountryCode(apiCountryCodes)
        );
      } catch (error) {
        console.error('Error loading country codes:', error);
      } finally {
        if (isMounted) setLoadingCountryCodes(false);
      }
    };
    loadCountryCodes();
    return () => { isMounted = false; };
  }, []);

  const handleSendOTP = async () => {
    const cleaned = phoneNumber.trim().replace(/\s/g, '');
    if (!cleaned) {
      Alert.alert('Phone Number Required', 'Please enter your phone number.');
      return;
    }
    const local = cleaned.replace(/^0/, '');
    const e164 = `${selectedCountry.code}${local}`;
    setLoading(true);
    try {
      const attemptState = await getOtpAttemptState(e164);
      if (attemptState.locked) {
        Alert.alert('Too Many Attempts', `Try again in ${formatLockoutTime(attemptState.lockedUntil)}.`);
        return;
      }
      const client = getSupabaseClient();
      const { error } = await withRequestTimeout(client.auth.signInWithOtp({ phone: e164 }));
      if (error) throw error;
      setVerificationId(e164);
      setStep('otp');
      setOtp(Array(OTP_LENGTH).fill(''));
      Alert.alert('OTP Sent', `A verification code was sent to ${e164}.`);
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert('Unable to Send OTP', getFriendlySupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const toggleCountryPicker = () => {
    if (showCountryPicker) setCountrySearch('');
    setShowCountryPicker(!showCountryPicker);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setCountrySearch('');
    setShowCountryPicker(false);
  };

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    if (value.length > 1) {
      const digits = value.split('').slice(0, OTP_LENGTH - index);
      digits.forEach((digit, offset) => {
        if (index + offset < OTP_LENGTH) newOtp[index + offset] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[nextIndex]?.focus();
      return;
    }
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length < OTP_LENGTH) {
      Alert.alert('Incomplete OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }
    if (!verificationId) {
      Alert.alert('Verification Error', 'Your phone verification session has expired. Please request a new OTP.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const attemptState = await getOtpAttemptState(verificationId);
      if (attemptState.locked) {
        throw Object.assign(new Error('OTP_ATTEMPTS_LOCKED'), { lockedUntil: attemptState.lockedUntil });
      }
      const client = getSupabaseClient();
      const { data, error } = await withRequestTimeout(client.auth.verifyOtp({
        phone: verificationId,
        token: otpString,
        type: 'sms',
      }), 20000);
      if (error) throw error;
      await clearOtpAttempts(verificationId);
      const user = data?.user;
      const userData = user ? await getUserProfile(user.id) : null;
      if (!userData) { router.replace('/(tabs)/communityfeed'); return; }
      if (userData.role === 'resident') { router.replace('/(tabs)/communityfeed'); return; }
      if (userData.role === 'community_leader') { router.replace('/(tabs)/communityfeed'); return; }
      if (userData.role === 'community_protection_service' || userData.role === 'emergency_responder') {
        router.replace('/(tabs)/emergencyResponderDashboard');
        return;
      }
      Alert.alert('Invalid User Role', 'Your account does not have a valid role assigned. Please contact your community administrator.');
    } catch (error) {
      console.error('OTP verification error:', error);
      if (error?.message === 'OTP_ATTEMPTS_LOCKED') {
        Alert.alert('Too Many Attempts', `Try again in ${formatLockoutTime(error.lockedUntil)}.`);
        handleBack();
      } else if (isInvalidOtpError(error)) {
        const state = await recordFailedOtpAttempt(verificationId);
        setOtp(Array(OTP_LENGTH).fill(''));
        if (state.locked) {
          await getSupabaseClient().auth.signOut({ scope: 'local' });
          handleBack();
          Alert.alert('Verification Locked', `Three incorrect codes were entered. You have been signed out; try again in ${formatLockoutTime(state.lockedUntil)}.`);
        } else {
          Alert.alert('Incorrect Code', `${state.remaining} attempt${state.remaining === 1 ? '' : 's'} remaining.`);
        }
      } else {
        Alert.alert('Verification Failed', getFriendlySupabaseError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setVerificationId(null);
  };

  const inputStyle = {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    minHeight: 52,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 40, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
       <View style={{ flex: 1, flexDirection: 'row' }}>

      <View
  style={{flex: 1,backgroundColor: colors.background,}}
>
  <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow: 1,paddingBottom: 30,}}>
    <View
      style={{width: '100%', height: 430,backgroundColor: colors.primaryLight, borderTopLeftRadius: 45, borderTopRightRadius: 45,
        overflow: 'hidden',}}>

<Image source={isDark ? require('../assets/login-dark.png') : require('../assets/login-top.png')}style={{width: '100%',height: '100%', resizeMode: 'cover',}}/>
    </View>
    <View style={{backgroundColor: colors.background, marginTop: -30, borderTopLeftRadius: 38, borderTopRightRadius: 38,paddingHorizontal: 24,
        paddingTop: 30, paddingBottom: 30,}}>
    <View style={{alignItems: 'center',marginBottom: 28,}}>
        <Text style={{fontSize: 30,fontWeight: '800',color: colors.text, textAlign: 'center',letterSpacing: -0.5,}}>
          Welcome Back
        </Text>

        <Text style={{fontSize: 14,color: colors.textLight,marginTop: 7,textAlign: 'center',lineHeight: 20,}}>
          {step === 'phone'? 'Log in to your Comm-Connect account': 'Enter the verification code sent to your phone'}
        </Text>
      </View>

      {step === 'phone' ? (<><Text style={{fontSize: 14,fontWeight: '700', color: colors.text, marginBottom: 8,}}>Phone Number</Text>
          <View style={{flexDirection: 'row', gap: 8,marginBottom: 8,}}>

            <TouchableOpacity onPress={toggleCountryPicker}
              style={{backgroundColor: colors.surface,borderRadius: 12,paddingHorizontal: 12,minHeight: 52,borderWidth: 1,
                borderColor: colors.border,flexDirection: 'row',alignItems: 'center',gap: 6,}}>
              <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
              <Text style={{fontSize: 15,color: colors.text,fontWeight: '600',}}>{selectedCountry.code}</Text>

              {loadingCountryCodes ? (<ActivityIndicator size="small" color={colors.accent}
                  />) : (<Ionicons name={showCountryPicker? 'chevron-up': 'chevron-down'}size={15} color={colors.textLight}/>)}
            </TouchableOpacity>

            <TextInput style={[inputStyle,{flex: 1,minHeight: 52,},]}
              placeholder="81 234 5678" placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.accent} value={phoneNumber} onChangeText={setPhoneNumber}
              keyboardType="phone-pad" autoComplete="tel" autoCorrect={false}editable={!loading}/></View>

          {showCountryPicker && (<View style={{backgroundColor: colors.surface,borderRadius: 12, borderWidth: 1,borderColor: colors.border,
                marginBottom: 12, overflow: 'hidden', maxHeight: 320,}}>
              <TextInput style={{backgroundColor: colors.surfaceRaised,borderRadius: 10,padding: 12,margin: 10,borderWidth: 1,borderColor: colors.border,color: colors.text,
                  minHeight: 46,}}
                placeholder="Search country or code"
                placeholderTextColor={colors.inputPlaceholder}
                selectionColor={colors.accent}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {filteredCountryCodes.length === 0 ? (
                <Text style={{color: colors.textLight, padding: 14, textAlign: 'center',}}>No countries found</Text>) : (
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredCountryCodes.map((country) => {const selected = selectedCountry.code === country.code &&
                      selectedCountry.name === country.name;
                    return (
                      <TouchableOpacity key={`${country.name}-${country.code}`}
                        onPress={() =>handleCountrySelect(country)}
                        style={{flexDirection: 'row',alignItems: 'center',gap: 12,padding: 14,borderBottomWidth: 0.5,borderBottomColor: colors.border,backgroundColor: selected ? colors.primaryLight : colors.surface,}}>
                        <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                        <Text style={{fontSize: 15, color: colors.text,flex: 1, }}>{country.countryName ||country.name}</Text>
                        <Text style={{fontSize: 14,color: colors.textLight,}} >{country.code}</Text>
                        {selected && (<Ionicons name="checkmark-circle" size={19} color={colors.accent}/>)}</TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 6 }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textLight} />
              <Text style={{ fontSize: 12, color: colors.textLight, flex: 1 }}>Don't include the country code or leading zero.</Text>
            </View>
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="shield-checkmark" size={28} color={colors.accent} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' }}>Enter verification code</Text>
              {verificationId && <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center', marginTop: 6 }}>Code sent to {verificationId}</Text>}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
              {otp.map((digit, index) => (
                <TextInput key={index} ref={(ref) => { otpRefs.current[index] = ref; }} style={{ width: 45, height: 56, backgroundColor: colors.inputBackground, borderRadius: 12, borderWidth: digit ? 2 : 1, borderColor: digit ? colors.accent : colors.inputBorder, fontSize: 21, fontWeight: '800', textAlign: 'center', color: colors.text }} value={digit} onChangeText={(value) => handleOtpChange(value, index)} onKeyPress={(event) => handleOtpKeyPress(event, index)} keyboardType="number-pad" selectionColor={colors.accent} maxLength={6} selectTextOnFocus autoFocus={index === 0} editable={!loading} />
              ))}
            </View>
            <TouchableOpacity onPress={handleBack} disabled={loading} style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>← Change phone number</Text>
            </TouchableOpacity>
          </>
        )}


      <TouchableOpacity style={{backgroundColor: colors.accent, borderRadius: 14,padding: 16, minHeight: 54,alignItems: 'center',justifyContent: 'center',marginBottom: 18,
          opacity: loading ? 0.7 : 1,shadowColor: colors.glossyShadow,shadowOffset: {width: 0,height: 4,},shadowOpacity: isDark ? 0.25 : 0.18,shadowRadius: 8,elevation: 3,}}
        onPress={step === 'phone'? handleSendOTP: handleVerifyOTP}disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />) : (<View style={{flexDirection: 'row',alignItems: 'center',gap: 8,}}>
            <Ionicons name={step === 'phone'? 'send' : 'checkmark-circle'}size={19}color="#FFFFFF"/>
            <Text style={{color: '#FFFFFF',fontSize: 16,fontWeight: '800',}}>{step === 'phone'? 'Send OTP'  : 'Verify & Login'}</Text>
          </View>)}
      </TouchableOpacity>


      <View style={{flexDirection: 'row',justifyContent: 'center',alignItems: 'center',gap: 4,}}>
        <Text style={{color: colors.textLight, fontSize: 14,}}> Don't have an account?</Text>

        <TouchableOpacity onPress={() => router.push('/signup')} disabled={loading}>
          <Text style={{fontWeight: '800',color: colors.accent, fontSize: 14,}}> Sign Up</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: colors.textLight, fontSize: 14 }}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/signup')} disabled={loading}>
            <Text style={{ fontWeight: '800', color: colors.accent, fontSize: 14 }}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28, gap: 6 }}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>Your phone number is securely verified.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
