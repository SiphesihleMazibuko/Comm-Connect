import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, Text, TextInput, Vibration, View } from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { deleteRow, getCurrentUser, getRows, getUserProfile, insertRow, updateRow } from '../../config/supabase';
import { notifyEmergencyContactsBySms, showLocalSosNotification } from '../../config/notifications';
import { useTheme } from '../context/ThemeContext';

const HOLD_SECONDS = 5;
const SOS_LOCATION_INTERVAL_MS = 10000;

const makeShareToken = () => {
  if (global.crypto?.randomUUID) return global.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isValidRemoteId = (value) => (
  value !== null &&
  value !== undefined &&
  `${value}`.trim() !== '' &&
  `${value}`.trim().toLowerCase() !== 'null' &&
  `${value}`.trim().toLowerCase() !== 'undefined'
);

const getEmergencyContacts = (profile, contacts = []) => (
  (contacts.length > 0 ? contacts : profile?.permissions?.emergencyContacts || [])
    .filter((contact) => contact?.phone?.trim())
);

const getDisplayName = (profile) => {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  return name || profile?.email || profile?.phoneNumber || 'CPF Member';
};

const getWardCpfContacts = async (profile) => {
  if (!profile?.ward_id) return [];

  const wardUsers = await getRows('users', {
    filters: { ward_id: profile.ward_id },
  });

  return (wardUsers || [])
    .filter((wardUser) => (
      wardUser?.id !== profile.id &&
      ['community_protection_service', 'emergency_responder'].includes(wardUser?.role) &&
      wardUser?.phoneNumber?.trim()
    ))
    .map((wardUser) => ({
      id: wardUser.id,
      name: getDisplayName(wardUser),
      relationship: 'Ward CPF member',
      phone: wardUser.phoneNumber,
      source: 'ward_cpf',
    }));
};

export default function PinPointScreen() {
  const { colors, isDark } = useTheme();

  const [location, setLocation] = useState(null);
  const [digitalAddress, setDigitalAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const [sosStarting, setSosStarting] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosAlertId, setSosAlertId] = useState(null);
  const [holdCountdown, setHoldCountdown] = useState(HOLD_SECONDS);

  const router = useRouter();
  const [user, setUser] = useState(null);

  const holdTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const holdVibrationRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const sosAlertIdRef = useRef(null);
  const sosLocationHistoryRef = useRef([]);
  const sosLocationMetaRef = useRef({});
  const locationRequestRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser) await loadSavedAddresses(currentUser);
      } catch (error) {
        console.error('PinPoint initial load error:', error);
      }
    };

    load();

    return () => {
      clearSosHold();
      clearSosLocationUpdates();
    };
  }, []);

  const getCurrentLocation = async () => {
    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to generate your PinPoint address.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = loc.coords;

      const latHash = Math.abs(latitude).toFixed(4).replace('.', '');
      const lngHash = Math.abs(longitude).toFixed(4).replace('.', '');
      const address = `PIN-${latHash}-${lngHash}`;
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

      if (locationRequestRef.current !== requestId) return;

      setLocation({ latitude, longitude, mapsUrl });
      setDigitalAddress(address);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your current location.');
    } finally {
      if (locationRequestRef.current === requestId) setLoading(false);
    }
  };

  const cancelCurrentLocation = () => {
    locationRequestRef.current += 1;
    setLoading(false);
    setLocation(null);
    setDigitalAddress('');
    setAddressLabel('');
  };

  const saveAddress = async () => {
    if (!location || !digitalAddress) {
      Alert.alert('Error', 'Generate a location first.');
      return;
    }

    if (!addressLabel.trim()) {
      Alert.alert('Error', 'Please enter a label (e.g., Home, Work).');
      return;
    }

    if (!user?.id) {
      Alert.alert('Login Required', 'Please log in before saving an address.');
      return;
    }

    setSaving(true);

    try {
      await insertRow('pinpoints', {
        userId: user.id,
        label: addressLabel.trim(),
        digitalAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        mapsUrl: location.mapsUrl,
        qrPayload: location.mapsUrl,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Address saved successfully.');
      setAddressLabel('');
      setLocation(null);
      setDigitalAddress('');
      await loadSavedAddresses(user);
    } catch (error) {
      console.error('Save address error:', error);
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const loadSavedAddresses = async (currentUser = user) => {
    if (!currentUser?.id) return;

    try {
      const addresses = await getRows('pinpoints', { eq: [{ column: 'userId', value: currentUser.id }] });
      setSavedAddresses(Array.isArray(addresses) ? addresses : []);
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const shareAddress = async (address) => {
    try {
      const mapsUrl = address.mapsUrl || `https://www.google.com/maps?q=${address.latitude},${address.longitude}`;
      await Share.share({
        message: `My PinPoint Address: ${address.digitalAddress}\nView Location: ${mapsUrl}\n\nSent via Comm-Connect`,
      });
    } catch (error) {
      console.error('Share address error:', error);
      Alert.alert('Error', 'Failed to share address.');
    }
  };

  const deleteAddress = async (addressId) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRow('pinpoints', addressId);
              await loadSavedAddresses(user);
              Alert.alert('Success', 'Address deleted.');
            } catch (error) {
              console.error('Delete address error:', error);
              Alert.alert('Error', 'Failed to delete address.');
            }
          },
        },
      ]
    );
  };

  const getHighAccuracyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission is required for SOS tracking.');

    const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const { latitude, longitude, accuracy, heading, speed } = currentLocation.coords;

    return {
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      mapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
      recordedAt: new Date().toISOString(),
    };
  };

  const clearSosHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (holdVibrationRef.current) clearInterval(holdVibrationRef.current);

    holdTimerRef.current = null;
    countdownRef.current = null;
    holdVibrationRef.current = null;

    Vibration.cancel();
    setHoldCountdown(HOLD_SECONDS);
  };

  const clearSosLocationUpdates = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
  };

  const updateSosLocation = async () => {
    const alertId = sosAlertIdRef.current;
    if (!isValidRemoteId(alertId)) {
      clearSosLocationUpdates();
      return;
    }

    try {
      const currentLocation = await getHighAccuracyLocation();
      sosLocationHistoryRef.current = [...sosLocationHistoryRef.current.slice(-11), currentLocation];

      await updateRow('emergencyRequests', alertId, {
        location: {
          ...(sosLocationMetaRef.current || {}),
          currentLocation,
          locationHistory: sosLocationHistoryRef.current,
          lastLocationAt: currentLocation.recordedAt,
        },
      });

      console.log('[SOS] Live location updated.', currentLocation);
    } catch (error) {
      console.error('[SOS] Failed to update live location:', error);
    }
  };

  const startSosLocationUpdates = () => {
    clearSosLocationUpdates();
    locationIntervalRef.current = setInterval(updateSosLocation, SOS_LOCATION_INTERVAL_MS);
  };

  const activateSos = async () => {
    if (sosStarting || sosActive) return;

    if (!user?.id) {
      Alert.alert('Login Required', 'Please log in before triggering SOS.');
      return;
    }

    setSosStarting(true);

    try {
      const latestProfile = await getUserProfile(user.id);
      const emergencyContactRows = await getRows('emergency_contacts', {
        eq: [{ column: 'userId', value: user.id }],
        order: [{ column: 'createdAt', ascending: true }],
        allowMissingTable: true,
      });
      const emergencyContacts = getEmergencyContacts(latestProfile, emergencyContactRows);
      const sosContacts = emergencyContacts.length > 0 ? emergencyContacts : await getWardCpfContacts(latestProfile);

      if (sosContacts.length === 0) {
        Alert.alert('SOS Contacts Unavailable', 'No emergency contacts or ward CPF members with phone numbers were found.');
        return;
      }

      const currentLocation = await getHighAccuracyLocation();
      const shareToken = makeShareToken();

      const userName = `${latestProfile?.firstName || ''} ${latestProfile?.lastName || ''}`.trim() || user.email || 'PinPoint user';
      const createdAt = new Date().toISOString();

      sosLocationHistoryRef.current = [currentLocation];

      const alert = await insertRow('emergencyRequests', {
        userId: user.id,
        userName,
        userPhone: latestProfile?.phoneNumber || '',
        emergencyType: 'sos',
        description: 'SOS live location alert',
        contactDetails: sosContacts.map((contact) => contact.phone).filter(Boolean).join(', '),
        status: 'active',
        ward_id: latestProfile?.ward_id || null,
        suburb_id: latestProfile?.suburb_id || null,
        location: {
          type: 'sos',
          emergencyContacts: sosContacts,
          recipientSource: emergencyContacts.length > 0 ? 'emergency_contacts' : 'ward_cpf',
          currentLocation,
          locationHistory: sosLocationHistoryRef.current,
          shareToken,
          lastLocationAt: currentLocation.recordedAt,
        },
        createdAt,
      });

      const alertId = alert?.id;

      if (!isValidRemoteId(alertId)) {
        throw new Error('SOS request was created without a valid remote ID. Please try again when your connection is stable.');
      }

      const trackingUrl = Linking.createURL(`/sos/${alertId}`, { queryParams: { token: shareToken } });

      sosLocationMetaRef.current = {
        type: 'sos',
        emergencyContacts: sosContacts,
        recipientSource: emergencyContacts.length > 0 ? 'emergency_contacts' : 'ward_cpf',
        shareToken,
        trackingUrl,
      };

      await updateRow('emergencyRequests', alertId, {
        location: {
          ...sosLocationMetaRef.current,
          currentLocation,
          locationHistory: sosLocationHistoryRef.current,
          lastLocationAt: currentLocation.recordedAt,
        },
      });

      const smsOpened = await notifyEmergencyContactsBySms({
        contacts: sosContacts,
        alert: { ...alert, id: alertId, userName },
        trackingUrl,
      });

      await showLocalSosNotification(alertId);

      sosAlertIdRef.current = alertId;
      setSosAlertId(alertId);
      setSosActive(true);

      startSosLocationUpdates();

      Alert.alert(
        'SOS Active',
        smsOpened
          ? 'Your SMS app opened with the emergency message. Your live location is updating every 10 seconds.'
          : 'Your live location is updating every 10 seconds, but no SMS app or contact phone number was available.'
      );
    } catch (error) {
      console.error('[SOS] Failed to activate:', error);
      Alert.alert('SOS Failed', error?.message || 'Failed to activate SOS. Please try again.');
    } finally {
      setSosStarting(false);
      clearSosHold();
    }
  };

  const startSosHold = () => {
    if (sosActive || sosStarting) return;

    setHoldCountdown(HOLD_SECONDS);
    Vibration.vibrate(120);

    holdVibrationRef.current = setInterval(() => Vibration.vibrate(120), 1000);
    countdownRef.current = setInterval(() => setHoldCountdown((seconds) => Math.max(1, seconds - 1)), 1000);

    holdTimerRef.current = setTimeout(() => {
      clearSosHold();
      activateSos();
    }, HOLD_SECONDS * 1000);
  };

  const cancelSosHold = () => {
    if (!holdTimerRef.current) return;
    clearSosHold();
  };

  const stopSos = async () => {
    const alertId = sosAlertIdRef.current;

    if (!isValidRemoteId(alertId)) {
      clearSosLocationUpdates();
      setSosActive(false);
      setSosAlertId(null);
      sosAlertIdRef.current = null;
      return;
    }

    try {
      clearSosLocationUpdates();
      await updateRow('emergencyRequests', alertId, { status: 'cancelled', completedAt: new Date().toISOString() });

      setSosActive(false);
      setSosAlertId(null);
      sosAlertIdRef.current = null;
      sosLocationHistoryRef.current = [];
      sosLocationMetaRef.current = {};

      Alert.alert('SOS Stopped', 'Live location sharing has been stopped.');
    } catch (error) {
      console.error('[SOS] Failed to stop:', error);
      Alert.alert('Error', 'Failed to stop SOS. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="PinPoint Address" subtitle="Generate your unique digital address" icon="location" />

        <View style={{
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: isDark ? 0 : 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.greenMint,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="location" size={22} color={colors.greenTeal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Generate New Address</Text>
              <Text style={{ fontSize: 13, color: colors.textLight, marginTop: 3 }}>Use your current location</Text>
            </View>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={getCurrentLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="locate" size={21} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontWeight: '700', fontSize: 15 }}>Get Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          {loading && (
            <TouchableOpacity
              style={{ borderColor: colors.border, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10, backgroundColor: colors.greenSoft }}
              onPress={cancelCurrentLocation}
              disabled={saving}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.textLight} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          )}

          {digitalAddress !== '' && (
            <View style={{ marginTop: 18, backgroundColor: colors.greenSoft, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 7 }}>Your Digital Address</Text>
              <View style={{ backgroundColor: colors.surface, paddingVertical: 15, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.greenMint }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.greenDeep, textAlign: 'center', letterSpacing: 0.5 }}>
                  {digitalAddress}
                </Text>
              </View>

              <TextInput
                style={{ backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginTop: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 }}
                placeholder="Label (e.g., Home, Work, Shop)"
                placeholderTextColor={colors.textLight}
                selectionColor={colors.primary}
                value={addressLabel}
                onChangeText={setAddressLabel}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 7, backgroundColor: colors.surface }}
                  onPress={cancelCurrentLocation}
                  disabled={saving}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.textLight} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}
                  onPress={saveAddress}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={{ color: colors.textInverse, fontWeight: '700' }}>Save Address</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenSage, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="bookmark" size={19} color={colors.greenForest} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>My Saved Addresses</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>Your saved locations</Text>
            </View>
          </View>

          {savedAddresses.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 35, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 65, height: 65, borderRadius: 22, backgroundColor: colors.greenMint, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bookmark-outline" size={32} color={colors.greenForest} />
              </View>
              <Text style={{ color: colors.text, marginTop: 14, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                No saved addresses yet
              </Text>
              <Text style={{ color: colors.textLight, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                Generate and save your first PinPoint address above.
              </Text>
            </View>
          ) : (
            savedAddresses.map((addr) => {
              const qrValue = addr.qrPayload || addr.mapsUrl || `https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`;

              return (
                <View key={addr.id} style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, elevation: isDark ? 0 : 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="location" size={17} color={colors.greenTeal} />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginLeft: 6 }}>{addr.label}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.greenSage, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, marginTop: 9 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.greenDeep }}>{addr.digitalAddress}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 7 }}>
                        {typeof addr.latitude === 'number' ? addr.latitude.toFixed(6) : addr.latitude}, {typeof addr.longitude === 'number' ? addr.longitude.toFixed(6) : addr.longitude}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setSelectedAddress({ ...addr, qrPayload: qrValue });
                        setShowQRModal(true);
                      }}
                      style={{ width: 58, height: 58, borderRadius: 17, backgroundColor: colors.greenMint, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="qr-code" size={32} color={colors.greenDeep} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                      onPress={() => shareAddress(addr)}
                      style={{ flex: 1, backgroundColor: colors.greenTeal, borderRadius: 11, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="share-outline" size={17} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteAddress(addr.id)}
                      style={{ flex: 1, backgroundColor: colors.error, borderRadius: 11, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="trash-outline" size={17} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 20,
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: sosActive ? colors.success : colors.error,
          elevation: isDark ? 0 : 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <View style={{
              width: 45,
              height: 45,
              borderRadius: 14,
              backgroundColor: sosActive ? colors.successLight : colors.errorLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name={sosActive ? 'checkmark-circle' : 'shield'} size={24} color={sosActive ? colors.success : colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Emergency SOS</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3 }}>
                {sosActive ? 'Your live location is being shared' : 'Hold the button for 5 seconds'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: sosActive ? colors.success : colors.error, borderRadius: 15, paddingVertical: 17, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={sosActive ? stopSos : undefined}
            onPressIn={startSosHold}
            onPressOut={cancelSosHold}
            disabled={sosStarting}
          >
            {sosStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name={sosActive ? 'checkmark-circle' : 'alert-circle'} size={25} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              {sosActive ? 'Stop SOS Live Tracking' : `Hold ${holdCountdown}s to Send SOS`}
            </Text>
          </TouchableOpacity>

          {sosActive && isValidRemoteId(sosAlertId) && (
            <TouchableOpacity
              style={{ marginTop: 10, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.greenTeal, backgroundColor: colors.greenMint }}
              onPress={() => router.push(`/sos/${sosAlertId}`)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name="navigate" size={17} color={colors.greenTeal} />
                <Text style={{ color: colors.greenTeal, fontWeight: '700' }}>View Live Tracking</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={showQRModal} animationType="fade" transparent onRequestClose={() => setShowQRModal(false)}>
          <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 22, alignItems: 'center', width: '90%', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>PinPoint QR Code</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3 }}>Scan to view this location</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowQRModal(false)}
                  style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenMint, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={21} color={colors.greenDeep} />
                </TouchableOpacity>
              </View>

              {selectedAddress && (
                <View style={{ backgroundColor: '#fff', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}>
                  <QRCode value={selectedAddress.qrPayload} size={200} />
                </View>
              )}

              {selectedAddress && (
                <View style={{ marginTop: 16, backgroundColor: colors.greenSage, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, width: '100%', alignItems: 'center' }}>
                  <Text style={{ color: colors.greenDeep, fontWeight: '800', fontSize: 14 }}>{selectedAddress.digitalAddress}</Text>
                </View>
              )}

              <Text style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: colors.textLight, lineHeight: 18 }}>
                Scan this QR code to open this PinPoint location in Google Maps.
              </Text>

              <TouchableOpacity
                onPress={() => setShowQRModal(false)}
                style={{ marginTop: 18, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, width: '100%', alignItems: 'center' }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: '800' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
