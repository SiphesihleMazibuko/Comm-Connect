import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getRows, insertRow } from '../../config/supabase';
import colors from '../../Utils/colors';

export default function IncidentReportScreen() {
  const CLOUDINARY_CLOUD_NAME = 'dx0mmgase';
  const CLOUDINARY_UPLOAD_PRESET = 'Comm-connect';

  const router = useRouter();
  const [user, setUser] = useState(null);

  const [reportType, setReportType] = useState('crime');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Pinpoint state
  const [savedPinpoints, setSavedPinpoints] = useState([]);
  const [selectedPinpoint, setSelectedPinpoint] = useState(null);
  const [loadingPinpoints, setLoadingPinpoints] = useState(true);

  // Report history state
  const [userReports, setUserReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showReportHistory, setShowReportHistory] = useState(false);

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadUserPinpoints(currentUser);
      await loadUserReports(currentUser);
    };

    load();
  }, []);

  const loadUserPinpoints = async (currentUser = user) => {
    if (!currentUser) return;

    setLoadingPinpoints(true);

    try {
      const pins = await getRows('pinpoints', {
        eq: [{ column: 'userId', value: currentUser.id }],
      });

      setSavedPinpoints(pins);

      if (pins.length > 0) {
        setSelectedPinpoint(pins[0]);
      }
    } catch (error) {
      console.error('Error loading pinpoints:', error);
    } finally {
      setLoadingPinpoints(false);
    }
  };

  const loadUserReports = async (currentUser = user) => {
    if (!currentUser) return;

    setLoadingReports(true);

    try {
      const reports = await getRows('reports', {
        eq: [{ column: 'submittedBy', value: currentUser.id }],
        order: [{ column: 'createdAt', ascending: false }],
      });

      setUserReports(reports);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoadingReports(false);
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
          name: `report_${Date.now()}_${i}.jpg`
        });

        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData
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
    console.log('user:', user?.id);

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a report.');
      return;
    }

    if (!reportType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    if (!selectedPinpoint) {
      Alert.alert(
        'No Location Selected',
        'Please save a PinPoint address first so responders can find you.',
        [
          {
            text: 'Go to PinPoint',
            onPress: () => router.push('/(tabs)/pinpoint')
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
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

      await insertRow('reports', {
        userId: anonymous ? null : user.id,
        submittedBy: user.id,
        reportType,
        description: description.trim(),
        photoUrls: imageUrls,
        location: {
          latitude: selectedPinpoint.latitude,
          longitude: selectedPinpoint.longitude,
          mapsUrl: selectedPinpoint.mapsUrl,
          digitalAddress: selectedPinpoint.digitalAddress,
          label: selectedPinpoint.label
        },
        anonymous,
        status: 'pending_review',
        createdAt: new Date().toISOString()
      });

      setDescription('');
      setImages([]);
      setAnonymous(false);
      setReportType('crime');

      await loadUserReports(user);

      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. Your report is pending review and will be approved by a community leader.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Report submission error:', error);

      Alert.alert(
        'Error',
        'Failed to submit report. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected') return 'REJECTED';
    return 'PENDING REVIEW';
  };

  const getStatusColor = (status) => {
    if (status === 'approved') return colors.accent;
    if (status === 'rejected') return colors.error;
    return colors.warning;
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
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10 }}>
            Report Incident
          </Text>
          <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8 }}>
            Help keep your community safe
          </Text>
        </View>

        <View style={{ padding: 16 }}>
          {/* Report Type */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
            Incident Type
          </Text>

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
                <Text style={{ fontSize: 20, marginBottom: 4 }}>
                  {type.label.split(' ')[0]}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: reportType === type.id ? '#fff' : colors.text
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
            Description
          </Text>

          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 120,
              textAlignVertical: 'top'
            }}
            placeholder="Describe what happened or what you observed..."
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Photos */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
            Photos (Optional)
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border
              }}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border
              }}
              onPress={pickImage}
            >
              <Ionicons name="images" size={24} color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>
                Choose from Gallery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Preview */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {images.map((uri, index) => (
                <View key={index} style={{ marginRight: 12, position: 'relative' }}>
                  <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />

                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 12,
                      padding: 4
                    }}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Anonymous Toggle */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                Report Anonymously
              </Text>
              <Text style={{ fontSize: 12, color: colors.textLight }}>
                Your identity will be hidden
              </Text>
            </View>

            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          {/* PinPoint Location Selector */}
          {loadingPinpoints ? (
            <View
              style={{
                backgroundColor: colors.accent + '10',
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10
              }}
            >
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 13, color: colors.textLight }}>
                Loading your saved addresses...
              </Text>
            </View>
          ) : savedPinpoints.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.error + '15',
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: colors.error + '40'
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="warning" size={20} color={colors.error} />
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.error }}>
                  No PinPoint Address Found
                </Text>
              </View>

              <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 12 }}>
                You need to save at least one address in PinPoint before submitting a report.
                This helps responders find your exact location.
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: colors.error,
                  borderRadius: 8,
                  padding: 10,
                  alignItems: 'center'
                }}
                onPress={() => router.push('/(tabs)/pinpoint')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                  Go to PinPoint →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
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
                    backgroundColor:
                      selectedPinpoint?.id === pin.id
                        ? colors.accent + '15'
                        : colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor:
                      selectedPinpoint?.id === pin.id
                        ? colors.accent
                        : colors.border,
                    gap: 12
                  }}
                >
                  <Ionicons
                    name="location"
                    size={22}
                    color={
                      selectedPinpoint?.id === pin.id
                        ? colors.accent
                        : colors.textLight
                    }
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                      {pin.label}
                    </Text>

                    <Text style={{ fontSize: 12, color: colors.accent, marginTop: 2 }}>
                      {pin.digitalAddress}
                    </Text>

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

          {/* Report History Dropdown */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border
            }}
          >
            <TouchableOpacity
              onPress={() => setShowReportHistory(!showReportHistory)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                  My Report History
                </Text>

                <Text style={{ fontSize: 12, color: colors.textLight }}>
                  View pending and approved incident reports
                </Text>
              </View>

              <Ionicons
                name={showReportHistory ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.textLight}
              />
            </TouchableOpacity>

            {showReportHistory && (
              <View style={{ marginTop: 16 }}>
                {loadingReports ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={{ fontSize: 13, color: colors.textLight }}>
                      Loading reports...
                    </Text>
                  </View>
                ) : userReports.length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.textLight }}>
                    No reports submitted yet.
                  </Text>
                ) : (
                  userReports.map((report) => {
                    const statusColor = getStatusColor(report.status);

                    return (
                      <View
                        key={report.id}
                        style={{
                          backgroundColor: colors.background,
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                            {report.reportType?.toUpperCase()}
                          </Text>

                          <View
                            style={{
                              backgroundColor: statusColor + '20',
                              borderRadius: 20,
                              paddingVertical: 4,
                              paddingHorizontal: 10
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: 'bold',
                                color: statusColor
                              }}
                            >
                              {getStatusLabel(report.status)}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 6 }}>
                          {report.description}
                        </Text>

                        {report.location?.label && (
                          <Text style={{ fontSize: 12, color: colors.textLight }}>
                            📍 {report.location.label}
                          </Text>
                        )}

                        {report.createdAt && (
                          <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 6 }}>
                            Submitted: {new Date(report.createdAt).toLocaleString()}
                          </Text>
                        )}

                        {report.status !== 'approved' && report.status !== 'rejected' && (
                          <Text style={{ fontSize: 11, color: colors.warning, marginTop: 6 }}>
                            Waiting for community leader approval
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: savedPinpoints.length === 0 ? colors.border : colors.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 32,
              opacity: uploading ? 0.7 : 1
            }}
            onPress={handleSubmitReport}
            disabled={uploading || savedPinpoints.length === 0}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Submit Report
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
