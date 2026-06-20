import { router } from 'expo-router';
import { useRef, useState, useEffect } from 'react';
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
import { getFriendlySupabaseError, getSupabaseClient, upsertRow } from '../config/supabase';
import colors from '../Utils/colors';

const OTP_LENGTH = 6;

const COUNTRY_CODES = [
  { code: '+27', flag: '🇿🇦', name: 'ZA' },
  { code: '+1',  flag: '🇺🇸', name: 'US' },
  { code: '+44', flag: '🇬🇧', name: 'GB' },
  { code: '+91', flag: '🇮🇳', name: 'IN' },
  { code: '+61', flag: '🇦🇺', name: 'AU' },
];

export default function SignupScreen() {
  // Step management: 'details' → 'otp'
  const [step, setStep] = useState('details');

  // Form fields
  const [selectedRole, setSelectedRole] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [location, setLocation] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [responderType, setResponderType] = useState('');

  // ─── Location Hierarchy States ────────────────────────────────────
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [suburbs, setSuburbs] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedSuburb, setSelectedSuburb] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationErrors, setLocationErrors] = useState({});

  // ─── Load Provinces on Mount ────────────────────────────────────────────
  useEffect(() => {
    loadProvinces();
  }, []);

  const loadProvinces = async () => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('provinces')
        .select('*')
        .order('name');

      if (error) throw error;
      console.log('✅ Provinces loaded:', data?.length || 0);
      setProvinces(data || []);
    } catch (error) {
      console.error('Error loading provinces:', error);
      Alert.alert('Error', 'Failed to load provinces');
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadCities = async (provinceId) => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('cities')
        .select('*')
        .eq('province_id', provinceId)
        .order('name');

      if (error) throw error;
      console.log('✅ Cities loaded:', data?.length || 0);
      setCities(data || []);
      setSelectedCity(null);
      setSuburbs([]);
      setZones([]);
      setWards([]);
    } catch (error) {
      console.error('Error loading cities:', error);
      Alert.alert('Error', 'Failed to load cities');
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadSuburbs = async (cityId) => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('suburbs')
        .select('*')
        .eq('city_id', cityId)
        .order('name');

      if (error) throw error;
      console.log('✅ Suburbs loaded:', data?.length || 0);
      setSuburbs(data || []);
      setSelectedSuburb(null);
      setZones([]);
      setWards([]);
    } catch (error) {
      console.error('Error loading suburbs:', error);
      Alert.alert('Error', 'Failed to load suburbs');
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadZones = async (suburbId) => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('zones')
        .select('*')
        .eq('suburb_id', suburbId)
        .order('name');

      if (error) throw error;
      console.log('✅ Zones loaded:', data?.length || 0);
      setZones(data || []);
      setSelectedZone(null);
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadWards = async (suburbId) => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('wards')
        .select('*')
        .eq('suburb_id', suburbId)
        .order('ward_number');

      if (error) throw error;
      console.log('✅ Wards loaded:', data?.length || 0);
      setWards(data || []);
      setSelectedWard(null);
    } catch (error) {
      console.error('Error loading wards:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // ─── Location Selection Handlers ──────────────────────────────────────
  const handleProvinceSelect = (province) => {
    setSelectedProvince(province);
    setSelectedCity(null);
    setSelectedSuburb(null);
    setSelectedZone(null);
    setSelectedWard(null);
    setCities([]);
    setSuburbs([]);
    setZones([]);
    setWards([]);
    loadCities(province.id);
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setSelectedSuburb(null);
    setSelectedZone(null);
    setSelectedWard(null);
    setSuburbs([]);
    setZones([]);
    setWards([]);
    loadSuburbs(city.id);
  };

  const handleSuburbSelect = (suburb) => {
    setSelectedSuburb(suburb);
    setSelectedZone(null);
    setSelectedWard(null);
    setZones([]);
    setWards([]);
    loadZones(suburb.id);
    loadWards(suburb.id);
  };

  const handleZoneSelect = (zone) => {
    setSelectedZone(zone);
  };

  const handleWardSelect = (ward) => {
    setSelectedWard(ward);
  };

  // ─── Validate Location ──────────────────────────────────────────────────
  const validateLocation = () => {
    const errors = {};
    if (!selectedProvince) errors.province = 'Please select a province';
    if (!selectedCity) errors.city = 'Please select a city';
    if (!selectedSuburb) errors.suburb = 'Please select a suburb';
    if (!selectedWard) errors.ward = 'Please select a ward number';

    setLocationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── OTP state ──────────────────────────────────────────────────────────
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [verificationId, setVerificationId] = useState(null);
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef([]);

  const roles = [
    {
      id: 'resident',
      title: 'Resident',
      description: 'Report incidents and request assistance'
    },
    {
      id: 'community_leader',
      title: 'Community Leader',
      description: 'Manage community alerts and review reports'
    },
    {
      id: 'emergency_responder',
      title: 'Emergency Responder',
      description: 'Respond to emergency requests and incidents'
    }
  ];

  // ─── Send OTP ──────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select an account type');
      return;
    }

    if (!firstName || !lastName || !email || !phoneNumber || !idNumber || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!validateLocation()) {
      Alert.alert('Error', 'Please complete your location details');
      return;
    }

    if (selectedRole === 'community_leader' && !organizationName) {
      Alert.alert('Error', 'Please enter your community or organisation name');
      return;
    }

    if (selectedRole === 'emergency_responder' && !responderType) {
      Alert.alert('Error', 'Please enter your responder type');
      return;
    }

    setLoading(true);
    try {
      const fullPhoneNumber = `${selectedCountry.code}${phoneNumber.trim().replace(/^0/, '')}`;
      const client = getSupabaseClient();
      const { error } = await client.auth.signInWithOtp({ phone: fullPhoneNumber });
      if (error) throw error;

      setVerificationId(fullPhoneNumber);
      setStep('otp');
      Alert.alert('OTP Sent', `A verification code was sent to ${fullPhoneNumber}`);
    } catch (error) {
      Alert.alert('Error', getFriendlySupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP Input Handlers ──────────────────────────────────────────────────
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

  // ─── Verify OTP & Create Account ──────────────────────────────────────
  const handleVerifyAndCreate = async () => {
    const otpString = otp.join('');
    if (otpString.length < OTP_LENGTH) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const fullPhoneNumber = `${selectedCountry.code}${phoneNumber.trim().replace(/^0/, '')}`;
      const client = getSupabaseClient();
      const { data, error } = await client.auth.verifyOtp({
        phone: verificationId || fullPhoneNumber,
        token: otpString,
        type: 'sms',
      });

      if (error) throw error;
      if (!data.user) throw new Error('Could not create Supabase user.');

      await upsertRow('users', {
        id: data.user.id,
        firstName,
        lastName,
        email,
        phoneNumber: fullPhoneNumber,
        idNumber,
        location,
        role: selectedRole,
        organizationName: selectedRole === 'community_leader' ? organizationName : null,
        responderType: selectedRole === 'emergency_responder' ? responderType : null,
        // ─── Location IDs ──────────────────────────────────────────────────
        province_id: selectedProvince?.id || null,
        city_id: selectedCity?.id || null,
        suburb_id: selectedSuburb?.id || null,
        zone_id: selectedZone?.id || null,
        ward_id: selectedWard?.id || null,
        permissions: {
          locationEnabled: false,
          notificationsEnabled: false,
          canReportIncident: true,
          canRequestEmergency: true,
          canReviewReports: selectedRole === 'community_leader',
          canRespondToEmergency: selectedRole === 'emergency_responder',
          canSendCommunityAlerts: selectedRole === 'community_leader'
        },
        createdAt: new Date().toISOString(),
        isMockUser: false
      });

      Alert.alert(
        'Account Created Successfully!',
        'Your account has been created. Please login to continue.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/login')
          }
        ]
      );

    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Signup Failed', getFriendlySupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  // ─── Render Location Selector ──────────────────────────────────────────
  const renderLocationSelector = () => (
    <View style={{ marginBottom: 16 }}>
      <Text style={labelStyle}>
        📍 Your Location <Text style={{ color: colors.error }}>*</Text>
      </Text>

      {/* Province */}
      <View style={{ marginBottom: 12 }}>
        <Text style={subLabelStyle}>Province *</Text>
        {loadingLocations && provinces.length === 0 ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            {provinces.map((province) => (
              <TouchableOpacity
                key={province.id}
                onPress={() => handleProvinceSelect(province)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginRight: 8,
                  borderRadius: 20,
                  backgroundColor: selectedProvince?.id === province.id ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedProvince?.id === province.id ? colors.accent : colors.border,
                }}
              >
                <Text style={{
                  color: selectedProvince?.id === province.id ? '#fff' : colors.text,
                  fontWeight: selectedProvince?.id === province.id ? 'bold' : 'normal',
                }}>
                  {province.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {locationErrors.province && (
          <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.province}</Text>
        )}
      </View>

      {/* City */}
      {selectedProvince && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>City / Town *</Text>
          {loadingLocations ? (
            <ActivityIndicator color={colors.accent} />
          ) : cities.length === 0 ? (
            <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No cities available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city.id}
                  onPress={() => handleCitySelect(city)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 8,
                    borderRadius: 20,
                    backgroundColor: selectedCity?.id === city.id ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedCity?.id === city.id ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{
                    color: selectedCity?.id === city.id ? '#fff' : colors.text,
                    fontWeight: selectedCity?.id === city.id ? 'bold' : 'normal',
                  }}>
                    {city.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {locationErrors.city && (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.city}</Text>
          )}
        </View>
      )}

      {/* Suburb */}
      {selectedCity && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Suburb *</Text>
          {loadingLocations ? (
            <ActivityIndicator color={colors.accent} />
          ) : suburbs.length === 0 ? (
            <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No suburbs available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              {suburbs.map((suburb) => (
                <TouchableOpacity
                  key={suburb.id}
                  onPress={() => handleSuburbSelect(suburb)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 8,
                    borderRadius: 20,
                    backgroundColor: selectedSuburb?.id === suburb.id ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedSuburb?.id === suburb.id ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{
                    color: selectedSuburb?.id === suburb.id ? '#fff' : colors.text,
                    fontWeight: selectedSuburb?.id === suburb.id ? 'bold' : 'normal',
                  }}>
                    {suburb.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {locationErrors.suburb && (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.suburb}</Text>
          )}
        </View>
      )}

      {/* Zone (Optional) */}
      {selectedSuburb && zones.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Zone (Optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                onPress={() => handleZoneSelect(zone)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginRight: 8,
                  borderRadius: 20,
                  backgroundColor: selectedZone?.id === zone.id ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedZone?.id === zone.id ? colors.accent : colors.border,
                }}
              >
                <Text style={{
                  color: selectedZone?.id === zone.id ? '#fff' : colors.text,
                  fontWeight: selectedZone?.id === zone.id ? 'bold' : 'normal',
                }}>
                  {zone.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Ward */}
      {selectedSuburb && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Ward Number *</Text>
          {loadingLocations ? (
            <ActivityIndicator color={colors.accent} />
          ) : wards.length === 0 ? (
            <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No wards available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              {wards.map((ward) => (
                <TouchableOpacity
                  key={ward.id}
                  onPress={() => handleWardSelect(ward)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 8,
                    borderRadius: 20,
                    backgroundColor: selectedWard?.id === ward.id ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedWard?.id === ward.id ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{
                    color: selectedWard?.id === ward.id ? '#fff' : colors.text,
                    fontWeight: selectedWard?.id === ward.id ? 'bold' : 'normal',
                  }}>
                    Ward {ward.ward_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {locationErrors.ward && (
            <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.ward}</Text>
          )}
        </View>
      )}

      {loadingLocations && (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>Loading locations...</Text>
        </View>
      )}
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 80, height: 80,
            backgroundColor: colors.primary,
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 40 }}>🤝</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>
            {step === 'details' ? 'Create Account' : 'Verify Phone'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>
            {step === 'details'
              ? 'Join Comm-Connect today'
              : 'Enter the code sent to your phone'}
          </Text>
        </View>

        {/* STEP 1: DETAILS FORM */}
        {step === 'details' ? (
          <>
            {/* ── Role Selection ── */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
                Select Account Type
              </Text>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  onPress={() => setSelectedRole(role.id)}
                  style={{
                    backgroundColor: selectedRole === role.id ? colors.accent : colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: selectedRole === role.id ? colors.accent : colors.border
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: selectedRole === role.id ? '#fff' : colors.text }}>
                    {role.title}
                  </Text>
                  <Text style={{ fontSize: 13, marginTop: 4, color: selectedRole === role.id ? '#fff' : colors.textLight }}>
                    {role.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedRole !== '' && (
              <>
                {/* ── Personal Details ── */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={labelStyle}>First Name</Text>
                  <TextInput style={inputStyle} placeholder="John" placeholderTextColor={colors.textLight} selectionColor={colors.accent} value={firstName} onChangeText={setFirstName} />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={labelStyle}>Last Name</Text>
                  <TextInput style={inputStyle} placeholder="Doe" placeholderTextColor={colors.textLight} selectionColor={colors.accent} value={lastName} onChangeText={setLastName} />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={labelStyle}>Email</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="john@example.com"
                    placeholderTextColor={colors.textLight}
                    selectionColor={colors.accent}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* ── Phone with country code ── */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={labelStyle}>Phone Number</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
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
                      <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{selectedCountry.code}</Text>
                      <Text style={{ fontSize: 11, color: colors.textLight }}>▼</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      placeholder="81 234 5678"
                      placeholderTextColor={colors.textLight}
                      selectionColor={colors.accent}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                    />
                  </View>
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
                          backgroundColor: selectedCountry.code === country.code ? colors.background : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                        <Text style={{ fontSize: 15, color: colors.text }}>{country.name}</Text>
                        <Text style={{ fontSize: 15, color: colors.textLight, marginLeft: 'auto' }}>{country.code}</Text>
                        {selectedCountry.code === country.code && (
                          <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 16 }}>
                  Don&apos;t include the country code or leading zero
                </Text>

                <View style={{ marginBottom: 12 }}>
                  <Text style={labelStyle}>ID Number</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="000000 0000 000"
                    placeholderTextColor={colors.textLight}
                    selectionColor={colors.accent}
                    value={idNumber}
                    onChangeText={setIdNumber}
                    keyboardType="numeric"
                  />
                </View>

                {/* ─── Location Selector ────────────────────────────── */}
                {renderLocationSelector()}

                {/* ─── Address Details ──────────────── */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={labelStyle}>Address Details</Text>
                  <TextInput
                    style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="e.g., 12 Melle Street, Braamfontein"
                    placeholderTextColor={colors.textLight}
                    selectionColor={colors.accent}
                    value={location}
                    onChangeText={setLocation}
                    multiline
                  />
                  <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 4 }}>
                    Help emergency responders find you
                  </Text>
                </View>

                {selectedRole === 'community_leader' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={labelStyle}>Community / Organisation Name</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="e.g. Soweto Community Forum"
                      placeholderTextColor={colors.textLight}
                      selectionColor={colors.accent}
                      value={organizationName}
                      onChangeText={setOrganizationName}
                    />
                  </View>
                )}

                {selectedRole === 'emergency_responder' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={labelStyle}>Responder Type</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="e.g. Police, Ambulance, Fire, Security"
                      placeholderTextColor={colors.textLight}
                      selectionColor={colors.accent}
                      value={responderType}
                      onChangeText={setResponderType}
                    />
                  </View>
                )}

                {/* ── Send OTP Button ── */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: 'center',
                    marginTop: 12,
                    marginBottom: 16,
                    opacity: loading ? 0.7 : 1,
                  }}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Send OTP</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          /* STEP 2: OTP VERIFICATION */
          <>
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
              Enter verification code
            </Text>

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
                  selectionColor={colors.accent}
                  maxLength={6}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                setStep('details');
                setOtp(Array(OTP_LENGTH).fill(''));
              }}
              style={{ alignItems: 'center', marginBottom: 24 }}
            >
              <Text style={{ color: colors.accent, fontSize: 13 }}>← Change details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: colors.accent,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
                marginBottom: 16,
                opacity: loading ? 0.7 : 1,
              }}
              onPress={handleVerifyAndCreate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Verify & Create Account</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ── Login Link ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 14 }}>
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={{ fontWeight: 'bold', color: colors.accent }}> Login</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle = {
  fontSize: 14,
  fontWeight: '500',
  color: colors.text,
  marginBottom: 8
};

const subLabelStyle = {
  fontSize: 12,
  fontWeight: '500',
  color: colors.textLight,
  marginBottom: 6
};

const inputStyle = {
  backgroundColor: colors.surfaceRaised,
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.text
};
