import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SignupDetailsStep from '../components/signup/SignupDetailsStep';
import SignupHeader from '../components/signup/SignupHeader';
import SignupOtpStep from '../components/signup/SignupOtpStep';
import { getFriendlySupabaseError, getSupabaseClient, insertRow, upsertRow } from '../config/supabase';
import { FALLBACK_COUNTRY_CODES, fetchCountryCodes, getDefaultCountryCode, searchCountryCodes } from '../Utils/countryCodes';
import { buildOpenStreetMapAddressLabel, reverseGeocodeWithOpenStreetMap } from '../Utils/openStreetMapLocation';
import colors from '../Utils/colors';

const OTP_LENGTH = 6;

const normalizeLocationText = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const findLocationMatch = (items, names) => {
  const normalizedNames = names.filter(Boolean).map(normalizeLocationText);

  return items.find((item) => {
    const itemName = normalizeLocationText(item.name || '');
    return normalizedNames.some((name) => itemName.includes(name) || name.includes(itemName));
  });
};

const createPinPointAddress = (latitude, longitude) => {
  const latHash = Math.abs(latitude).toFixed(4).replace('.', '');
  const lngHash = Math.abs(longitude).toFixed(4).replace('.', '');
  return `PIN-${latHash}-${lngHash}`;
};

