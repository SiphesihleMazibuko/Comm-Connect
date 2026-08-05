import {
  Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect,
  useRef,
  useState } from 'react';
import { ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  Text,
  TextInput,
  Vibration,
  View
} from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { deleteRow, getCurrentUser, getRows, getUserProfile, insertRow, updateRow } from '../../config/supabase';
import { notifyEmergencyContactsBySms, showLocalSosNotification } from '../../config/notifications';
import colors from '../../Utils/colors';

const HOLD_SECONDS = 5;
const SOS_LOCATION_INTERVAL_MS = 10000;

const makeShareToken = () => {
  if (global.crypto?.randomUUID) return global.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isValidRemoteId = (value) => (
  value !== null
  && value !== undefined
  && `${value}`.trim() !== ''
  && `${value}`.trim().toLowerCase() !== 'null'
  && `${value}`.trim().toLowerCase() !== 'undefined'
);

const getEmergencyContacts = (profile) => (
  Array.isArray(profile?.permissions?.emergencyContacts)
    ? profile.permissions.emergencyContacts.filter((contact) => contact?.phone?.trim())
    : []
);

export default function PinPointScreen() {
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
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadSavedAddresses(currentUser);
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
        Alert.alert('Permission Denied', 'Allow location access to generate your PinPoint address');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const { latitude, longitude } = loc.coords;

      const latHash = Math.abs(latitude).toFixed(4).replace('.', '');
      const lngHash = Math.abs(longitude).toFixed(4).replace('.', '');
      const address = `PIN-${latHash}-${lngHash}`;

      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

      if (locationRequestRef.current !== requestId) return;

      setLocation({
        latitude,
        longitude,
        mapsUrl,
      });

      setDigitalAddress(address);
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
      console.error('Location error:', error);
    } finally {
      if (locationRequestRef.current === requestId) {
        setLoading(false);
      }
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
      Alert.alert('Error', 'Generate a location first');
      return;
    }

    if (!addressLabel.trim()) {
      Alert.alert('Error', 'Please enter a label (e.g., Home, Work)');
      return;
    }

    setSaving(true);

    try {
      await insertRow('pinpoints', {
        userId: user.id,
        label: addressLabel,
        digitalAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        mapsUrl: location.mapsUrl,
        qrPayload: location.mapsUrl,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Address saved successfully');
      setAddressLabel('');
      setLocation(null);
      setDigitalAddress('');
      loadSavedAddresses(user);
    } catch (error) {
      Alert.alert('Error', 'Failed to save address');
      console.error('Save address error:', error);
    } finally {
      setSaving(false);
    }
  };

  const loadSavedAddresses = async (currentUser = user) => {
    if (!currentUser) return;

    try {
      const addresses = await getRows('pinpoints', {
        eq: [{ column: 'userId', value: currentUser.id }],
      });

      setSavedAddresses(addresses);
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const shareAddress = async (address) => {
    try {
      await Share.share({
        message: `My PinPoint Address: ${address.digitalAddress}\nView Location: ${address.mapsUrl || `https://www.google.com/maps?q=${address.latitude},${address.longitude}`}\n\nSent via Comm-Connect`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share address');
      console.error('Share address error:', error);
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
              loadSavedAddresses(user);
              Alert.alert('Success', 'Address deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete address');
              console.error('Delete address error:', error);
            }
          },
        },
      ]
    );
  };

  const getHighAccuracyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('Location permission is required for SOS tracking');
    }

    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

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
      sosLocationHistoryRef.current = [
        ...sosLocationHistoryRef.current.slice(-11),
        currentLocation,
      ];

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

    if (!user) {
      Alert.alert('Login Required', 'Please log in before triggering SOS.');
      return;
    }

    setSosStarting(true);

    try {
      const latestProfile = await getUserProfile(user.id);

      const emergencyContacts = getEmergencyContacts(latestProfile);
      if (emergencyContacts.length === 0) {
        Alert.alert('Emergency Contacts Needed', 'Add emergency contacts in Settings before using SOS.');
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
        contactDetails: emergencyContacts.map((contact) => contact.phone).filter(Boolean).join(', '),
        status: 'active',
        location: {
          type: 'sos',
          emergencyContacts,
          currentLocation,
          locationHistory: sosLocationHistoryRef.current,
          shareToken,
          lastLocationAt: currentLocation.recordedAt,
        },
        createdAt,
      });

      const alertId = alert.id;

      if (!isValidRemoteId(alertId)) {
        throw new Error('SOS request was created without a valid remote id. Please try again when your connection is stable.');
      }

      const trackingUrl = Linking.createURL(`/sos/${alertId}`, {
        queryParams: { token: shareToken },
      });

      sosLocationMetaRef.current = {
        type: 'sos',
        emergencyContacts,
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
        contacts: emergencyContacts,
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
      Alert.alert('SOS Failed', error.message || 'Failed to activate SOS. Please try again.');
    } finally {
      setSosStarting(false);
      clearSosHold();
    }
  };

  const startSosHold = () => {
    if (sosActive || sosStarting) return;

    setHoldCountdown(HOLD_SECONDS);
    Vibration.vibrate(120);
    holdVibrationRef.current = setInterval(() => {
      Vibration.vibrate(120);
    }, 1000);

    countdownRef.current = setInterval(() => {
      setHoldCountdown((seconds) => Math.max(1, seconds - 1));
    }, 1000);

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
      await updateRow('emergencyRequests', alertId, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });
      setSosActive(false);
      setSosAlertId(null);
      sosAlertIdRef.current = null;
      Alert.alert('SOS Stopped', 'Live location sharing has been stopped.');
    } catch (error) {
      console.error('[SOS] Failed to stop:', error);
      Alert.alert('Error', 'Failed to stop SOS. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title="PinPoint Address"
          subtitle="Generate your unique digital address"
          icon="location"
        />

        <View style={{ margin: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 16, elevation: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Generate New Address</Text>

          <TouchableOpacity
            style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={getCurrentLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="locate" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Get Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          {loading && (
            <TouchableOpacity
              style={{ borderColor: colors.border, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 }}
              onPress={cancelCurrentLocation}
              disabled={saving}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          )}

          {digitalAddress !== '' && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, color: colors.textLight, marginBottom: 5 }}>Your Digital Address:</Text>

              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.accent, textAlign: 'center' }}>
                  {digitalAddress}
                </Text>
              </View>

              <TextInput
                style={{ backgroundColor: colors.surfaceRaised, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border, color: colors.text }}
                placeholder="Label (e.g., Home, Work, Shop)"
                placeholderTextColor={colors.textLight}
                selectionColor={colors.accent}
                value={addressLabel}
                onChangeText={setAddressLabel}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, borderColor: colors.border, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={cancelCurrentLocation}
                  disabled={saving}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
                  onPress={saveAddress}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Address</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ margin: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>My Saved Addresses</Text>

          {savedAddresses.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 40, alignItems: 'center' }}>
              <Ionicons name="bookmark-outline" size={50} color={colors.textLight} />
              <Text style={{ color: colors.textLight, marginTop: 10, textAlign: 'center' }}>
                No saved addresses yet. Generate and save your first address above.
              </Text>
            </View>
          ) : (
            savedAddresses.map((addr) => {
              const qrValue = addr.qrPayload || addr.mapsUrl || `https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`;

              return (
                <View key={addr.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{addr.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.accent, marginTop: 4 }}>{addr.digitalAddress}</Text>
                      <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 4 }}>
                        {addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setSelectedAddress({ ...addr, qrPayload: qrValue });
                        setShowQRModal(true);
                      }}
                    >
                      <Ionicons name="qr-code" size={40} color={colors.accent} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => shareAddress(addr)}
                      style={{ flex: 1, backgroundColor: colors.success, borderRadius: 8, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
                    >
                      <Ionicons name="share" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12 }}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteAddress(addr.id)}
                      style={{ flex: 1, backgroundColor: colors.error, borderRadius: 8, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
                    >
                      <Ionicons name="trash" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ margin: 16, marginBottom: 32 }}>
          <TouchableOpacity
            style={{ backgroundColor: sosActive ? colors.success : colors.error, borderRadius: 12, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={sosActive ? stopSos : undefined}
            onPressIn={startSosHold}
            onPressOut={cancelSosHold}
            disabled={sosStarting}
          >
            {sosStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name={sosActive ? 'checkmark-circle' : 'alert-circle'} size={24} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {sosActive ? 'Stop SOS Live Tracking' : `Hold ${holdCountdown}s to Send SOS`}
            </Text>
          </TouchableOpacity>
          {sosActive && isValidRemoteId(sosAlertId) && (
            <TouchableOpacity
              style={{ marginTop: 10, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.error }}
              onPress={() => router.push(`/sos/${sosAlertId}`)}
            >
              <Text style={{ color: colors.error, fontWeight: '600' }}>View Live Tracking</Text>
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={showQRModal} animationType="slide" transparent={true}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', width: '80%' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Your PinPoint QR Code</Text>

              {selectedAddress && (
                <QRCode value={selectedAddress.qrPayload} size={200} />
              )}

              <Text style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: colors.textLight }}>
                Scan to open this location in Google Maps
              </Text>

              <TouchableOpacity
                onPress={() => setShowQRModal(false)}
                style={{ marginTop: 20, backgroundColor: colors.accent, borderRadius: 8, padding: 12, width: '100%', alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
