import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function IncidentReportScreen({ navigation }) {
  const [reportType, setReportType] = useState('crime');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [anonymous, setAnonymous] = useState(false);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    getCurrentLocation();
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    // Load anonymous default from user settings
    // This would come from Firestore user doc
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }
    } catch (error) {
      console.error('Location error:', error);
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
      const response = await fetch(images[i]);
      const blob = await response.blob();
      const filename = `${Date.now()}_${i}.jpg`;
      const storageRef = ref(storage, `reports/${filename}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      uploadedUrls.push(url);
    }
    return uploadedUrls;
  };

  const handleSubmitReport = async () => {
    if (!reportType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!description) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
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
        reportType: reportType,
        description: description,
        photoUrls: imageUrls,
        location: location,
        anonymous: anonymous,
        status: 'pending_review',
        createdAt: new Date().toISOString()
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. Your report will be reviewed by community leaders.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
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
        {/* Report Type */}
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

        {/* Description */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Description</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border, minHeight: 120 }}
          placeholder="Describe what happened or what you observed..."
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {/* Images */}
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

        {/* Anonymous Toggle */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Report Anonymously</Text>
            <Text style={{ fontSize: 12, color: colors.textLight }}>Your identity will be hidden</Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: colors.border, true: colors.accent }} />
        </View>

        {/* Location Info */}
        <View style={{ backgroundColor: colors.accent + '10', borderRadius: 12, padding: 12, marginBottom: 24 }}>
          <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center' }}>
            📍 Your location will be included automatically to help responders
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 32 }}
          onPress={handleSubmitReport}
          disabled={uploading}
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