export default function SignupScreen() {
  // Step management: 'details' to 'otp'
  const [step, setStep] = useState('details');

  // Form fields
  const [selectedRole, setSelectedRole] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCodes, setCountryCodes] = useState(FALLBACK_COUNTRY_CODES);
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountryCode());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loadingCountryCodes, setLoadingCountryCodes] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryCodesMountedRef = useRef(true);
  const [idNumber, setIdNumber] = useState('');
  const [location, setLocation] = useState('');
  const [pinpointLocation, setPinpointLocation] = useState(null);
  const [manualWardNumber, setManualWardNumber] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationLookupStatus, setLocationLookupStatus] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [responderType, setResponderType] = useState('');

  // --- Location Hierarchy States ------------------------------------
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
  const filteredCountryCodes = searchCountryCodes(countryCodes, countrySearch);

  // --- Load Provinces on Mount --------------------------------------------
  useEffect(() => {
    countryCodesMountedRef.current = true;

    loadProvinces();
    loadCountryCodes();

    return () => {
      countryCodesMountedRef.current = false;
    };
  }, []);

  const loadCountryCodes = async () => {
    setLoadingCountryCodes(true);

    try {
      const apiCountryCodes = await fetchCountryCodes();
      if (!countryCodesMountedRef.current || apiCountryCodes.length === 0) return;

      setCountryCodes(apiCountryCodes);
      setSelectedCountry((currentCountry) => (
        apiCountryCodes.find((country) => country.code === currentCountry.code && country.name === currentCountry.name)
        || getDefaultCountryCode(apiCountryCodes)
      ));
    } catch (error) {
      console.error('Error loading country codes:', error);
    } finally {
      if (countryCodesMountedRef.current) setLoadingCountryCodes(false);
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

  const loadProvinces = async () => {
    try {
      setLoadingLocations(true);
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('provinces')
        .select('*')
        .order('name');

      if (error) throw error;
      console.log('Provinces loaded:', data?.length || 0);
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
      console.log('Cities loaded:', data?.length || 0);
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
      console.log('Suburbs loaded:', data?.length || 0);
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
      console.log('Zones loaded:', data?.length || 0);
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
      console.log('Wards loaded:', data?.length || 0);
      setWards(data || []);
      setSelectedWard(null);
    } catch (error) {
      console.error('Error loading wards:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // --- Location Selection Handlers --------------------------------------
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
    setManualWardNumber(String(ward.ward_number || ''));
  };

  // --- Validate Location --------------------------------------------------
  const validateLocation = () => {
    setLocationErrors({});
    return true;
  };

  const applyLocationHierarchyFromGps = async (osmLocation) => {
    const client = getSupabaseClient();
    let availableProvinces = provinces;

    if (availableProvinces.length === 0) {
      const { data: fetchedProvinces, error: provinceError } = await client
        .from('provinces')
        .select('*')
        .order('name');

      if (provinceError) throw provinceError;
      availableProvinces = fetchedProvinces || [];
      setProvinces(availableProvinces);
    }

    const province = findLocationMatch(availableProvinces, [
      osmLocation.province,
      osmLocation.district,
      osmLocation.cityTown,
    ]);

    if (!province) {
      setLocationLookupStatus('Location saved. Select or enter your ward number if you know it.');
      return;
    }

    setSelectedProvince(province);

    const { data: provinceCities, error: cityError } = await client
      .from('cities')
      .select('*')
      .eq('province_id', province.id)
      .order('name');

    if (cityError) throw cityError;
    setCities(provinceCities || []);

    const city = findLocationMatch(provinceCities || [], [
      osmLocation.cityTown,
      osmLocation.district,
      osmLocation.suburb,
    ]);

    if (!city) {
      setLocationLookupStatus('Province matched. Select or enter your ward number if you know it.');
      return;
    }

    setSelectedCity(city);

    const { data: citySuburbs, error: suburbError } = await client
      .from('suburbs')
      .select('*')
      .eq('city_id', city.id)
      .order('name');

    if (suburbError) throw suburbError;
    setSuburbs(citySuburbs || []);

    const suburb = findLocationMatch(citySuburbs || [], [
      osmLocation.suburb,
      osmLocation.road,
      osmLocation.cityTown,
      osmLocation.district,
    ]);

    if (!suburb) {
      setLocationLookupStatus('City matched. Select or enter your ward number if you know it.');
      return;
    }

    setSelectedSuburb(suburb);

    const { data: suburbZones, error: zoneError } = await client
      .from('zones')
      .select('*')
      .eq('suburb_id', suburb.id)
      .order('name');

    if (!zoneError) setZones(suburbZones || []);

    const { data: suburbWards, error: wardError } = await client
      .from('wards')
      .select('*')
      .eq('suburb_id', suburb.id)
      .order('ward_number');

    if (wardError) throw wardError;

    setWards(suburbWards || []);
    setSelectedWard(null);

    if (suburbWards?.length > 0) {
      setLocationLookupStatus('Location matched. Select your ward from the list, or enter it manually if you are unsure.');
    } else {
      setLocationLookupStatus('Location matched. Enter your ward number manually if you know it.');
    }
  };

  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    setLocationLookupStatus('');
    setLocationErrors({});

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access so we can create your PinPoint address.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const { latitude, longitude } = currentLocation.coords;
      const digitalAddress = createPinPointAddress(latitude, longitude);
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const osmLocation = await reverseGeocodeWithOpenStreetMap(latitude, longitude);

      setPinpointLocation({ latitude, longitude, digitalAddress, mapsUrl });
      setLocation(buildOpenStreetMapAddressLabel(osmLocation, digitalAddress));
      await applyLocationHierarchyFromGps(osmLocation);
    } catch (error) {
      console.error('Error detecting signup location:', error);
      Alert.alert('Location Error', 'We could not detect your location. You can continue and add it later.');
    } finally {
      setDetectingLocation(false);
    }
  };

  // --- OTP state ----------------------------------------------------------
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

  // --- Send OTP ----------------------------------------------------------
  const handleSendOTP = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select an account type');
      return;
    }

    if (!firstName || !lastName || !email || !phoneNumber || !idNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    validateLocation();

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

  // --- OTP Input Handlers --------------------------------------------------
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

  // --- Verify OTP & Create Account --------------------------------------
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
        location: location || pinpointLocation?.digitalAddress || null,
        role: selectedRole,
        organizationName: selectedRole === 'community_leader' ? organizationName : null,
        responderType: selectedRole === 'emergency_responder' ? responderType : null,
        // --- Location IDs --------------------------------------------------
        province_id: selectedProvince?.id || null,
        city_id: selectedCity?.id || null,
        suburb_id: selectedSuburb?.id || null,
        zone_id: selectedZone?.id || null,
        ward_id: selectedWard?.id || null,
        permissions: {
          locationEnabled: false,
          notificationsEnabled: false,
          manualWardNumber: manualWardNumber.trim() || selectedWard?.ward_number || null,
          pinpointAddress: pinpointLocation ? {
            digitalAddress: pinpointLocation.digitalAddress,
            latitude: pinpointLocation.latitude,
            longitude: pinpointLocation.longitude,
            mapsUrl: pinpointLocation.mapsUrl,
          } : null,
          canReportIncident: true,
          canRequestEmergency: true,
          canReviewReports: selectedRole === 'community_leader',
          canRespondToEmergency: selectedRole === 'emergency_responder',
          canSendCommunityAlerts: selectedRole === 'community_leader'
        },
        createdAt: new Date().toISOString(),
        isMockUser: false
      });

      if (pinpointLocation) {
        await insertRow('pinpoints', {
          userId: data.user.id,
          label: 'Home',
          digitalAddress: pinpointLocation.digitalAddress,
          latitude: pinpointLocation.latitude,
          longitude: pinpointLocation.longitude,
          mapsUrl: pinpointLocation.mapsUrl,
          qrPayload: pinpointLocation.mapsUrl,
          createdAt: new Date().toISOString(),
        });
      }

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

  // --- Render -------------------------------------------------------------
  const handleOtpBack = () => {
    setStep('details');
    setOtp(Array(OTP_LENGTH).fill(''));
  };

  const locationSelectorProps = {
    detectingLocation,
    pinpointLocation,
    locationLookupStatus,
    loadingLocations,
    provinces,
    cities,
    suburbs,
    zones,
    wards,
    selectedProvince,
    selectedCity,
    selectedSuburb,
    selectedZone,
    selectedWard,
    locationErrors,
    manualWardNumber,
    onUseCurrentLocation: handleUseCurrentLocation,
    onProvinceSelect: handleProvinceSelect,
    onCitySelect: handleCitySelect,
    onSuburbSelect: handleSuburbSelect,
    onZoneSelect: handleZoneSelect,
    onWardSelect: handleWardSelect,
    onManualWardNumberChange: (value) => {
      setManualWardNumber(value);
      if (selectedWard && String(selectedWard.ward_number || '') !== value.trim()) {
        setSelectedWard(null);
      }
    },
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40 }}>
        <SignupHeader step={step} />

        {step === 'details' ? (
          <SignupDetailsStep
            roles={roles}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            selectedCountry={selectedCountry}
            showCountryPicker={showCountryPicker}
            loadingCountryCodes={loadingCountryCodes}
            countrySearch={countrySearch}
            setCountrySearch={setCountrySearch}
            filteredCountryCodes={filteredCountryCodes}
            toggleCountryPicker={toggleCountryPicker}
            handleCountrySelect={handleCountrySelect}
            idNumber={idNumber}
            setIdNumber={setIdNumber}
            location={location}
            setLocation={setLocation}
            organizationName={organizationName}
            setOrganizationName={setOrganizationName}
            responderType={responderType}
            setResponderType={setResponderType}
            loading={loading}
            onSendOtp={handleSendOTP}
            locationSelectorProps={locationSelectorProps}
          />
        ) : (
          <SignupOtpStep
            otp={otp}
            otpRefs={otpRefs}
            loading={loading}
            onOtpChange={handleOtpChange}
            onOtpKeyPress={handleOtpKeyPress}
            onBack={handleOtpBack}
            onVerify={handleVerifyAndCreate}
          />
        )}

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
