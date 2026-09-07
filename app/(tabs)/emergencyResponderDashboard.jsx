import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Linking, Modal, ScrollView, Text, View, Vibration } from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getRows, getUserProfile, subscribeToTable, updateRow } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';

const SERVICE_CONFIG = {
  community_protection_service: { label: 'Community Protection Services', icon: 'radio' },
  police: { label: 'Community Protection Services', icon: 'radio' },
};

const STATUS_CONFIG = {
  pending: { label: 'New Dispatch', type: 'warning' },
  en_route: { label: 'En Route', type: 'info' },
  on_scene: { label: 'On Scene', type: 'primary' },
  resolved: { label: 'Resolved', type: 'success' },
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

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

const getSosLocation = (alert) => {
  const sosLocation = alert?.location || {};
  return sosLocation.currentLocation || sosLocation;
};

const getSosMapsUrl = (alert) => {
  const currentLocation = getSosLocation(alert);

  if (currentLocation?.mapsUrl) return currentLocation.mapsUrl;

  if (currentLocation?.latitude !== undefined && currentLocation?.longitude !== undefined) {
    const latitude = Number(currentLocation.latitude);
    const longitude = Number(currentLocation.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
  }

  return null;
};

function DetailRow({ label, value, colors }) {
  return (
    <View style={{ marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textLighter || colors.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

export default function ResponderDashboardScreen() {
  const { colors } = useTheme();

  const [dispatches, setDispatches] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('dispatches');

  const [loading, setLoading] = useState(true);
  const [responderServiceType, setResponderServiceType] = useState('community_protection_service');

  const [profile, setProfile] = useState(null);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [user, setUser] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadResponderProfile();
  }, []);

  useEffect(() => {
    if (!responderServiceType || !profile) return;
    const unsubscribe = subscribeToDispatches(responderServiceType, profile);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [responderServiceType, profile]);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToSosAlerts(profile);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [profile]);

  useEffect(() => {
    const hasPending = dispatches.some((dispatch) => dispatch.status === 'pending');

    if (hasPending) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }

    pulseAnim.setValue(1);
  }, [dispatches, pulseAnim]);

  const loadResponderProfile = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const data = currentUser ? await getUserProfile(currentUser.id) : null;
      setProfile(data);
      setResponderServiceType('community_protection_service');
    } catch (error) {
      console.error('Failed to load responder profile:', error);
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

        const newPending = data.filter((dispatch) => dispatch.status === 'pending' && !dispatch.acknowledged);

        if (newPending.length > 0) Vibration.vibrate([0, 400, 200, 400]);

        setDispatches(data);
      } catch (error) {
        console.error('Dispatch listener error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDispatches();
    return subscribeToTable('emergency_dispatches', loadDispatches);
  };

  const subscribeToSosAlerts = (userProfile) => {
    const loadSosAlerts = async () => {
      try {
        const filters = { emergencyType: 'sos', status: 'active' };
        if (userProfile?.ward_id) filters.ward_id = userProfile.ward_id;

        const data = await getRows('emergencyRequests', {
          filters,
          order: [{ column: 'createdAt', ascending: false }],
        });

        setSosAlerts(data || []);
      } catch (error) {
        console.error('SOS tracking listener error:', error);
      }
    };

    loadSosAlerts();
    return subscribeToTable('emergencyRequests', loadSosAlerts);
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

      setDispatches((previous) =>
        previous.map((dispatch) =>
          dispatch.id === dispatchId ? { ...dispatch, status: newStatus, acknowledged: true } : dispatch
        )
      );

      if (selectedDispatch?.id === dispatchId) {
        setSelectedDispatch((previous) => ({ ...previous, status: newStatus, acknowledged: true }));
      }
    } catch (error) {
      console.error('Error updating dispatch status:', error);
      Alert.alert('Update Failed', 'Could not update the dispatch status. Please try again.');
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
      ]
    );
  };

  const serviceConfig = SERVICE_CONFIG[responderServiceType] || SERVICE_CONFIG.community_protection_service;
  const pendingCount = dispatches.filter((dispatch) => dispatch.status === 'pending').length;
  const activeSosCount = sosAlerts.length;

  const wardLabel = profile?.wardName || profile?.ward_name || profile?.permissions?.manualWardNumber || profile?.ward_number || profile?.ward_id;

  const getStatusColors = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

    switch (config.type) {
      case 'success':
        return { background: colors.successLight || '#063B20', text: colors.success || '#00E676' };
      case 'warning':
        return { background: colors.warningLight || '#78350F', text: colors.warning || '#F59E0B' };
      case 'info':
        return { background: colors.infoLight || '#172554', text: colors.info || '#60A5FA' };
      case 'primary':
        return { background: colors.accentLight || '#1A2E1A', text: colors.primary || '#00E676' };
      default:
        return { background: colors.surfaceLight, text: colors.text };
    }
  };

  const nextStatusAction = (currentStatus) => {
    switch (currentStatus) {
      case 'pending':
        return { label: 'Mark En Route', next: 'en_route', color: colors.info || '#60A5FA' };
      case 'en_route':
        return { label: 'Mark On Scene', next: 'on_scene', color: colors.primary || '#00E676' };
      case 'on_scene':
        return { label: 'Mark Resolved', next: 'resolved', color: colors.success || '#00E676' };
      default:
        return null;
    }
  };

  const DispatchCard = ({ dispatch }) => {
    const statusCfg = STATUS_CONFIG[dispatch.status] || STATUS_CONFIG.pending;
    const statusColors = getStatusColors(dispatch.status);
    const isNew = dispatch.status === 'pending' && !dispatch.acknowledged;
    const action = nextStatusAction(dispatch.status);
    const isUpdating = updatingId === dispatch.id;

    return (
      <TouchableOpacity
        onPress={() => { setSelectedDispatch(dispatch); setDetailVisible(true); }}
        activeOpacity={0.88}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 17,
          marginBottom: 15,
          borderWidth: 1,
          borderColor: isNew ? 'rgba(0,230,118,0.35)' : colors.border,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          shadowColor: colors.glossyShadow || 'rgba(0,230,118,0.15)',
          shadowOffset: { width: 0, height: isNew ? 8 : 4 },
          shadowOpacity: isNew ? 0.55 : 0.25,
          shadowRadius: isNew ? 18 : 10,
          elevation: isNew ? 8 : 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            {isNew && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 }} />
              </Animated.View>
            )}
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, textTransform: 'capitalize', flex: 1 }}>
              {dispatch.reportType || 'Incident'} Report
            </Text>
          </View>

          <View style={{ backgroundColor: statusColors.background, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: statusColors.text + '40' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: statusColors.text }}>{statusCfg.label}</Text>
          </View>
        </View>

        {dispatch.ward_id && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <Ionicons name="location" size={13} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>Ward {dispatch.ward_id}</Text>
          </View>
        )}

        <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 19, marginBottom: 14 }} numberOfLines={2}>
          {dispatch.description || 'No description provided.'}
        </Text>

        {getDirectionsUrl(dispatch) && (
          <TouchableOpacity
            onPress={() => openDispatchDirections(dispatch)}
            style={{ backgroundColor: colors.accentLight, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.primary + '40' }}
          >
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>Get Directions</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: colors.textLighter || colors.textLight }}>
            {dispatch.dispatchedAt ? new Date(dispatch.dispatchedAt).toLocaleTimeString() : 'Just now'}
          </Text>

          {action && (
            <TouchableOpacity
              onPress={() => updateDispatchStatus(dispatch.id, action.next)}
              disabled={isUpdating}
              style={{
                backgroundColor: action.color,
                paddingHorizontal: 15,
                paddingVertical: 8,
                borderRadius: 22,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: isUpdating ? 0.6 : 1,
                shadowColor: action.color,
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="arrow-forward-circle" size={14} color={colors.textInverse} />
                  <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: '800' }}>{action.label}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const SosTrackingCard = ({ alert }) => {
    const sosLocation = alert?.location || {};
    const currentLocation = getSosLocation(alert);
    const mapsUrl = getSosMapsUrl(alert);
    const locationHistory = Array.isArray(sosLocation.locationHistory) ? sosLocation.locationHistory : [];
    const lastUpdated = sosLocation.lastLocationAt || currentLocation?.recordedAt || alert.createdAt;
    const hasLocation = Number.isFinite(Number(currentLocation?.latitude)) && Number.isFinite(Number(currentLocation?.longitude));

    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 13, borderWidth: 1, borderColor: colors.error + '55', borderLeftWidth: 4, borderLeftColor: colors.error }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.errorLight || `${colors.error}20`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
                {alert.userName || 'PinPoint user'}
              </Text>
              {!!alert.userPhone && (
                <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {alert.userPhone}
                </Text>
              )}
            </View>
          </View>

          <View style={{ backgroundColor: colors.errorLight || `${colors.error}18`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: colors.error, fontSize: 11, fontWeight: '900' }}>LIVE SOS</Text>
          </View>
        </View>

        <View style={{ backgroundColor: colors.surfaceRaised || colors.background, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="location" size={17} color={hasLocation ? colors.primary : colors.textLight} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginLeft: 7 }}>Current Location</Text>
          </View>

          {hasLocation ? (
            <>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                {Number(currentLocation.latitude).toFixed(6)}, {Number(currentLocation.longitude).toFixed(6)}
              </Text>
              {!!currentLocation.accuracy && (
                <Text style={{ color: colors.textLight, marginTop: 5, fontSize: 12 }}>
                  Accuracy: {Math.round(currentLocation.accuracy)}m
                </Text>
              )}
            </>
          ) : (
            <Text style={{ color: colors.textLight, fontSize: 13 }}>Waiting for the first location update.</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '700' }}>LAST UPDATE</Text>
            <Text style={{ color: colors.text, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
              {formatDateTime(lastUpdated)}
            </Text>
            <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 3 }}>
              {locationHistory.length} tracked update{locationHistory.length === 1 ? '' : 's'}
            </Text>
          </View>

          {mapsUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(mapsUrl)}
              style={{ backgroundColor: colors.primary, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Ionicons name="map" size={16} color="#001B0B" />
              <Text style={{ color: '#001B0B', fontWeight: '900', fontSize: 12 }}>Open Map</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textLight, marginTop: 12 }}>Connecting to CPS dispatch...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <LinearGradient
            colors={[colors.gradient1 || 'rgba(0,230,118,0.10)', colors.gradient2 || '#0F1114', colors.surface]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 24,
              paddingTop: 32,
              paddingBottom: 28,
              borderBottomLeftRadius: 34,
              borderBottomRightRadius: 34,
              borderBottomWidth: 1,
              borderColor: 'rgba(0,230,118,0.20)',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8, shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 7 }} />
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                CPS Responder Queue
              </Text>
            </View>

            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, lineHeight: 34 }}>
              {serviceConfig.label}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
              <Ionicons name="location" size={15} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.textLight, fontWeight: '600' }}>
                {wardLabel ? `Ward ${wardLabel}` : 'No ward assigned'}
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.textLighter || colors.textLight, marginTop: 8 }}>
              {dispatches.length === 0 && activeSosCount === 0
                ? 'No active incidents'
                : `${dispatches.length} dispatches · ${pendingCount} new · ${activeSosCount} live SOS`}
            </Text>

            <View style={{ position: 'absolute', right: 24, top: 42, alignItems: 'center' }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,230,118,0.10)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.30)', justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8 }}>
                <Ionicons name={serviceConfig.icon} size={34} color={colors.primary} />
              </View>

              {pendingCount > 0 && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, shadowColor: colors.primary, shadowOpacity: 0.55, shadowRadius: 10, elevation: 7 }}>
                  <Text style={{ color: '#001B0B', fontSize: 11, fontWeight: '900' }}>{pendingCount} NEW</Text>
                </Animated.View>
              )}
            </View>
          </LinearGradient>

          <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 18 }}>
              {[
                { id: 'dispatches', label: 'Dispatches', count: dispatches.length, icon: 'list' },
                { id: 'sos', label: 'SOS Tracking', count: activeSosCount, icon: 'radio' },
              ].map((tab) => {
                const selected = activeTab === tab.id;

                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      backgroundColor: selected ? colors.primary : 'transparent',
                      borderRadius: 11,
                      paddingVertical: 11,
                      paddingHorizontal: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name={tab.icon} size={16} color={selected ? '#001B0B' : colors.textLight} />
                    <Text style={{ color: selected ? '#001B0B' : colors.text, fontSize: 12, fontWeight: '900' }} numberOfLines={1}>
                      {tab.label}
                    </Text>
                    <View style={{ minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? 'rgba(0,27,11,0.14)' : colors.surfaceRaised || colors.background }}>
                      <Text style={{ color: selected ? '#001B0B' : colors.textLight, fontSize: 11, fontWeight: '900' }}>{tab.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeTab === 'dispatches' && dispatches.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 70 }}>
                <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(0,230,118,0.08)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.20)', justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 18, elevation: 5 }}>
                  <Ionicons name="checkmark-circle-outline" size={52} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text, marginTop: 20 }}>All Clear</Text>
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center', lineHeight: 21, maxWidth: 310 }}>
                  No active CPS incidents. You'll be alerted when your community leader dispatches a ward incident.
                </Text>
              </View>
            ) : activeTab === 'dispatches' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary, marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Active Dispatches
                  </Text>
                </View>
                {dispatches.map((dispatch) => (
                  <DispatchCard key={dispatch.id} dispatch={dispatch} />
                ))}
              </>
            ) : sosAlerts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 70 }}>
                <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.errorLight || `${colors.error}12`, borderWidth: 1, borderColor: colors.error + '30', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark-outline" size={50} color={colors.error} />
                </View>
                <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text, marginTop: 20 }}>No Live SOS</Text>
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center', lineHeight: 21, maxWidth: 310 }}>
                  Active SOS triggers in your ward will appear here with their latest live location.
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.error, marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Live SOS Tracking
                  </Text>
                </View>
                {sosAlerts.map((alert) => (
                  <SosTrackingCard key={alert.id} alert={alert} />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: colors.overlay || 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 24,
            paddingBottom: 36,
            maxHeight: '85%',
            borderTopWidth: 1,
            borderColor: 'rgba(0,230,118,0.20)',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 12,
          }}>
            <View style={{ width: 42, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 7 }} />
                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Dispatch Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons name="close-circle" size={30} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {selectedDispatch && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const statusCfg = STATUS_CONFIG[selectedDispatch.status] || STATUS_CONFIG.pending;
                  const statusColors = getStatusColors(selectedDispatch.status);

                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      <View style={{ backgroundColor: statusColors.background, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: statusColors.text + '40' }}>
                        <Text style={{ color: statusColors.text, fontWeight: '800' }}>{statusCfg.label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textLight, flex: 1 }}>
                        Dispatched {selectedDispatch.dispatchedAt ? new Date(selectedDispatch.dispatchedAt).toLocaleString() : '—'}
                      </Text>
                    </View>
                  );
                })()}

                {selectedDispatch.ward_id && <DetailRow label="Ward" value={`Ward ${selectedDispatch.ward_id}`} colors={colors} />}
                <DetailRow label="Incident Type" value={selectedDispatch.reportType?.toUpperCase() || '—'} colors={colors} />
                <DetailRow label="Description" value={selectedDispatch.description || '—'} colors={colors} />
                <DetailRow label="Location" value={selectedDispatch.location?.latitude ? `${selectedDispatch.location.latitude}, ${selectedDispatch.location.longitude}` : 'Location not provided'} colors={colors} />

                {getDirectionsUrl(selectedDispatch) && (
                  <TouchableOpacity
                    onPress={() => openDispatchDirections(selectedDispatch)}
                    style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 18, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}
                  >
                    <Ionicons name="navigate" size={20} color="#001B0B" />
                    <Text style={{ color: '#001B0B', fontSize: 15, fontWeight: '900' }}>Open Directions</Text>
                  </TouchableOpacity>
                )}

                {(() => {
                  const action = nextStatusAction(selectedDispatch.status);
                  const isUpdating = updatingId === selectedDispatch.id;

                  if (!action) {
                    return (
                      <View style={{ backgroundColor: colors.successLight || '#063B20', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: colors.primary + '40' }}>
                        <Ionicons name="checkmark-circle" size={30} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: '900', marginTop: 7 }}>Dispatch Resolved</Text>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      onPress={() => updateDispatchStatus(selectedDispatch.id, action.next)}
                      disabled={isUpdating}
                      style={{
                        backgroundColor: action.color,
                        borderRadius: 17,
                        padding: 17,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 10,
                        marginTop: 24,
                        opacity: isUpdating ? 0.6 : 1,
                        shadowColor: action.color,
                        shadowOffset: { width: 0, height: 7 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 7,
                      }}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color={colors.textInverse} />
                      ) : (
                        <>
                          <Ionicons name="arrow-forward-circle" size={21} color={action.next === 'en_route' ? colors.textInverse : '#001B0B'} />
                          <Text style={{ color: action.next === 'en_route' ? colors.textInverse : '#001B0B', fontSize: 16, fontWeight: '900' }}>
                            {action.label}
                          </Text>
                        </>
                      )}
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