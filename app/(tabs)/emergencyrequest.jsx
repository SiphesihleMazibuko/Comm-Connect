import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getCurrentUser,
  getRows,
  getUserProfile,
  insertRow
} from "../../config/supabase";
import colors from "../../Utils/colors";

export default function EmergencyRequestScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const [emergencyType, setEmergencyType] = useState("medical");
  const [description, setDescription] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userEmergencies, setUserEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Location from PinPoint
  const [savedPinpoints, setSavedPinpoints] = useState([]);
  const [selectedPinpoint, setSelectedPinpoint] = useState(null);
  const [loadingPinpoints, setLoadingPinpoints] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);
        await loadUserPinpoints(currentUser);
        await loadUserEmergencies(currentUser);
      }

      setLoading(false);
    };

    load();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
  }, []);

  const loadUserPinpoints = async (currentUser) => {
    if (!currentUser) return;
    setLoadingPinpoints(true);
    try {
      const pins = await getRows("pinpoints", {
        eq: [{ column: "userId", value: currentUser.id }],
      });
      setSavedPinpoints(pins);
      if (pins.length > 0) {
        setSelectedPinpoint(pins[0]);
      }
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
        order: [{ column: "createdAt", ascending: false }],
      });
      setUserEmergencies(emergencies);
    } catch (error) {
      console.error("Error loading emergencies:", error);
    }
  };

  const emergencyTypes = [
    { id: "medical", label: "🚑 Medical", color: "#DC2626" },
    { id: "crime", label: "🚨 Crime", color: "#B91C1C" },
    { id: "fire", label: "🔥 Fire", color: "#EA580C" },
    { id: "accident", label: "🚗 Accident", color: "#D97706" },
    { id: "other", label: "📝 Other", color: "#6B7280" },
  ];

  const handleSubmitEmergency = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in");
      return;
    }

    // Check if user has ward assigned
    if (!userProfile?.ward_id) {
      Alert.alert(
        "Location Required",
        "Your account does not have a ward assigned. Please update your profile in Settings.",
        [
          {
            text: "Go to Settings",
            onPress: () => router.push("/(tabs)/settings"),
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      );
      return;
    }

    if (!description.trim()) {
      Alert.alert("Error", "Please describe your emergency");
      return;
    }

    if (!selectedPinpoint) {
      Alert.alert(
        "No Location Selected",
        "Please save a PinPoint address first so responders can find you.",
        [
          {
            text: "Go to PinPoint",
            onPress: () => router.push("/(tabs)/pinpoint"),
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      );
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
          label: selectedPinpoint.label,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        // ─── KEY: Include ward_id and suburb_id ──────────────────
        ward_id: userProfile?.ward_id || null,
        suburb_id: userProfile?.suburb_id || null,
      });

      Alert.alert(
        "Emergency Request Sent",
        "Help is on the way. Emergency responders have been notified.",
        [
          {
            text: "OK",
            onPress: () => {
              setDescription("");
              setEmergencyType("medical");
              setContactDetails("");
              loadUserEmergencies(user);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Emergency submission error:", error);
      Alert.alert(
        "Error",
        "Failed to send emergency request. Please try again.",
      );
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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.error,
            padding: 24,
            alignItems: "center",
          }}
        >
          <Ionicons name="alert-circle" size={50} color="#fff" />
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#fff",
              marginTop: 10,
            }}
          >
            Emergency Request
          </Text>
          <Text style={{ fontSize: 14, color: "#fff", opacity: 0.8 }}>
            {userProfile?.ward_number
              ? `Ward ${userProfile.ward_number}`
              : "Your location will be shared"}
          </Text>
        </View>

        <View style={{ padding: 16 }}>
          {/* Emergency Type */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Type of Emergency
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 24,
            }}
          >
            {emergencyTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={{
                  flex: 1,
                  minWidth: "30%",
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor:
                    emergencyType === type.id ? type.color : colors.surface,
                  borderWidth: 2,
                  borderColor:
                    emergencyType === type.id ? type.color : colors.border,
                  alignItems: "center",
                }}
                onPress={() => setEmergencyType(type.id)}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>
                  {type.label.split(" ")[0]}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: emergencyType === type.id ? "#fff" : colors.text,
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Description
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 100,
              textAlignVertical: "top",
              color: colors.text,
            }}
            placeholder="Describe your emergency..."
            placeholderTextColor={colors.textLight}
            selectionColor={colors.accent}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Contact Details */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Contact Details
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 12,
              padding: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
            }}
            placeholder="Phone number for responders to reach you"
            placeholderTextColor={colors.textLight}
            selectionColor={colors.accent}
            value={contactDetails}
            onChangeText={setContactDetails}
            keyboardType="phone-pad"
          />

          {/* Location */}
          {loadingPinpoints ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ color: colors.textLight, marginTop: 8 }}>
                Loading your locations...
              </Text>
            </View>
          ) : savedPinpoints.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.error + "15",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <Text style={{ color: colors.error, fontWeight: "bold" }}>
                ⚠️ No PinPoint Address Found
              </Text>
              <Text style={{ color: colors.textLight, marginTop: 8 }}>
                Save a PinPoint address first so responders can find you.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.error,
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 12,
                  alignItems: "center",
                }}
                onPress={() => router.push("/(tabs)/pinpoint")}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Go to PinPoint →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                📍 Your Location
              </Text>
              {savedPinpoints.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  onPress={() => setSelectedPinpoint(pin)}
                  style={{
                    backgroundColor:
                      selectedPinpoint?.id === pin.id
                        ? colors.accent + "15"
                        : colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor:
                      selectedPinpoint?.id === pin.id
                        ? colors.accent
                        : colors.border,
                  }}
                >
                  <Text style={{ fontWeight: "bold", color: colors.text }}>
                    {pin.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.accent }}>
                    {pin.digitalAddress}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor:
                savedPinpoints.length === 0 ? colors.border : colors.error,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginBottom: 24,
              opacity: submitting ? 0.7 : 1,
            }}
            onPress={handleSubmitEmergency}
            disabled={submitting || savedPinpoints.length === 0}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                🚨 SEND EMERGENCY REQUEST
              </Text>
            )}
          </TouchableOpacity>

          {/* Emergency History */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Your Emergency History
          </Text>
          {userEmergencies.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 30,
                alignItems: "center",
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={40}
                color={colors.textLight}
              />
              <Text style={{ color: colors.textLight, marginTop: 8 }}>
                No emergencies reported
              </Text>
            </View>
          ) : (
            userEmergencies.map((emergency) => (
              <View
                key={emergency.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor:
                    emergency.status === "pending"
                      ? colors.warning
                      : emergency.status === "in_progress"
                        ? colors.accent
                        : colors.success,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "bold", color: colors.text }}>
                    {emergency.emergencyType?.toUpperCase()}
                  </Text>
                  <View
                    style={{
                      backgroundColor:
                        emergency.status === "pending"
                          ? colors.warning + "20"
                          : emergency.status === "in_progress"
                            ? colors.accent + "20"
                            : colors.success + "20",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          emergency.status === "pending"
                            ? colors.warning
                            : emergency.status === "in_progress"
                              ? colors.accent
                              : colors.success,
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    >
                      {emergency.status === "pending"
                        ? "PENDING"
                        : emergency.status === "in_progress"
                          ? "IN PROGRESS"
                          : "COMPLETED"}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.textLight, marginTop: 8 }}>
                  {emergency.description}
                </Text>
                {emergency.ward_id && (
                  <Text
                    style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}
                  >
                    Ward {emergency.ward_id}
                  </Text>
                )}
                <Text
                  style={{
                    color: colors.textLight,
                    fontSize: 11,
                    marginTop: 8,
                  }}
                >
                  {timeAgo(emergency.createdAt)}
                </Text>
                {emergency.responderName && (
                  <Text
                    style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}
                  >
                    Responder: {emergency.responderName}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
