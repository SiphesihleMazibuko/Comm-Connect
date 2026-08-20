import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TouchableOpacity from "../../components/FeedbackTouchableOpacity";
import ScreenHeader from "../../components/ScreenHeader";

import { getCurrentUser, getRows, getUserProfile, insertRow } from "../../config/supabase";

import { useTheme } from "../context/ThemeContext";

export default function EmergencyRequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [emergencyType, setEmergencyType] = useState("medical");
  const [description, setDescription] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userEmergencies, setUserEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedPinpoints, setSavedPinpoints] = useState([]);
  const [selectedPinpoint, setSelectedPinpoint] = useState(null);
  const [loadingPinpoints, setLoadingPinpoints] = useState(true);

  useEffect(() => {
    loadScreenData();
  }, []);

  const loadScreenData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser) return;
      const profile = await getUserProfile(currentUser.id);
      setUserProfile(profile);
      await Promise.all([loadUserPinpoints(currentUser), loadUserEmergencies(currentUser)]);
    } catch (error) {
      console.error("Error loading emergency screen:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPinpoints = async (currentUser) => {
    if (!currentUser) return;
    setLoadingPinpoints(true);
    try {
      const pins = await getRows("pinpoints", { eq: [{ column: "userId", value: currentUser.id }] });
      setSavedPinpoints(pins || []);
      if (pins?.length > 0) setSelectedPinpoint(pins[0]);
    } catch (error) {
      console.error("Error loading pinpoints:", error);
    } finally {
      setLoadingPinpoints(false);
    }
  };

  const loadUserEmergencies = async (currentUser) => {
    if (!currentUser) return;
    try {
      const emergencies = await getRows("emergencyRequests", {
        eq: [{ column: "userId", value: currentUser.id }],
        order: [{ column: "createdAt", ascending: false }]
      });
      setUserEmergencies(emergencies || []);
    } catch (error) {
      console.error("Error loading emergencies:", error);
    }
  };

  const emergencyTypes = [
    { id: "medical", icon: "medkit", label: "Medical" },
    { id: "crime", icon: "warning", label: "Crime" },
    { id: "fire", icon: "flame", label: "Fire" },
    { id: "accident", icon: "car", label: "Accident" },
    { id: "other", icon: "ellipsis-horizontal", label: "Other" },
  ];

  const handleSubmitEmergency = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }
    if (!userProfile?.ward_id) {
      Alert.alert("Location Required", "Your account does not have a ward assigned. Please update your profile in Settings.", [
        { text: "Go to Settings", onPress: () => router.push("/(tabs)/settings") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }
    if (!description.trim()) {
      Alert.alert("Description Required", "Please describe your emergency.");
      return;
    }
    if (!selectedPinpoint) {
      Alert.alert("Location Required", "Please save a PinPoint address first so Community Protection Services can find you.", [
        { text: "Go to PinPoint", onPress: () => router.push("/(tabs)/pinpoint") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }
    setSubmitting(true);
    try {
      await insertRow("emergencyRequests", {
        userId: user.id,
        userName: user.user_metadata?.full_name || "Anonymous",
        userPhone: user.phone || contactDetails,
        emergencyType,
        description: description.trim(),
        contactDetails: contactDetails || user.phone || "Not provided",
        location: {
          latitude: selectedPinpoint.latitude,
          longitude: selectedPinpoint.longitude,
          mapsUrl: selectedPinpoint.mapsUrl,
          digitalAddress: selectedPinpoint.digitalAddress,
          label: selectedPinpoint.label
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        ward_id: userProfile.ward_id,
        suburb_id: userProfile?.suburb_id || null
      });
      Alert.alert("Emergency Request Sent", "Help is on the way. Community Protection Services have been notified.", [
        {
          text: "OK",
          onPress: async () => {
            setDescription("");
            setEmergencyType("medical");
            setContactDetails("");
            await loadUserEmergencies(user);
          }
        }
      ]);
    } catch (error) {
      console.error("Emergency submission error:", error);
      Alert.alert("Error", "Failed to send emergency request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (date) => {
    if (!date) return "Just now";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <ScreenHeader title="Emergency Request" subtitle={userProfile?.ward_number ? `Ward ${userProfile.ward_number}` : "Your location will be shared"} icon="alert-circle" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 9 }} numberOfLines={1}>Type of Emergency</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 17 }}>
            {emergencyTypes.map((type) => {
              const selected = emergencyType === type.id;
              return (
                <TouchableOpacity key={type.id} onPress={() => setEmergencyType(type.id)} style={{ width: "48%", marginRight: type.id === "medical" || type.id === "crime" ? "2%" : 0, marginBottom: 7, minHeight: 52, paddingHorizontal: 10, borderRadius: 12, backgroundColor: selected ? colors.accent : colors.surface, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={type.icon} size={19} color={selected ? colors.textInverse : colors.accent} style={{ marginRight: 7 }} />
                  <Text style={{ color: selected ? colors.textInverse : colors.text, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 }} numberOfLines={1}>Description</Text>
          <TextInput style={{ backgroundColor: colors.inputBackground || colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 15, borderWidth: 1, borderColor: colors.inputBorder || colors.border, minHeight: 92, textAlignVertical: "top", color: colors.text }} placeholder="Describe your emergency..." placeholderTextColor={colors.inputPlaceholder || colors.textLight} selectionColor={colors.accent} multiline value={description} onChangeText={setDescription} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 }} numberOfLines={1}>Contact Details</Text>
          <TextInput style={{ backgroundColor: colors.inputBackground || colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 17, borderWidth: 1, borderColor: colors.inputBorder || colors.border, color: colors.text, height: 46 }} placeholder="Phone number for CPS to reach you" placeholderTextColor={colors.inputPlaceholder || colors.textLight} selectionColor={colors.accent} value={contactDetails} onChangeText={setContactDetails} keyboardType="phone-pad" />
          {loadingPinpoints ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 15, marginBottom: 17, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ color: colors.textLight, marginTop: 7, fontSize: 12 }} numberOfLines={1}>Loading your locations...</Text>
            </View>
          ) : savedPinpoints.length === 0 ? (
            <View style={{ backgroundColor: colors.errorLight || colors.surface, borderRadius: 12, padding: 14, marginBottom: 17, borderWidth: 1, borderColor: colors.error }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="location" size={20} color={colors.error} style={{ marginRight: 7 }} />
                <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>No PinPoint Address Found</Text>
              </View>
              <Text style={{ color: colors.textLight, marginTop: 6, lineHeight: 18 }}>Save a PinPoint address first so Community Protection Services can find you.</Text>
              <TouchableOpacity style={{ backgroundColor: colors.error, borderRadius: 9, paddingVertical: 10, marginTop: 10, alignItems: "center" }} onPress={() => router.push("/(tabs)/pinpoint")}>
                <Text style={{ color: colors.textInverse, fontWeight: "700" }} numberOfLines={1}>Go to PinPoint →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginBottom: 17 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 }} numberOfLines={1}>Your Location</Text>
              {savedPinpoints.map((pin) => {
                const selected = selectedPinpoint?.id === pin.id;
                return (
                  <TouchableOpacity key={pin.id} onPress={() => setSelectedPinpoint(pin)} style={{ backgroundColor: selected ? colors.accentLight : colors.surface, borderRadius: 12, padding: 12, marginBottom: 7, borderWidth: 1, borderColor: selected ? colors.accent : colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={19} color={colors.accent} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{pin.label || "Saved Location"}</Text>
                        <Text style={{ color: colors.accent, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{pin.digitalAddress || "Digital address unavailable"}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity style={{ backgroundColor: savedPinpoints.length === 0 ? colors.disabled || colors.textLight : colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 19, opacity: submitting ? 0.65 : 1 }} onPress={handleSubmitEmergency} disabled={submitting || savedPinpoints.length === 0}>
            {submitting ? <ActivityIndicator color={colors.textInverse} /> : <View style={{ flexDirection: "row", alignItems: "center" }}><Ionicons name="alert-circle" size={19} color={colors.textInverse} style={{ marginRight: 7 }} /><Text style={{ color: colors.textInverse, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>SEND EMERGENCY REQUEST</Text></View>}
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 9 }} numberOfLines={1}>Your Emergency History</Text>
          {userEmergencies.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="checkmark-circle" size={38} color={colors.accent} />
              <Text style={{ color: colors.textLight, marginTop: 7 }} numberOfLines={1}>No emergencies reported</Text>
            </View>
          ) : (
            userEmergencies.map((emergency) => {
              const isPending = emergency.status === "pending";
              const isInProgress = emergency.status === "in_progress";
              const statusColor = isPending ? colors.warning : isInProgress ? colors.accent : colors.success;
              const statusBackground = isPending ? colors.warningLight : isInProgress ? colors.accentLight : colors.successLight;
              const statusLabel = isPending ? "PENDING" : isInProgress ? "IN PROGRESS" : "COMPLETED";
              return (
                <View key={emergency.id} style={{ backgroundColor: colors.surface, borderRadius: 13, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: statusColor }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }} numberOfLines={1}>{emergency.emergencyType?.toUpperCase()}</Text>
                    <View style={{ backgroundColor: statusBackground, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginLeft: 8 }}>
                      <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }} numberOfLines={1}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textLight, marginTop: 6, lineHeight: 18 }}>{emergency.description}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                    {emergency.ward_id && <Text style={{ color: colors.accent, fontSize: 11, marginRight: 10 }} numberOfLines={1}>Ward {emergency.ward_id}</Text>}
                    <Text style={{ color: colors.textLight, fontSize: 11 }} numberOfLines={1}>{timeAgo(emergency.createdAt)}</Text>
                  </View>
                  {emergency.responderName && <Text style={{ color: colors.accent, fontSize: 11, marginTop: 5 }} numberOfLines={1}>Responder: {emergency.responderName}</Text>}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}