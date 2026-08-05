import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import {
  Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect,
  useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { uploadReportImages } from '../../config/mediaUpload';
import { getCurrentUser, getRows, getUserProfile, insertRow } from '../../config/supabase';
import colors from '../../Utils/colors';

export default function IncidentReportScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const [reportType, setReportType] = useState('crime');
  const [crimeCategory, setCrimeCategory] = useState('theft');
  const [otherCategory, setOtherCategory] = useState('funeral');
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
      
      if (currentUser) {
        const profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);
        await loadUserPinpoints(currentUser);
        await loadUserReports(currentUser);
      }
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

  const handleSubmitReport = async () => {
    console.log('=== SUBMIT DEBUG ===');
    console.log('reportType:', reportType);
    console.log('description:', description);
    console.log('selectedPinpoint:', selectedPinpoint);
    console.log('images:', images);
    console.log('user:', user?.id);
    console.log('userProfile:', userProfile);

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a report.');
      return;
    }

    // Check if user has ward assigned
    if (!userProfile?.ward_id) {
      Alert.alert(
        'Location Required',
        'Your account does not have a ward assigned. Please update your profile in Settings.',
        [
          {
            text: 'Go to Settings',
            onPress: () => router.push('/(tabs)/settings')
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
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
        'Please save a PinPoint address first so Community Protection Services can find you.',
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
        try {
          imageUrls = await uploadReportImages(images);
        } catch (error) {
          console.warn('Image upload deferred until sync:', error);
          imageUrls = images;
        }
      }

      // Submit report with ward_id and suburb_id
      const reportPayload = {
        userId: anonymous ? null : user.id,
        submittedBy: user.id,
        reportType,
        crimeCategory: reportType === 'crime' ? crimeCategory : null,
        otherCategory: reportType === 'other' ? otherCategory : null,
        description: description.trim(),
        photoUrls: imageUrls,
        location: {
          latitude: selectedPinpoint.latitude,
          longitude: selectedPinpoint.longitude,
          mapsUrl: selectedPinpoint.mapsUrl,
          digitalAddress: selectedPinpoint.digitalAddress,
          label: selectedPinpoint.label,
          crimeCategory: reportType === 'crime' ? crimeCategory : null,
          otherCategory: reportType === 'other' ? otherCategory : null,
        },
        anonymous,
        status: 'pending_review',
        createdAt: new Date().toISOString(),
        suburb_id: userProfile.suburb_id,
        ward_id: userProfile.ward_id,
      };

      await insertRow('reports', reportPayload);

      setDescription('');
      setImages([]);
      setAnonymous(false);
      setReportType('crime');
      setCrimeCategory('theft');
      setOtherCategory('funeral');

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
    { id: 'crime', label: 'Crime', icon: 'shield', color: colors.error },
    { id: 'hazard', label: 'Hazard', icon: 'warning', color: colors.warning },
    { id: 'infrastructure', label: 'Infrastructure', icon: 'construct', color: colors.primary },
    { id: 'other', label: 'Other', icon: 'calendar', color: colors.textLight },
  ];
  const crimeCategories = [
    { id: 'theft', label: 'Theft', icon: 'pricetag' },
    { id: 'burglary', label: 'Burglary', icon: 'home' },
    { id: 'assault', label: 'Assault', icon: 'body' },
    { id: 'robbery', label: 'Robbery', icon: 'alert-circle' },
    { id: 'vandalism', label: 'Vandalism', icon: 'hammer' },
    { id: 'suspicious_activity', label: 'Suspicious Activity', icon: 'eye' },
    { id: 'other_crime', label: 'Other Crime', icon: 'ellipsis-horizontal' },
  ];

  const otherCategories = [
    { id: 'funeral', label: 'Funeral', icon: 'flower' },
    { id: 'wedding', label: 'Wedding', icon: 'heart' },
    { id: 'community_event', label: 'Community Event', icon: 'people' },
    { id: 'lost_found', label: 'Lost & Found', icon: 'search' },
    { id: 'noise_complaint', label: 'Noise Complaint', icon: 'volume-high' },
    { id: 'other_event', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const getCrimeCategoryLabel = (value) => (
    crimeCategories.find((category) => category.id === value)?.label || 'Other Crime'
  );

  const getReportCrimeCategory = (report) => (
    report?.crimeCategory || report?.location?.crimeCategory || 'other_crime'
  );

  const getOtherCategoryLabel = (value) => (
    otherCategories.find((category) => category.id === value)?.label || 'Other'
  );

  const getReportOtherCategory = (report) => (
    report?.otherCategory || report?.location?.otherCategory || 'other_event'
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title="Report Incident"
          subtitle="Help keep your community safe"
          icon="megaphone"
        />

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
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: reportType === type.id ? 'rgba(255,255,255,0.18)' : colors.background,
                    marginBottom: 8
                  }}
                >
                  <Ionicons
                    name={type.icon}
                    size={22}
                    color={reportType === type.id ? '#fff' : type.color}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: reportType === type.id ? '#fff' : colors.text,
                    fontWeight: '700'
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reportType === 'crime' && (
            <>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
                Crime Kind
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {crimeCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setCrimeCategory(category.id)}
                    style={{
                      width: '47%',
                      backgroundColor: crimeCategory === category.id ? colors.accent : colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1.5,
                      borderColor: crimeCategory === category.id ? colors.accent : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <Ionicons
                      name={category.icon}
                      size={18}
                      color={crimeCategory === category.id ? '#fff' : colors.accent}
                    />
                    <Text style={{ flex: 1, color: crimeCategory === category.id ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {reportType === 'other' && (
            <>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
                Other Kind
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {otherCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setOtherCategory(category.id)}
                    style={{
                      width: '47%',
                      backgroundColor: otherCategory === category.id ? colors.accent : colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1.5,
                      borderColor: otherCategory === category.id ? colors.accent : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <Ionicons
                      name={category.icon}
                      size={18}
                      color={otherCategory === category.id ? '#fff' : colors.accent}
                    />
                    <Text style={{ flex: 1, color: otherCategory === category.id ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Description */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
            Description
          </Text>

          <TextInput
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 12,
              padding: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 120,
              textAlignVertical: 'top',
              color: colors.text
            }}
            placeholder="Describe what happened or what you observed..."
            placeholderTextColor={colors.textLight}
            selectionColor={colors.accent}
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
                backgroundColor: colors.accentSoft,
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
                backgroundColor: colors.surfaceSoft,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: colors.border
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
                This helps Community Protection Services find your exact location.
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
                Report Location
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
                        ? colors.accentSoft
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
                              backgroundColor: statusColor === colors.accent ? colors.accentSoft : colors.surfaceRaised,
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

                        {report.reportType === 'crime' && (
                          <Text style={{ fontSize: 12, color: colors.accent, marginBottom: 6 }}>
                            Crime kind: {getCrimeCategoryLabel(getReportCrimeCategory(report))}
                          </Text>
                        )}

                        {report.reportType === 'other' && (
                          <Text style={{ fontSize: 12, color: colors.accent, marginBottom: 6 }}>
                            Other kind: {getOtherCategoryLabel(getReportOtherCategory(report))}
                          </Text>
                        )}

                        <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 6 }}>
                          {report.description}
                        </Text>

                        {report.location?.label && (
                          <Text style={{ fontSize: 12, color: colors.textLight }}>
                            {report.location.label}
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
