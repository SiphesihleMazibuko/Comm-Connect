import TouchableOpacity from "../../components/FeedbackTouchableOpacity";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ScreenHeader";
import { uploadReportImages } from "../../config/mediaUpload";
import { getCurrentUser, getRows, getUserProfile, insertRow } from "../../config/supabase";
import { useTheme } from "../context/ThemeContext";

export default function IncidentReportScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [reportType, setReportType] = useState("crime");
  const [crimeCategory, setCrimeCategory] = useState("theft");
  const [otherCategory, setOtherCategory] = useState("funeral");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savedPinpoints, setSavedPinpoints] = useState([]);
  const [selectedPinpoint, setSelectedPinpoint] = useState(null);
  const [loadingPinpoints, setLoadingPinpoints] = useState(true);
  const [userReports, setUserReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showReportHistory, setShowReportHistory] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          const profile = await getUserProfile(currentUser.id);
          setUserProfile(profile);
          await loadUserPinpoints(currentUser);
          await loadUserReports(currentUser);
        }
      } catch (error) {
        console.error("Error loading incident report screen:", error);
      }
    };
    load();
  }, []);

  const loadUserPinpoints = async (currentUser = user) => {
    if (!currentUser) return;
    setLoadingPinpoints(true);
    try {
      const pins = await getRows("pinpoints", { eq: [{ column: "userId", value: currentUser.id }] });
      setSavedPinpoints(pins || []);
      if (pins && pins.length > 0) setSelectedPinpoint(pins[0]);
    } catch (error) {
      console.error("Error loading pinpoints:", error);
    } finally {
      setLoadingPinpoints(false);
    }
  };

  const loadUserReports = async (currentUser = user) => {
    if (!currentUser) return;
    setLoadingReports(true);
    try {
      const reports = await getRows("reports", {
        eq: [{ column: "submittedBy", value: currentUser.id }],
        order: [{ column: "createdAt", ascending: false }]
      });
      setUserReports(reports || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setImages((currentImages) => [...currentImages, result.assets[0].uri]);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Unable to open your photo gallery. Please try again.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setImages((currentImages) => [...currentImages, result.assets[0].uri]);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Unable to open the camera. Please try again.");
    }
  };

  const removeImage = (index) => {
    setImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleSubmitReport = async () => {
    console.log("=== SUBMIT DEBUG ===");
    console.log("reportType:", reportType);
    console.log("description:", description);
    console.log("selectedPinpoint:", selectedPinpoint);
    console.log("images:", images);
    console.log("user:", user?.id);
    console.log("userProfile:", userProfile);

    if (!user) {
      Alert.alert("Error", "You must be logged in to submit a report.");
      return;
    }
    if (!userProfile?.ward_id) {
      Alert.alert("Location Required", "Your account does not have a ward assigned. Please update your profile in Settings.", [
        { text: "Go to Settings", onPress: () => router.push("/(tabs)/settings") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }
    if (!reportType) {
      Alert.alert("Error", "Please select a report type.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please provide a description.");
      return;
    }
    if (!selectedPinpoint) {
      Alert.alert("No Location Selected", "Please save a PinPoint address first so Community Protection Services can find you.", [
        { text: "Go to PinPoint", onPress: () => router.push("/(tabs)/pinpoint") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }

    setUploading(true);
    try {
      let imageUrls = [];
      if (images.length > 0) {
        try {
          imageUrls = await uploadReportImages(images);
        } catch (error) {
          console.warn("Image upload deferred until sync:", error);
          imageUrls = images;
        }
      }

      const reportPayload = {
        userId: anonymous ? null : user.id,
        submittedBy: user.id,
        reportType,
        crimeCategory: reportType === "crime" ? crimeCategory : null,
        otherCategory: reportType === "other" ? otherCategory : null,
        description: description.trim(),
        photoUrls: imageUrls,
        location: {
          latitude: selectedPinpoint.latitude,
          longitude: selectedPinpoint.longitude,
          mapsUrl: selectedPinpoint.mapsUrl,
          digitalAddress: selectedPinpoint.digitalAddress,
          label: selectedPinpoint.label,
          crimeCategory: reportType === "crime" ? crimeCategory : null,
          otherCategory: reportType === "other" ? otherCategory : null,
        },
        anonymous,
        status: "pending_review",
        createdAt: new Date().toISOString(),
        suburb_id: userProfile.suburb_id,
        ward_id: userProfile.ward_id,
      };

      await insertRow("reports", reportPayload);
      setDescription("");
      setImages([]);
      setAnonymous(false);
      setReportType("crime");
      setCrimeCategory("theft");
      setOtherCategory("funeral");
      await loadUserReports(user);

      Alert.alert("Report Submitted", "Thank you for helping keep our community safe. Your report is pending review and will be approved by a community leader.", [{ text: "OK" }]);
    } catch (error) {
      console.error("Report submission error:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.", [{ text: "OK" }]);
    } finally {
      setUploading(false);
    }
  };

  const getStatusLabel = (status) => {
    if (status === "approved") return "APPROVED";
    if (status === "rejected") return "REJECTED";
    return "PENDING REVIEW";
  };

  const getStatusColor = (status) => {
    if (status === "approved") return colors.accent;
    if (status === "rejected") return colors.error;
    return colors.warning;
  };

  const getStatusBackground = (status) => {
    if (status === "approved") return colors.accentLight;
    if (status === "rejected") return colors.errorLight;
    return colors.warningLight;
  };

  const reportTypes = [
    { id: "crime", label: "Crime", description: "Report criminal activity", icon: "shield", color: colors.error },
    { id: "hazard", label: "Hazard", description: "Report a dangerous situation", icon: "warning", color: colors.warning },
    { id: "infrastructure", label: "Infrastructure", description: "Report damaged facilities", icon: "construct", color: colors.primary },
    { id: "other", label: "Other", description: "Community-related matter", icon: "calendar", color: colors.textLight },
  ];

  const crimeCategories = [
    { id: "theft", label: "Theft", icon: "pricetag" },
    { id: "burglary", label: "Burglary", icon: "home" },
    { id: "assault", label: "Assault", icon: "body" },
    { id: "robbery", label: "Robbery", icon: "alert-circle" },
    { id: "vandalism", label: "Vandalism", icon: "hammer" },
    { id: "suspicious_activity", label: "Suspicious Activity", icon: "eye" },
    { id: "other_crime", label: "Other Crime", icon: "ellipsis-horizontal" },
  ];

  const otherCategories = [
    { id: "funeral", label: "Funeral", icon: "flower" },
    { id: "wedding", label: "Wedding", icon: "heart" },
    { id: "community_event", label: "Community Event", icon: "people" },
    { id: "lost_found", label: "Lost & Found", icon: "search" },
    { id: "noise_complaint", label: "Noise Complaint", icon: "volume-high" },
    { id: "other_event", label: "Other", icon: "ellipsis-horizontal" },
  ];

  const getCrimeCategoryLabel = (value) => crimeCategories.find((category) => category.id === value)?.label || "Other Crime";
  const getReportCrimeCategory = (report) => report?.crimeCategory || report?.location?.crimeCategory || "other_crime";
  const getOtherCategoryLabel = (value) => otherCategories.find((category) => category.id === value)?.label || "Other";
  const getReportOtherCategory = (report) => report?.otherCategory || report?.location?.otherCategory || "other_event";

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Report Incident" subtitle="Help keep your community safe" icon="megaphone" />
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ backgroundColor: colors.accentSoft, borderRadius: 18, padding: 16, marginBottom: 22, borderWidth: 1, borderColor: colors.accentLight, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Ionicons name="megaphone-outline" size={23} color={colors.textInverse} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 3 }}>See something? Report it.</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textLight }}>Your report helps community leaders respond to incidents in your area.</Text>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>What would you like to report?</Text>
            <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>Select the category that best describes the incident.</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 24 }}>
            {reportTypes.map((type) => {
              const isSelected = reportType === type.id;
              return (
                <TouchableOpacity key={type.id} onPress={() => setReportType(type.id)} style={{
                  width: "48%",
                  minHeight: 122,
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 10,
                  backgroundColor: isSelected ? type.color : colors.surface,
                  borderWidth: 1.5,
                  borderColor: isSelected ? type.color : colors.border,
                  shadowOpacity: isSelected ? 0.08 : 0,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? "rgba(255,255,255,0.18)" : colors.background }}>
                      <Ionicons name={type.icon} size={22} color={isSelected ? colors.textInverse : type.color} />
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={21} color={colors.textInverse} />}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "800", marginTop: 12, color: isSelected ? colors.textInverse : colors.text }}>{type.label}</Text>
                  <Text style={{ fontSize: 10, lineHeight: 15, marginTop: 3, color: isSelected ? "rgba(255,255,255,0.85)" : colors.textLight }}>{type.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {reportType === "crime" && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 }}>Crime type</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>What kind of crime did you observe?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                {crimeCategories.map((category) => {
                  const isSelected = crimeCategory === category.id;
                  return (
                    <TouchableOpacity key={category.id} onPress={() => setCrimeCategory(category.id)} style={{
                      width: "48%",
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                      borderRadius: 13,
                      marginBottom: 9,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.accent : colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? colors.accent : colors.background, marginRight: 9 }}>
                        <Ionicons name={category.icon} size={16} color={isSelected ? colors.textInverse : colors.accent} />
                      </View>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "700", fontSize: 11 }}>{category.label}</Text>
                      {isSelected && <Ionicons name="checkmark" size={17} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {reportType === "other" && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 }}>Other type</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>Select the type of community matter.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                {otherCategories.map((category) => {
                  const isSelected = otherCategory === category.id;
                  return (
                    <TouchableOpacity key={category.id} onPress={() => setOtherCategory(category.id)} style={{
                      width: "48%",
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                      borderRadius: 13,
                      marginBottom: 9,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.accent : colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? colors.accent : colors.background, marginRight: 9 }}>
                        <Ionicons name={category.icon} size={16} color={isSelected ? colors.textInverse : colors.accent} />
                      </View>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "700", fontSize: 11 }}>{category.label}</Text>
                      {isSelected && <Ionicons name="checkmark" size={17} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 }}>Tell us what happened</Text>
            <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>Provide as much useful information as possible.</Text>
            <View style={{ backgroundColor: colors.inputBackground, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder, padding: 14 }}>
              <TextInput style={{ minHeight: 130, textAlignVertical: "top", color: colors.text, fontSize: 14, lineHeight: 21 }} placeholder="Describe what happened or what you observed..." placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.accent} multiline value={description} onChangeText={setDescription} maxLength={1000} />
              <Text style={{ textAlign: "right", fontSize: 10, color: colors.textLight, marginTop: 5 }}>{description.length}/1000</Text>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Evidence photos</Text>
              <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textLight }}>OPTIONAL</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>Add photos that may help with the report.</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={takePhoto} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 15, alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 7 }}>
                  <Ionicons name="camera-outline" size={23} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Take Photo</Text>
                <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>Use camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 15, alignItems: "center" }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 7 }}>
                  <Ionicons name="images-outline" size={23} color={colors.accent} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Gallery</Text>
                <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>Choose photo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {images.length > 0 && (
            <View style={{ marginTop: -8, marginBottom: 24 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Selected photos</Text>
                <Text style={{ fontSize: 11, color: colors.textLight }}>{images.length} photo{images.length !== 1 ? "s" : ""}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {images.map((uri, index) => (
                  <View key={index} style={{ width: 100, height: 100, marginRight: 10, borderRadius: 14, overflow: "hidden", position: "relative", backgroundColor: colors.surface }}>
                    <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                    <View style={{ position: "absolute", top: 6, right: 6 }}>
                      <TouchableOpacity onPress={() => removeImage(index)} style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)" }}>
                        <Ionicons name="close" size={15} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Ionicons name="eye-off-outline" size={21} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>Report anonymously</Text>
              <Text style={{ fontSize: 11, lineHeight: 17, color: colors.textLight, marginTop: 2, paddingRight: 8 }}>Your identity will be hidden from the community.</Text>
            </View>
            <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.textInverse} />
          </View>

          <View style={{ marginBottom: 24 }}>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>Report location</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3 }}>Where did the incident happen?</Text>
            </View>
            {loadingPinpoints ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ fontSize: 12, color: colors.textLight, marginLeft: 10 }}>Loading your saved addresses...</Text>
              </View>
            ) : savedPinpoints.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.errorLight }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.errorLight, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <Ionicons name="location-outline" size={21} color={colors.error} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: colors.error }}>No PinPoint address</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textLight, lineHeight: 19, marginBottom: 13 }}>Save an address in PinPoint first. This allows Community Protection Services to locate the incident accurately.</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/pinpoint")} style={{ backgroundColor: colors.error, borderRadius: 11, paddingVertical: 12, alignItems: "center" }}>
                  <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: "800" }}>Open PinPoint</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 9 }}>Select a saved address</Text>
                {savedPinpoints.map((pin) => {
                  const isSelected = selectedPinpoint?.id === pin.id;
                  return (
                    <TouchableOpacity key={pin.id} onPress={() => setSelectedPinpoint(pin)} style={{
                      backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 9,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.accent : colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}>
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: isSelected ? colors.accent : colors.background, alignItems: "center", justifyContent: "center", marginRight: 11 }}>
                        <Ionicons name="location" size={20} color={isSelected ? colors.textInverse : colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>{pin.label}</Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.accent, marginTop: 3 }}>{pin.digitalAddress}</Text>
                        <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 3 }}>
                          {typeof pin.latitude === "number" ? pin.latitude.toFixed(5) : pin.latitude} {"  •  "}
                          {typeof pin.longitude === "number" ? pin.longitude.toFixed(5) : pin.longitude}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={23} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 24, overflow: "hidden" }}>
            <TouchableOpacity onPress={() => setShowReportHistory(!showReportHistory)} style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="document-text-outline" size={21} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>My Report History</Text>
                <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 3 }}>{userReports.length} report{userReports.length !== 1 ? "s" : ""} submitted</Text>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={showReportHistory ? "chevron-up" : "chevron-down"} size={18} color={colors.textLight} />
              </View>
            </TouchableOpacity>
            {showReportHistory && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 14 }} />
                {loadingReports ? (
                  <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={{ fontSize: 12, color: colors.textLight, marginLeft: 9 }}>Loading reports...</Text>
                  </View>
                ) : userReports.length === 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 18 }}>
                    <Ionicons name="documents-outline" size={34} color={colors.textLight} />
                    <Text style={{ fontSize: 13, color: colors.textLight, marginTop: 8 }}>No reports submitted yet.</Text>
                  </View>
                ) : (
                  userReports.map((report) => {
                    const statusColor = getStatusColor(report.status);
                    const statusBackground = getStatusBackground(report.status);
                    return (
                      <View key={report.id} style={{ backgroundColor: colors.background, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <View style={{ width: 31, height: 31, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                              <Ionicons name={report.reportType === "crime" ? "shield-outline" : report.reportType === "hazard" ? "warning-outline" : "document-outline"} size={16} color={colors.accent} />
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>{report.reportType?.toUpperCase()}</Text>
                          </View>
                          <View style={{ backgroundColor: statusBackground, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 9 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", color: statusColor }}>{getStatusLabel(report.status)}</Text>
                          </View>
                        </View>
                        {report.reportType === "crime" && (
                          <View style={{ backgroundColor: colors.surface, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 7 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.accent }}>{getCrimeCategoryLabel(getReportCrimeCategory(report))}</Text>
                          </View>
                        )}
                        {report.reportType === "other" && (
                          <View style={{ backgroundColor: colors.surface, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 7 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.accent }}>{getOtherCategoryLabel(getReportOtherCategory(report))}</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textLight, marginBottom: 7 }} numberOfLines={4}>{report.description}</Text>
                        {report.location?.label && (
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                            <Ionicons name="location-outline" size={13} color={colors.textLight} />
                            <Text style={{ flex: 1, fontSize: 10, color: colors.textLight, marginLeft: 5 }} numberOfLines={1}>{report.location.label}</Text>
                          </View>
                        )}
                        {report.createdAt && <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 2 }}>Submitted {new Date(report.createdAt).toLocaleString()}</Text>}
                        {report.status !== "approved" && report.status !== "rejected" && (
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <Ionicons name="time-outline" size={13} color={colors.warning} />
                            <Text style={{ fontSize: 10, color: colors.warning, marginLeft: 5, fontWeight: "600" }}>Waiting for community leader approval</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          <TouchableOpacity onPress={handleSubmitReport} disabled={uploading || savedPinpoints.length === 0} style={{
            backgroundColor: savedPinpoints.length === 0 ? colors.disabled : colors.accent,
            borderRadius: 16,
            minHeight: 58,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 25,
            opacity: uploading ? 0.7 : 1,
            flexDirection: "row",
            shadowOpacity: savedPinpoints.length === 0 ? 0 : 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}>
            {uploading ? (
              <>
                <ActivityIndicator color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontWeight: "800", fontSize: 14, marginLeft: 9 }}>Submitting report...</Text>
              </>
            ) : (
              <>
                <Ionicons name="send" size={19} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontWeight: "800", fontSize: 15, marginLeft: 9 }}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 15, marginBottom: 20 }}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textLight} />
            <Text style={{ fontSize: 10, color: colors.textLight, marginLeft: 5, textAlign: "center" }}>Your report will be reviewed by your community leader.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}