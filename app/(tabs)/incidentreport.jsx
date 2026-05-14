import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function IncidentReportScreen() {
  const CLOUDINARY_CLOUD_NAME = 'dx0mmgase';
  const CLOUDINARY_UPLOAD_PRESET = 'Comm-connect';
  const router = useRouter();
  const [reportType, setReportType] = useState('crime');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Pinpoint state
  const [savedPinpoints, setSavedPinpoints] = useState([]);
  const [selectedPinpoint, setSelectedPinpoint] = useState(null);
  const [loadingPinpoints, setLoadingPinpoints] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    loadUserPinpoints();
  }, []);

    const loadUserPinpoints = async () => {
    if (!user) return;
    setLoadingPinpoints(true);
    try {
      const q = query(collection(db, 'pinpoints'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const pins = [];
      querySnapshot.forEach((doc) => {
        pins.push({ id: doc.id, ...doc.data() });
      });
      setSavedPinpoints(pins);

      if (pins.length > 0) setSelectedPinpoint(pins[0]);
    } catch (error) {
      console.error('Error loading pinpoints:', error);
    } finally {
      setLoadingPinpoints(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: false
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };


 const uploadImages = async () => {
  const uploadedUrls = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const uri = images[i];
      const formData = new FormData();

      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: `report_${Date.now()}_${i}.jpg`,
      });
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      console.log('Cloudinary response:', data);

      if (data.secure_url) {
        uploadedUrls.push(data.secure_url);
      } else {
        throw new Error(data.error?.message || 'No URL returned from Cloudinary');
      }
    } catch (error) {
      console.error(`Failed to upload image ${i}:`, error);
      throw error;
    }
  }

  return uploadedUrls;
};

  const handleSubmitReport = async () => {
      console.log('=== SUBMIT DEBUG ===');
  console.log('reportType:', reportType);
  console.log('description:', description);
  console.log('selectedPinpoint:', selectedPinpoint);
  console.log('images:', images);
  console.log('user:', user?.uid);
    if (!reportType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!description) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    if (!selectedPinpoint) {
      Alert.alert(
        'No Location Selected',
        'Please save a PinPoint address first so responders can find you.',
        [
          { text: 'Go to PinPoint', onPress: () => router.push('/(tabs)/pinpoint') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    setUploading(true);
    try {
      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadImages();
      }

      await addDoc(collection(db, 'reports'), {
        userId: anonymous ? null : user.uid,
        reportType,
        description,
        photoUrls: imageUrls,
        // Use selected pinpoint coordinates directly
        location: {
          latitude: selectedPinpoint.latitude,
          longitude: selectedPinpoint.longitude,
          mapsUrl: selectedPinpoint.mapsUrl,
          digitalAddress: selectedPinpoint.digitalAddress,
          label: selectedPinpoint.label,
        },
        anonymous,
        status: 'pending_review',
        createdAt: new Date().toISOString()
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. Your report will be reviewed by community leaders.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/communityfeed') }]
      );
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.', [{ text: 'OK' }]);
    } finally {
      setUploading(false);
    }
  };

  const reportTypes = [
    { id: 'crime', label: '🚨 Crime', color: colors.error },
    { id: 'hazard', label: '⚠️ Hazard', color: colors.warning },
    { id: 'infrastructure', label: '🏗️ Infrastructure', color: colors.primary },
    { id: 'other', label: '📝 Other', color: colors.textLight }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Header */}
        <View style={{ backgroundColor: colors.primary, padding: 24, alignItems: 'center' }}>
          <Ionicons name="megaphone" size={50} color={colors.accent} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10 }}>Report Incident</Text>
          <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8 }}>Help keep your community safe</Text>
        </View>

        <View style={{ padding: 16 }}>

          {/* ── Report Type ── */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Incident Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: reportType === type.id ? type.color : colors.surface,
                  borderWidth: 2,
                  borderColor: reportType === type.id ? type.color : colors.border,
                  alignItems: 'center'
                }}
                onPress={() => setReportType(type.id)}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.label.split(' ')[0]}</Text>
                <Text style={{ fontSize: 12, color: reportType === type.id ? '#fff' : colors.text }}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Description ── */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Description</Text>
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 120,
              textAlignVertical: 'top',
            }}
            placeholder="Describe what happened or what you observed..."
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* ── Photos ── */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Photos (Optional)</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              onPress={pickImage}
            >
              <Ionicons name="images" size={24} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Image Preview */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {images.map((uri, index) => (
                <View key={index} style={{ marginRight: 12, position: 'relative' }}>
                  <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Anonymous Toggle ── */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border
          }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Report Anonymously</Text>
              <Text style={{ fontSize: 12, color: colors.textLight }}>Your identity will be hidden</Text>
            </View>
            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          {/* ── PinPoint Location Selector ── */}
          {loadingPinpoints ? (
            <View style={{
              backgroundColor: colors.accent + '10',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10
            }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 13, color: colors.textLight }}>Loading your saved addresses...</Text>
            </View>

          ) : savedPinpoints.length === 0 ? (
            // No pinpoints — block submission and direct to PinPoint
            <View style={{
              backgroundColor: colors.error + '15',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.error + '40'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="warning" size={20} color={colors.error} />
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.error }}>No PinPoint Address Found</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 12 }}>
                You need to save at least one address in PinPoint before submitting a report. This helps responders find your exact location.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.error, borderRadius: 8, padding: 10, alignItems: 'center' }}
                onPress={() => router.push('/(tabs)/pinpoint')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Go to PinPoint →</Text>
              </TouchableOpacity>
            </View>

          ) : (
            // Pinpoints found — show selector
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>
                📍 Report Location
              </Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>
                Select which of your saved addresses to use for this report
              </Text>
              {savedPinpoints.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  onPress={() => setSelectedPinpoint(pin)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selectedPinpoint?.id === pin.id ? colors.accent + '15' : colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor: selectedPinpoint?.id === pin.id ? colors.accent : colors.border,
                    gap: 12,
                  }}
                >
                  <Ionicons
                    name="location"
                    size={22}
                    color={selectedPinpoint?.id === pin.id ? colors.accent : colors.textLight}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>{pin.label}</Text>
                    <Text style={{ fontSize: 12, color: colors.accent, marginTop: 2 }}>{pin.digitalAddress}</Text>
                    <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
                      {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </Text>
                  </View>
                  {selectedPinpoint?.id === pin.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Submit Button ── */}
          <TouchableOpacity
            style={{
              backgroundColor: savedPinpoints.length === 0 ? colors.border : colors.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 32,
              opacity: uploading ? 0.7 : 1,
            }}
            onPress={handleSubmitReport}
            disabled={uploading || savedPinpoints.length === 0}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Submit Report</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}