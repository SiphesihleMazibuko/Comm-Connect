import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function PinPointScreen() {
  const [location, setLocation] = useState(null);
  const [digitalAddress, setDigitalAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const router = useRouter();
  const user = auth.currentUser;

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const getCurrentLocation = async () => {
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
      setLoading(false);
    }
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
      await addDoc(collection(db, 'pinpoints'), {
        userId: user.uid,
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
      loadSavedAddresses();
    } catch (error) {
      Alert.alert('Error', 'Failed to save address');
      console.error('Save address error:', error);
    } finally {
      setSaving(false);
    }
  };

  const loadSavedAddresses = async () => {
    if (!user) return;

    try {
      const q = query(collection(db, 'pinpoints'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const addresses = [];
      querySnapshot.forEach((doc) => {
        addresses.push({ id: doc.id, ...doc.data() });
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
              await deleteDoc(doc(db, 'pinpoints', addressId));
              loadSavedAddresses();
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

  const requestEmergency = () => {
    if (!location && savedAddresses.length === 0) {
      Alert.alert('Error', 'Please generate or save an address first');
      return;
    }

    Alert.alert('Emergency', 'This will open emergency request screen');
    router.push('../(tabs)/emergencyrequest');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ backgroundColor: colors.primary, padding: 20, alignItems: 'center' }}>
          <Ionicons name="location" size={50} color={colors.accent} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10 }}>PinPoint Address</Text>
          <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8, marginTop: 5, textAlign: 'center' }}>
            Generate your unique digital address
          </Text>
        </View>

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

          {digitalAddress !== '' && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, color: colors.textLight, marginBottom: 5 }}>Your Digital Address:</Text>

              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.accent, textAlign: 'center' }}>
                  {digitalAddress}
                </Text>
              </View>

              <TextInput
                style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border }}
                placeholder="Label (e.g., Home, Work, Shop)"
                value={addressLabel}
                onChangeText={setAddressLabel}
              />

              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 }}
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
                      style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
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
            style={{ backgroundColor: colors.error, borderRadius: 12, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={requestEmergency}
          >
            <Ionicons name="alert-circle" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Request Emergency Assistance</Text>
          </TouchableOpacity>
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