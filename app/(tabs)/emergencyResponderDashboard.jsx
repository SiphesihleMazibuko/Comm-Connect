import {
  Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect,
  useRef,
  useState } from 'react';
import { ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  ScrollView,
  Text,
  View,
  Vibration
} from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getRows, getUserProfile, subscribeToTable, updateRow } from '../../config/supabase';
import colors from '../../Utils/colors';

const SERVICE_CONFIG = {
  community_protection_service: { label: 'Community Protection Services', icon: 'radio', color: '#5bc0be', bg: '#1c2541', gradient: ['#0b132b', '#3a506b'] },
  police: { label: 'Community Protection Services', icon: 'radio', color: '#5bc0be', bg: '#1c2541', gradient: ['#0b132b', '#3a506b'] },
};

const STATUS_CONFIG = {
  pending: { label: 'New Dispatch', color: '#ffffff', bg: '#3a506b' },
  en_route: { label: 'En Route', color: '#5bc0be', bg: '#1c2541' },
  on_scene: { label: 'On Scene', color: '#5bc0be', bg: '#3a506b' },
  resolved: { label: 'Resolved', color: '#5bc0be', bg: '#1c2541' },
};

const getDispatchCoordinates = (dispatch) => {
  const latitude = Number(dispatch?.location?.latitude);
  const longitude = Number(dispatch?.location?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
};

const getDirectionsUrl = (dispatch) => {
  const coordinates = getDispatchCoordinates(dispatch);
  if (!coordinates) return dispatch?.location?.mapsUrl || null;

  return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}&travelmode=driving`;
};

export default function ResponderDashboardScreen() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responderServiceType, setResponderServiceType] = useState('community_protection_service');
  const [profile, setProfile] = useState(null);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [user, setUser] = useState(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadResponderProfile();
  }, []);


  useEffect(() => {
    if (!responderServiceType || !profile) return;
    const unsubscribe = subscribeToDispatches(responderServiceType, profile);
    return () => unsubscribe && unsubscribe();
  }, [responderServiceType, profile]);

  useEffect(() => {
    const hasPending = dispatches.some(d => d.status === 'pending');
    if (hasPending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [dispatches, pulseAnim]);

  const loadResponderProfile = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const data = currentUser ? await getUserProfile(currentUser.id) : null;
      setProfile(data);
      setResponderServiceType('community_protection_service');
    } catch (e) {
      console.error('Failed to load responder profile', e);
      setResponderServiceType('community_protection_service'); 
    }
  };

  const subscribeToDispatches = (serviceType, userProfile) => {
    const loadDispatches = async () => {
      try {
        const filters = { serviceType };
        if (userProfile?.ward_id) filters.ward_id = userProfile.ward_id;

        const data = await getRows('emergency_dispatches', {
          filters,
          neq: [{ column: 'status', value: 'resolved' }],
          order: [
            { column: 'status', ascending: true },
            { column: 'dispatchedAt', ascending: false },
          ],
        });

        const newPending = data.filter(d => d.status === 'pending' && !d.acknowledged);
        if (newPending.length > 0) {
          Vibration.vibrate([0, 400, 200, 400]);
        }

        setDispatches(data);
      } catch (err) {
      console.error('Dispatch listener error:', err);
      } finally {
      setLoading(false);
      }
    };

    loadDispatches();
    return subscribeToTable('emergency_dispatches', loadDispatches);
  };

  const updateDispatchStatus = async (dispatchId, newStatus) => {
    setUpdatingId(dispatchId);
    try {
      await updateRow('emergency_dispatches', dispatchId, {
        status: newStatus,
        acknowledged: true,
        [`${newStatus}At`]: new Date().toISOString(),
        responderId: user?.id,
      });
      setDispatches(prev =>
        prev.map(d => d.id === dispatchId ? { ...d, status: newStatus, acknowledged: true } : d)
      );
      if (selectedDispatch?.id === dispatchId) {
        setSelectedDispatch(prev => ({ ...prev, status: newStatus, acknowledged: true }));
      }
    } catch (e) {
      console.error('Error updating dispatch status:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const openDispatchDirections = (dispatch) => {
    const directionsUrl = getDirectionsUrl(dispatch);

    if (!directionsUrl) {
      Alert.alert('Location Unavailable', 'This incident does not have a location attached.');
      return;
    }

    const coordinates = getDispatchCoordinates(dispatch);
    const locationLabel = coordinates
      ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
      : 'the incident location';

    Alert.alert(
      'Open Directions',
      `Open directions to ${locationLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Maps',
          onPress: async () => {
            try {
              await Linking.openURL(directionsUrl);
            } catch (error) {
              console.error('Could not open directions:', error);
              Alert.alert('Directions Error', 'Could not open maps on this device.');
            }
          },
        },
      ],
    );
  };

  const serviceConfig = SERVICE_CONFIG[responderServiceType] || SERVICE_CONFIG.community_protection_service;
  const pendingCount = dispatches.filter(d => d.status === 'pending').length;
  const wardLabel = profile?.wardName || profile?.ward_name || profile?.permissions?.manualWardNumber || profile?.ward_number || profile?.ward_id;

  const nextStatusAction = (currentStatus) => {
    switch (currentStatus) {
      case 'pending':  return { label: 'Mark En Route', next: 'en_route',  color: '#5bc0be' };
      case 'en_route': return { label: 'Mark On Scene',  next: 'on_scene',  color: '#3a506b' };
      case 'on_scene': return { label: 'Mark Resolved',  next: 'resolved',  color: '#5bc0be' };
      default: return null;
    }
  };

  const DispatchCard = ({ dispatch }) => {
    const statusCfg = STATUS_CONFIG[dispatch.status] || STATUS_CONFIG.pending;
    const isNew = dispatch.status === 'pending' && !dispatch.acknowledged;
    const action = nextStatusAction(dispatch.status);
    const isUpdating = updatingId === dispatch.id;

    return (
      <TouchableOpacity
        onPress={() => { setSelectedDispatch(dispatch); setDetailVisible(true); }}
        activeOpacity={0.85}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
          borderLeftWidth: 5,
          borderLeftColor: serviceConfig.color,
          elevation: isNew ? 6 : 2,
          shadowColor: isNew ? serviceConfig.color : '#000',
          shadowOpacity: isNew ? 0.2 : 0.06,
          shadowRadius: isNew ? 8 : 3,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isNew && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3a506b' }} />
              </Animated.View>
            )}
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, textTransform: 'capitalize' }}>
              {dispatch.reportType || 'Incident'} Report
            </Text>
          </View>

          <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: statusCfg.color }}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* ✅ ADD WARD ID DISPLAY */}
        {dispatch.ward_id && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <Ionicons name="location" size={12} color={colors.accent} />
            <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>
              Ward {dispatch.ward_id}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>
          {dispatch.description}
        </Text>

        {getDirectionsUrl(dispatch) && (
          <TouchableOpacity
            onPress={() => openDispatchDirections(dispatch)}
            style={{
              backgroundColor: colors.accentSoft,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.accent,
            }}
          >
            <Ionicons name="navigate" size={16} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 13 }}>Get Directions</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: colors.textLight }}>
            {dispatch.dispatchedAt ? new Date(dispatch.dispatchedAt).toLocaleTimeString() : 'Just now'}
          </Text>

          {action && (
            <TouchableOpacity
              onPress={() => updateDispatchStatus(dispatch.id, action.next)}
              disabled={isUpdating}
              style={{
                backgroundColor: action.color,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: isUpdating ? 0.6 : 1,
              }}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="arrow-forward-circle" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{action.label}</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textLight, marginTop: 12 }}>Connecting to CPS dispatch...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView showsVerticalScrollIndicator={false}>

          <LinearGradient
            colors={serviceConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 13, color: '#fff', opacity: 0.8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  CPS Responder Queue
                </Text>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#fff' }}>{serviceConfig.label}</Text>
                <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 6 }}>
                  {wardLabel ? `Ward ${wardLabel}` : 'No ward assigned'}
                </Text>
                <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 6 }}>
                  {dispatches.length === 0
                    ? 'No active incidents'
                    : `${dispatches.length} active · ${pendingCount} new`}
                </Text>
              </View>

              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={serviceConfig.icon} size={34} color="#fff" />
                </View>
                {pendingCount > 0 && (
                  <Animated.View style={{ transform: [{ scale: pulseAnim }], backgroundColor: '#3a506b', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{pendingCount} NEW</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </LinearGradient>

          <View style={{ padding: 16, paddingTop: 20 }}>
            {dispatches.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="checkmark-circle-outline" size={64} color={colors.textLight} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>All Clear</Text>
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
                  No active CPS incidents. You&apos;ll be alerted when your community leader dispatches a ward incident.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                  Active CPS Dispatches
                </Text>
                {dispatches.map((dispatch) => (
                  <DispatchCard key={dispatch.id} dispatch={dispatch} />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <Modal visible={detailVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '85%' }}>

            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>Dispatch Details</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {selectedDispatch && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const sCfg = STATUS_CONFIG[selectedDispatch.status] || STATUS_CONFIG.pending;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      <View style={{ backgroundColor: sCfg.bg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ color: sCfg.color, fontWeight: 'bold' }}>{sCfg.label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textLight }}>
                        Dispatched {selectedDispatch.dispatchedAt ? new Date(selectedDispatch.dispatchedAt).toLocaleString() : '—'}
                      </Text>
                    </View>
                  );
                })()}

                {/* ✅ ADD WARD ID TO MODAL */}
                {selectedDispatch.ward_id && (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                      Ward
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.text }}>Ward {selectedDispatch.ward_id}</Text>
                  </View>
                )}

                <DetailRow label="Incident Type" value={selectedDispatch.reportType?.toUpperCase() || '—'} />
                <DetailRow label="Description" value={selectedDispatch.description || '—'} />
                <DetailRow
                  label="Location"
                  value={
                    selectedDispatch.location?.latitude
                      ? `${selectedDispatch.location.latitude}, ${selectedDispatch.location.longitude}`
                      : 'Location not provided'
                  }
                />

                {getDirectionsUrl(selectedDispatch) && (
                  <TouchableOpacity
                    onPress={() => openDispatchDirections(selectedDispatch)}
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 14,
                      padding: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 10,
                      marginBottom: 18,
                    }}
                  >
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>Open Directions</Text>
                  </TouchableOpacity>
                )}

                {(() => {
                  const action = nextStatusAction(selectedDispatch.status);
                  const isUpdating = updatingId === selectedDispatch.id;
                  if (!action) return (
                    <View style={{ backgroundColor: '#1c2541', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 }}>
                      <Ionicons name="checkmark-circle" size={28} color="#5bc0be" />
                      <Text style={{ color: '#5bc0be', fontWeight: 'bold', marginTop: 6 }}>Dispatch Resolved</Text>
                    </View>
                  );
                  return (
                    <TouchableOpacity
                      onPress={() => updateDispatchStatus(selectedDispatch.id, action.next)}
                      disabled={isUpdating}
                      style={{
                        backgroundColor: action.color,
                        borderRadius: 16,
                        padding: 16,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 10,
                        marginTop: 24,
                        opacity: isUpdating ? 0.6 : 1,
                      }}
                    >
                      {isUpdating
                        ? <ActivityIndicator color="#fff" />
                        : <>
                            <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{action.label}</Text>
                          </>
                      }
                    </TouchableOpacity>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}

