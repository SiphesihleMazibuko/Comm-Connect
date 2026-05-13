import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, ScrollView, Text, TouchableOpacity, View, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

// Map the logged-in responder's serviceType to display config
const SERVICE_CONFIG = {
  police:    { label: 'Police Unit',       icon: 'shield',  color: '#1D4ED8', bg: '#EFF6FF', gradient: ['#1D4ED8', '#1E40AF'] },
  ambulance: { label: 'Ambulance',         icon: 'medkit',  color: '#059669', bg: '#ECFDF5', gradient: ['#059669', '#047857'] },
  fire:      { label: 'Fire & Rescue',     icon: 'flame',   color: '#DC2626', bg: '#FEF2F2', gradient: ['#DC2626', '#B91C1C'] },
};

const STATUS_CONFIG = {
  pending:   { label: 'New Dispatch',  color: '#F59E0B', bg: '#FEF3C7' },
  en_route:  { label: 'En Route',      color: '#3B82F6', bg: '#EFF6FF' },
  on_scene:  { label: 'On Scene',      color: '#8B5CF6', bg: '#EDE9FE' },
  resolved:  { label: 'Resolved',      color: '#10B981', bg: '#ECFDF5' },
};

export default function ResponderDashboardScreen() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responderServiceType, setResponderServiceType] = useState(null);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const user = auth.currentUser;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadResponderProfile();
  }, []);

  // Once we know the serviceType, subscribe to dispatches for that service
  useEffect(() => {
    if (!responderServiceType) return;
    const unsubscribe = subscribeToDispatches(responderServiceType);
    return () => unsubscribe && unsubscribe();
  }, [responderServiceType]);

  // Pulse animation for "pending" badge
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
  }, [dispatches]);

  const loadResponderProfile = async () => {
    // Read the logged-in responder's serviceType from their user doc.
    // Adjust the field name to match your Firestore schema.
    try {
      const { getDocs, collection: col, query: q, where: wh } = await import('firebase/firestore');
      const snap = await getDocs(q(col(db, 'users'), wh('__name__', '==', user.uid)));
      snap.forEach((d) => {
        const data = d.data();
        // e.g. data.serviceType === 'police' | 'ambulance' | 'fire'
        setResponderServiceType(data.serviceType || 'police');
      });
    } catch (e) {
      console.error('Failed to load responder profile', e);
      setResponderServiceType('police'); // fallback
    }
  };

  const subscribeToDispatches = (serviceType) => {
    const q = query(
      collection(db, 'emergency_dispatches'),
      where('serviceType', '==', serviceType),
      where('status', '!=', 'resolved'),   // hide resolved from the live feed
      orderBy('status'),                   // Firestore requires orderBy when using !=
      orderBy('dispatchedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() }));

      // Vibrate + flag new pending dispatches
      const newPending = data.filter(d => d.status === 'pending' && !d.acknowledged);
      if (newPending.length > 0) {
        Vibration.vibrate([0, 400, 200, 400]);
      }

      setDispatches(data);
      setLoading(false);
    }, (err) => {
      console.error('Dispatch listener error:', err);
      setLoading(false);
    });

    return unsubscribe;
  };

  const updateDispatchStatus = async (dispatchId, newStatus) => {
    setUpdatingId(dispatchId);
    try {
      await updateDoc(doc(db, 'emergency_dispatches', dispatchId), {
        status: newStatus,
        acknowledged: true,
        [`${newStatus}At`]: new Date().toISOString(),
        responderId: user.uid,
      });
      // Optimistically update local state
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

  const serviceConfig = SERVICE_CONFIG[responderServiceType] || SERVICE_CONFIG.police;
  const pendingCount = dispatches.filter(d => d.status === 'pending').length;

  // ─── Status action button helper ─────────────────────────────────────────
  const nextStatusAction = (currentStatus) => {
    switch (currentStatus) {
      case 'pending':  return { label: 'Mark En Route', next: 'en_route',  color: '#3B82F6' };
      case 'en_route': return { label: 'Mark On Scene',  next: 'on_scene',  color: '#8B5CF6' };
      case 'on_scene': return { label: 'Mark Resolved',  next: 'resolved',  color: '#10B981' };
      default: return null;
    }
  };

  // ─── Dispatch card ────────────────────────────────────────────────────────
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
        {/* Top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Pulsing dot for new alerts */}
            {isNew && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
              </Animated.View>
            )}
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, textTransform: 'capitalize' }}>
              {dispatch.reportType || 'Incident'} Report
            </Text>
          </View>

          {/* Status badge */}
          <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: statusCfg.color }}>{statusCfg.label}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>
          {dispatch.description}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: colors.textLight }}>
            {dispatch.dispatchedAt ? new Date(dispatch.dispatchedAt).toLocaleTimeString() : 'Just now'}
          </Text>

          {/* Inline next-step button */}
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

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textLight, marginTop: 12 }}>Connecting to dispatch...</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* HEADER */}
          <LinearGradient
            colors={serviceConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 28, paddingTop: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 13, color: '#fff', opacity: 0.8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Responder Dashboard
                </Text>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#fff' }}>{serviceConfig.label}</Text>
                <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 6 }}>
                  {dispatches.length === 0
                    ? 'No active dispatches'
                    : `${dispatches.length} active · ${pendingCount} new`}
                </Text>
              </View>

              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={serviceConfig.icon} size={34} color="#fff" />
                </View>
                {pendingCount > 0 && (
                  <Animated.View style={{ transform: [{ scale: pulseAnim }], backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{pendingCount} NEW</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </LinearGradient>

          {/* DISPATCH LIST */}
          <View style={{ padding: 16, paddingTop: 20 }}>
            {dispatches.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="checkmark-circle-outline" size={64} color={colors.textLight} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>All Clear</Text>
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
                  No active dispatches. You&apos;ll be alerted immediately when a new incident is approved.
                </Text>
              </View>
            ) : (
              <>
                {/* Section header */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                  Active Dispatches
                </Text>
                {dispatches.map((dispatch) => (
                  <DispatchCard key={dispatch.id} dispatch={dispatch} />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── DETAIL MODAL ─────────────────────────────────────────────────── */}
      <Modal visible={detailVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '85%' }}>

            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>Dispatch Details</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {selectedDispatch && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status badge */}
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

                {/* Status progression buttons */}
                {(() => {
                  const action = nextStatusAction(selectedDispatch.status);
                  const isUpdating = updatingId === selectedDispatch.id;
                  if (!action) return (
                    <View style={{ backgroundColor: '#ECFDF5', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 }}>
                      <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: 'bold', marginTop: 6 }}>Dispatch Resolved</Text>
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

// Small helper component for labelled detail rows
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

// Re-export the nextStatusAction so it can be reused in DispatchCard (defined outside component scope above)
function nextStatusAction(currentStatus) {
  switch (currentStatus) {
    case 'pending':  return { label: 'Mark En Route', next: 'en_route',  color: '#3B82F6' };
    case 'en_route': return { label: 'Mark On Scene',  next: 'on_scene',  color: '#8B5CF6' };
    case 'on_scene': return { label: 'Mark Resolved',  next: 'resolved',  color: '#10B981' };
    default: return null;
  }
}