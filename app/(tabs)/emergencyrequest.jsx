import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function EmergencyRequestScreen({ navigation }) {
  const [emergencyType, setEmergencyType] = useState('medical');
  const [description, setDescription] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    loadSavedAddresses();
    getCurrentLocation();
  }, []);

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
      if (addresses.length > 0) {
        setSelectedAddress(addresses[0]);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        // Use current location if no saved address selected
        if (!selectedAddress) {
          setSelectedAddress({
            digitalAddress: `Current Location`,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
        }
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const emergencyTypes = [
    { id: 'medical', label: '🚑 Medical Emergency', color: colors.error },
    { id: 'crime', label: '🚨 Crime in Progress', color: '#DC2626' },
    { id: 'fire', label: '🔥 Fire Emergency', color: '#F59E0B' },
    { id: 'accident', label: '⚠️ Accident', color: '#F97316' }
  ];

  const handleSubmitRequest = async () => {
    if (!description) {
      Alert.alert('Error', 'Please describe your emergency');
      return;
    }

    if (!contactDetails) {
      Alert.alert('Error', 'Please provide contact details');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'emergencyRequests'), {
        userId: user.uid,
        type: emergencyType,
        description: description,
        contactDetails: contactDetails,
        pinpointId: selectedAddress?.id || null,
        location: {
          latitude: selectedAddress?.latitude || null,
          longitude: selectedAddress?.longitude || null
        },
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      Alert.alert(
        'Emergency Request Sent',
        'Help has been notified. Stay calm and wait for assistance.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send emergency request. Please call emergency services directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.error, padding: 24, alignItems: 'center' }}>
        <Ionicons name="alert-circle" size={60} color="#fff" />
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10 }}>Emergency Request</Text>
        <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, textAlign: 'center', marginTop: 5 }}>
          Only use this for real emergencies
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        {/* Emergency Type Selection */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Type of Emergency</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {emergencyTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={{
                flex: 1,
                minWidth: '45%',
                padding: 12,
                borderRadius: 12,
                backgroundColor: emergencyType === type.id ? type.color : colors.surface,
                borderWidth: 2,
                borderColor: emergencyType === type.id ? type.color : colors.border,
                alignItems: 'center'
              }}
              onPress={() => setEmergencyType(type.id)}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.label.split(' ')[0]}</Text>
              <Text style={{ fontSize: 12, color: emergencyType === type.id ? '#fff' : colors.text, textAlign: 'center' }}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location Selection */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Your Location</Text>
        {savedAddresses.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
            {savedAddresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: selectedAddress?.id === addr.id ? colors.accent + '20' : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedAddress?.id === addr.id ? colors.accent : colors.border,
                  marginBottom: 8
                }}
                onPress={() => setSelectedAddress(addr)}
              >
                <Ionicons name="location" size={24} color={selectedAddress?.id === addr.id ? colors.accent : colors.textLight} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>{addr.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight }}>{addr.digitalAddress}</Text>
                </View>
                {selectedAddress?.id === addr.id && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.border }}
            onPress={() => navigation.navigate('PinPoint')}
          >
            <Ionicons name="add-circle" size={30} color={colors.accent} />
            <Text style={{ color: colors.accent, marginTop: 8 }}>Create a PinPoint address first</Text>
          </TouchableOpacity>
        )}

        {/* Description */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Description</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border, minHeight: 100 }}
          placeholder="Describe what's happening..."
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {/* Contact Details */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Contact Details</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}
          placeholder="Phone number for emergency contact"
          keyboardType="phone-pad"
          value={contactDetails}
          onChangeText={setContactDetails}
        />

        {/* Warning */}
        <View style={{ backgroundColor: colors.warning + '20', borderRadius: 12, padding: 12, marginBottom: 24 }}>
          <Text style={{ color: colors.warning, fontSize: 12, textAlign: 'center' }}>
            ⚠️ Only use this feature for genuine emergencies. False reports will be reported to authorities.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={{ backgroundColor: colors.error, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 32 }}
          onPress={handleSubmitRequest}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>SEND EMERGENCY REQUEST</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}