import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TouchableOpacity from "../../components/FeedbackTouchableOpacity";
import ScreenHeader from "../../components/ScreenHeader";
import WalkMapPreview from "../../components/WalkMapPreview";
import { getCurrentUser, getRows, getSupabaseClient, getUserProfile, insertRow, isMissingSchemaRelation, subscribeToTable, updateRow } from "../../config/supabase";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

const isOpenDutySession = (session) => !session.clockedOffAt;

const getDisplayName = (profile) => {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return name || profile?.email || profile?.phoneNumber || "CPS Member";
};

function WalkRouteMap({ walk, colors }) {
  return <WalkMapPreview mode="route" start={{ latitude: walk.start_latitude, longitude: walk.start_longitude }} destination={{ latitude: walk.destination_latitude, longitude: walk.destination_longitude }} colors={colors}/>;
}

export default function CpsMembersScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wardMembers, setWardMembers] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dutyTableReady, setDutyTableReady] = useState(true);
  const [walkRequests, setWalkRequests] = useState([]);
  const [walkBusyId, setWalkBusyId] = useState(null);
  const [cancelWalkId, setCancelWalkId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [trackingState, setTrackingState] = useState('idle');

  const wardLabel = profile?.wardName || profile?.ward_name || profile?.permissions?.manualWardNumber || profile?.ward_number || profile?.ward_id;

  async function loadDutyData() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const currentProfile = currentUser ? await getUserProfile(currentUser.id) : null;
      setProfile(currentProfile);
      if (!currentProfile?.ward_id) {
        setWardMembers([]);
        setActiveSession(null);
        return;
      }
      const client = getSupabaseClient();
      const [{ data: memberProfiles, error: memberProfilesError }, dutySessions] = await Promise.all([
        client.from("users")
          .select('id,"firstName","lastName",role,ward_id')
          .eq("ward_id", currentProfile.ward_id)
          .in("role", ["community_protection_service", "emergency_responder"])
          .order("firstName", { ascending: true }),
        getRows("cps_duty_sessions", {
          filters: { ward_id: currentProfile.ward_id },
          order: [{ column: "clockedInAt", ascending: false }],
          allowMissingTable: true,
          onMissingTable: () => setDutyTableReady(false)
        }),
      ]);
      if (memberProfilesError) throw memberProfilesError;

      const latestSessionByMember = new Map();
      [...(dutySessions || [])]
        .sort((left, right) => new Date(right.clockedInAt || 0) - new Date(left.clockedInAt || 0))
        .forEach((session) => {
          if (session.userId && !latestSessionByMember.has(session.userId)) {
            latestSessionByMember.set(session.userId, session);
          }
        });

      const members = (memberProfiles || []).map((member) => {
        const latestSession = latestSessionByMember.get(member.id) || null;
        return {
          ...member,
          userId: member.id,
          memberName: getDisplayName(member),
          session: latestSession,
          onDuty: Boolean(latestSession && isOpenDutySession(latestSession)),
        };
      });
      setWardMembers(members);
      setActiveSession(members.find((member) => member.userId === currentUser?.id && member.onDuty)?.session || null);
      const requests = await getRows("walk_requests", { order: [{ column: "created_at", ascending: false }] });
      setWalkRequests((requests || []).filter((row) => row.status === "pending" || row.assigned_member_id === currentUser?.id));
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
  }

  useEffect(() => {
    Promise.resolve().then(loadDutyData);
  }, []);

  useEffect(() => {
    if (!profile?.ward_id || !dutyTableReady) return undefined;
    return subscribeToTable("cps_duty_sessions", loadDutyData);
  }, [profile?.ward_id, dutyTableReady]);

  useEffect(() => {
    if (!profile?.ward_id) return undefined;
    return subscribeToTable("users", loadDutyData);
  }, [profile?.ward_id]);

  useEffect(() => subscribeToTable("walk_requests", loadDutyData), [profile?.ward_id]);

  const activeWalk = walkRequests.find((walk) => walk.assigned_member_id === user?.id && walk.status === "in_progress");
  const trackingWalkId = activeWalk?.id;
  useEffect(() => {
    if (!trackingWalkId) return undefined;
    let disposed = false;
    let lastSentAt = 0;
    let watcher;
    const begin = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') { setTrackingState('permission_denied'); return; }
        if (disposed) return;
        watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 }, async (position) => {
          if (Date.now() - lastSentAt < 15000) return;
          lastSentAt = Date.now();
          try {
            const { error } = await getSupabaseClient().rpc('update_walk_location', { p_walk_id: trackingWalkId, p_latitude: position.coords.latitude, p_longitude: position.coords.longitude, p_accuracy: position.coords.accuracy });
            if (error) throw error;
            setTrackingState('active');
          } catch (error) { console.warn('Walk location update failed:', error?.message); setTrackingState('unavailable'); }
        });
        if (!disposed) setTrackingState('waiting');
      } catch { if (!disposed) setTrackingState('unavailable'); }
    };
    begin();
    return () => { disposed = true; watcher?.remove(); };
  }, [trackingWalkId]);

  const respondToWalk = async (walk, accept) => {
    setWalkBusyId(walk.id);
    try {
      const { error } = await getSupabaseClient().rpc('respond_to_walk', { p_walk_id: walk.id, p_accept: accept });
      if (error) throw error;
      await loadDutyData();
    } catch (error) { Alert.alert(accept ? "Could not accept" : "Could not decline", error?.message || "Refresh the request and try again."); await loadDutyData(); }
    finally { setWalkBusyId(null); }
  };

  const updateWalkStatus = async (walk, status, reason = null) => {
    setWalkBusyId(walk.id);
    try {
      const { error } = await getSupabaseClient().rpc('transition_walk', { p_walk_id: walk.id, p_status: status, p_reason: reason });
      if (error) throw error;
      setCancelWalkId(null); setCancelReason("");
      await loadDutyData();
    } catch (error) { Alert.alert("Walk update failed", error?.message || "Please try again."); }
    finally { setWalkBusyId(null); }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDutyData();
  };

  const handleClockIn = async () => {
    if (!user || !profile) return;
    if (!profile.ward_id) {
      Alert.alert(t("Ward Required"), t("Your CPS profile needs a ward before you can clock in."));
      return;
    }
    if (!dutyTableReady) {
      Alert.alert(t("Database Setup Required"), t("The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen."));
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
        Alert.alert(t("Database Setup Required"), t("The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen."));
        return;
      }
      console.error("Error clocking in:", error);
      Alert.alert(t("Clock In Failed"), t("Could not clock you in. Please try again."));
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
        Alert.alert(t("Database Setup Required"), t("The CPS duty table has not been created in Supabase yet. Run the updated schema.sql, then refresh this screen."));
        return;
      }
      console.error("Error clocking off:", error);
      Alert.alert(t("Clock Off Failed"), t("Could not clock you off. Please try again."));
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
        <ScreenHeader title={t("CPS On Duty")} subtitle={wardLabel ? `${t("Ward")} ${wardLabel}` : t("No ward assigned")} meta={t("{{count}} CPF members", { count: wardMembers.length })} icon="people-circle" />
        <View style={{ padding: 16 }}>
          {!dutyTableReady && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.warning || colors.border, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="construct" size={20} color={colors.warning || colors.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("Database setup required")}</Text>
              </View>
              <Text style={{ color: colors.textLight, lineHeight: 19 }}>{t("The CPS duty table is not available yet. Run the updated Supabase schema and refresh this screen.")}</Text>
            </View>
          )}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: activeSession ? colors.accentLight : colors.surfaceLight, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name={activeSession ? "radio" : "radio-outline"} size={24} color={activeSession ? colors.accent : colors.textLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{activeSession ? t("You are on duty") : t("You are off duty")}</Text>
                <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{activeSession?.clockedInAt ? `${t("Clocked in")} ${new Date(activeSession.clockedInAt).toLocaleTimeString()}` : t("Clock in when your shift starts")}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={activeSession ? handleClockOff : handleClockIn} disabled={updating || !profile?.ward_id || !dutyTableReady} style={{ backgroundColor: activeSession ? colors.error : colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: updating || !profile?.ward_id || !dutyTableReady ? 0.6 : 1 }}>
              {updating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{activeSession ? t("Clock Off") : t("Clock In")}</Text>}
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textLight, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 10 }}>{t("CPF Members in Your Ward")}</Text>
          {wardMembers.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 26, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="moon-outline" size={40} color={colors.textLight} />
              <Text style={{ color: colors.text, fontWeight: "700", marginTop: 10 }}>{t("No CPF members found for this ward")}</Text>
            </View>
          ) : (
            wardMembers.map((member) => (
              <View key={member.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: member.userId === user?.id ? colors.accent : colors.border, marginBottom: 9, flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: member.onDuty ? colors.accentLight : colors.surfaceLight, alignItems: "center", justifyContent: "center", marginRight: 11 }}>
                  <Ionicons name="person" size={19} color={member.onDuty ? colors.accent : colors.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{member.memberName || t("CPS Member")}{member.userId === user?.id ? ` (${t("You")})` : ""}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{member.onDuty && member.session?.clockedInAt ? `${t("Since")} ${new Date(member.session.clockedInAt).toLocaleTimeString()}` : t("Not currently on duty")}</Text>
                </View>
                <View style={{ backgroundColor: member.onDuty ? colors.accentLight : colors.surfaceLight, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8 }}>
                  <Text style={{ color: member.onDuty ? colors.accent : colors.textLight, fontSize: 10, fontWeight: "700" }}>{member.onDuty ? t("ON DUTY") : t("OFF DUTY")}</Text>
                </View>
              </View>
            ))
          )}

          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 22, marginBottom: 10 }}>WalkWithMe requests</Text>
          {!activeSession && <Text style={{ color: colors.textLight, marginBottom: 10 }}>Clock in to receive and accept requests in your ward.</Text>}
          {walkRequests.length === 0 ? <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.textLight }}>No available WalkWithMe requests.</Text></View> : walkRequests.map((walk) => {
            const isAssigned = walk.assigned_member_id === user?.id;
            const statusText = ({ pending: "Waiting for a CPF member", accepted: "Accepted", member_on_way: "You are on the way", in_progress: "Walk in progress", completed: "Completed", cancelled: "Cancelled" })[walk.status] || walk.status;
            return <View key={walk.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
              <Text style={{ color: colors.accent, fontWeight: "800" }}>{statusText}</Text>
              <Text style={{ color: colors.text, marginTop: 8, fontWeight: "700" }}>From: {walk.start_label}</Text><Text style={{ color: colors.text, marginTop: 4 }}>To: {walk.destination_label}</Text>
              <WalkRouteMap walk={walk} colors={colors}/>
              <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 7 }}>Resident ward: {walk.resident_ward_id || "Assigned ward"}</Text>
              {!!walk.notes && <Text style={{ color: colors.textLight, marginTop: 7 }}>Notes: {walk.notes}</Text>}
              <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 6 }}>Resident contact details stay private. Use in-app SOS/emergency flows if urgent help is required.</Text>
              {walk.status === "in_progress" && isAssigned && <Text style={{ color: trackingState === 'active' ? colors.accent : colors.warning || colors.textLight, marginTop: 8, fontWeight: "700" }}>{trackingState === 'active' ? "Foreground live tracking active" : trackingState === 'permission_denied' ? "Location permission denied; tracking unavailable" : trackingState === 'unavailable' ? "Tracking unavailable; check connection and location settings" : "Starting foreground location tracking…"}</Text>}
              <View style={{ flexDirection: "row", gap: 7, marginTop: 12 }}>
                {walk.status === "pending" && <><TouchableOpacity disabled={walkBusyId === walk.id || !activeSession} onPress={() => respondToWalk(walk, true)} style={{ flex: 1, backgroundColor: activeSession ? colors.accent : colors.textLight, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>{walkBusyId === walk.id ? "Working…" : "Accept"}</Text></TouchableOpacity><TouchableOpacity disabled={walkBusyId === walk.id} onPress={() => respondToWalk(walk, false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: colors.text, fontWeight: "700" }}>Decline</Text></TouchableOpacity></>}
                {isAssigned && walk.status === "accepted" && <><TouchableOpacity onPress={() => updateWalkStatus(walk, "member_on_way")} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>On my way</Text></TouchableOpacity><TouchableOpacity onPress={() => updateWalkStatus(walk, "in_progress")} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>Start walk</Text></TouchableOpacity></>}
                {isAssigned && walk.status === "member_on_way" && <TouchableOpacity onPress={() => updateWalkStatus(walk, "in_progress")} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>Start walk</Text></TouchableOpacity>}
                {isAssigned && walk.status === "in_progress" && <TouchableOpacity onPress={() => updateWalkStatus(walk, "completed")} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>Complete walk</Text></TouchableOpacity>}
                {isAssigned && ["accepted", "member_on_way", "in_progress"].includes(walk.status) && <TouchableOpacity onPress={() => setCancelWalkId(cancelWalkId === walk.id ? null : walk.id)} style={{ flex: 1, borderWidth: 1, borderColor: colors.error, borderRadius: 9, padding: 11, alignItems: "center" }}><Text style={{ color: colors.error, fontWeight: "700" }}>Cancel walk</Text></TouchableOpacity>}
              </View>
              {cancelWalkId === walk.id && <View style={{ marginTop: 9 }}><Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 6 }}>Cancellation reason (optional)</Text><TextInput value={cancelReason} onChangeText={setCancelReason} placeholder="Add a short reason" placeholderTextColor={colors.textLight} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 10, color: colors.text }}/><TouchableOpacity disabled={walkBusyId === walk.id} onPress={() => updateWalkStatus(walk, "cancelled", cancelReason.trim() || null)} style={{ backgroundColor: colors.error, borderRadius: 9, padding: 11, alignItems: "center", marginTop: 7 }}><Text style={{ color: "#fff", fontWeight: "800" }}>Confirm cancellation</Text></TouchableOpacity></View>}
            </View>;
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
