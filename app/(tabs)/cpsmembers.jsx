import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TouchableOpacity from "../../components/FeedbackTouchableOpacity";
import ScreenHeader from "../../components/ScreenHeader";
import { getCurrentUser, getRows, getUserProfile, insertRow, isMissingSchemaRelation, subscribeToTable, updateRow } from "../../config/supabase";
import { useTheme } from "../context/ThemeContext";

const isOpenDutySession = (session) => !session.clockedOffAt;

const getDisplayName = (profile) => {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return name || profile?.email || profile?.phoneNumber || "CPS Member";
};

export default function CpsMembersScreen() {
  const { colors } = useTheme();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dutyTableReady, setDutyTableReady] = useState(true);

  const wardLabel = profile?.wardName || profile?.ward_name || profile?.permissions?.manualWardNumber || profile?.ward_number || profile?.ward_id;
  const onDutyMembers = sessions.filter(isOpenDutySession);

  useEffect(() => {
    loadDutyData();
  }, []);

  useEffect(() => {
    if (!profile?.ward_id || !dutyTableReady) return undefined;
    return subscribeToTable("cps_duty_sessions", loadDutyData);
  }, [profile?.ward_id, dutyTableReady]);

  const loadDutyData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const currentProfile = currentUser ? await getUserProfile(currentUser.id) : null;
      setProfile(currentProfile);
      if (!currentProfile?.ward_id) {
        setSessions([]);
        setActiveSession(null);
        return;
      }
      const dutySessions = await getRows("cps_duty_sessions", {
        filters: { ward_id: currentProfile.ward_id },
        order: [{ column: "clockedInAt", ascending: false }],
        allowMissingTable: true,
        onMissingTable: () => setDutyTableReady(false)
      });
      const activeSessions = (dutySessions || []).filter(isOpenDutySession);
      setSessions(activeSessions);
      setActiveSession(activeSessions.find((session) => session.userId === currentUser?.id) || null);
    } catch (error) {
      if (isMissingSchemaRelation(error)) {
        setDutyTableReady(false);
        return;
      }
      console.error("Error loading CPS duty sessions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDutyData();
  };

  const handleClockIn = async () => {
    if (!user || !profile) return;
    if (!profile.ward_id) {
      Alert.alert("Ward Required", "Your CPS profile needs a ward before you can clock in.");
      return;
    }
    if (!dutyTableReady) {
      Alert.alert("Database Setup Required", "The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen.");
      return;
    }
    setUpdating(true);
    try {
      const now = new Date().toISOString();
      await insertRow("cps_duty_sessions", {
        userId: user.id,
        memberName: getDisplayName(profile),
        ward_id: profile.ward_id,
        wardName: wardLabel || null,
        clockedInAt: now,
        clockedOffAt: null,
        status: "on_duty"
      });
      await loadDutyData();
    } catch (error) {
      if (isMissingSchemaRelation(error)) {
        setDutyTableReady(false);
        Alert.alert("Database Setup Required", "The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen.");
        return;
      }
      console.error("Error clocking in:", error);
      Alert.alert("Clock In Failed", "Could not clock you in. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleClockOff = async () => {
    if (!activeSession?.id) return;
    setUpdating(true);
    try {
      await updateRow("cps_duty_sessions", activeSession.id, {
        clockedOffAt: new Date().toISOString(),
        status: "off_duty"
      });
      await loadDutyData();
    } catch (error) {
      if (isMissingSchemaRelation(error)) {
        setDutyTableReady(false);
        Alert.alert("Database Setup Required", "The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen.");
        return;
      }
      console.error("Error clocking off:", error);
      Alert.alert("Clock Off Failed", "Could not clock you off. Please try again.");
    } finally {
      setUpdating(false);
    }
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
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}>
        <ScreenHeader title="CPS On Duty" subtitle={wardLabel ? `Ward ${wardLabel}` : "No ward assigned"} meta={`${onDutyMembers.length} member${onDutyMembers.length === 1 ? "" : "s"} on duty`} icon="people-circle" />
        <View style={{ padding: 16 }}>
          {!dutyTableReady && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.warning || colors.border, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="construct" size={20} color={colors.warning || colors.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Database setup required</Text>
              </View>
              <Text style={{ color: colors.textLight, lineHeight: 19 }}>The CPS duty table is not available yet. Run the updated Supabase schema and refresh this screen.</Text>
            </View>
          )}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: activeSession ? colors.accentLight : colors.surfaceLight, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name={activeSession ? "radio" : "radio-outline"} size={24} color={activeSession ? colors.accent : colors.textLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{activeSession ? "You are on duty" : "You are off duty"}</Text>
                <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{activeSession?.clockedInAt ? `Clocked in ${new Date(activeSession.clockedInAt).toLocaleTimeString()}` : "Clock in when your shift starts"}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={activeSession ? handleClockOff : handleClockIn} disabled={updating || !profile?.ward_id || !dutyTableReady} style={{ backgroundColor: activeSession ? colors.error : colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: updating || !profile?.ward_id || !dutyTableReady ? 0.6 : 1 }}>
              {updating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{activeSession ? "Clock Off" : "Clock In"}</Text>}
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textLight, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 10 }}>Members On Duty</Text>
          {onDutyMembers.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 26, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="moon-outline" size={40} color={colors.textLight} />
              <Text style={{ color: colors.text, fontWeight: "700", marginTop: 10 }}>No members clocked in</Text>
              <Text style={{ color: colors.textLight, textAlign: "center", marginTop: 5, lineHeight: 19 }}>Clock in to show other CPS members that you are available in this ward.</Text>
            </View>
          ) : (
            onDutyMembers.map((session) => (
              <View key={session.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: session.userId === user?.id ? colors.accent : colors.border, marginBottom: 9, flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center", marginRight: 11 }}>
                  <Ionicons name="person" size={19} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{session.memberName || "CPS Member"}{session.userId === user?.id ? " (You)" : ""}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }} numberOfLines={1}>Since {session.clockedInAt ? new Date(session.clockedInAt).toLocaleTimeString() : "recently"}</Text>
                </View>
                <View style={{ backgroundColor: colors.accentLight, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8 }}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "700" }}>ON DUTY</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}