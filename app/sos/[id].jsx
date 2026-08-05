import {
  Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback,
  useEffect,
  useState } from 'react';
import { ActivityIndicator,
  ScrollView,
  Text,
  View
} from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackIconButton from '../../components/BackIconButton';
import { getRow, subscribeToTable } from '../../config/supabase';
import colors from '../../Utils/colors';

const formatTime = (value) => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
};

const isValidRemoteId = (value) => (
  value !== null
  && value !== undefined
  && `${value}`.trim() !== ''
  && `${value}`.trim().toLowerCase() !== 'null'
  && `${value}`.trim().toLowerCase() !== 'undefined'
);

export default function SosTrackingScreen() {
  const { id } = useLocalSearchParams();
  const alertId = Array.isArray(id) ? id[0] : id;
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAlert = useCallback(async () => {
    if (!isValidRemoteId(alertId)) {
      setAlert(null);
      setLoading(false);
      return;
    }

    try {
      const row = await getRow('emergencyRequests', alertId);
      setAlert(row);
    } catch (error) {
      console.error('[SOS] Failed to load tracking alert:', error);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    if (!isValidRemoteId(alertId)) {
      setLoading(false);
      return undefined;
    }

    loadAlert();
    const poll = setInterval(loadAlert, 10000);
    const unsubscribe = subscribeToTable('emergencyRequests', (payload) => {
      if (payload.new?.id === alertId || payload.old?.id === alertId) {
        loadAlert();
      }
    });

    return () => {
      clearInterval(poll);
      unsubscribe();
    };
  }, [alertId, loadAlert]);

  const sosLocation = alert?.location || {};
  const currentLocation = sosLocation.currentLocation || sosLocation;
  const mapsUrl = currentLocation?.mapsUrl || (
    currentLocation?.latitude && currentLocation?.longitude
      ? `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`
      : null
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <BackIconButton />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ backgroundColor: colors.error, borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="alert-circle" size={42} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 }}>SOS Live Tracking</Text>
          <Text style={{ color: '#fff', opacity: 0.85, textAlign: 'center', marginTop: 5 }}>
            Location refreshes automatically every 10 seconds.
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textLight, marginTop: 10 }}>Loading SOS location...</Text>
          </View>
        ) : !alert ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>SOS alert not found</Text>
            <Text style={{ color: colors.textLight, marginTop: 6 }}>The alert may be offline, expired, or unavailable to this account.</Text>
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textLight, fontSize: 12, textTransform: 'uppercase' }}>Triggered By</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{alert.userName || 'PinPoint user'}</Text>
              {!!alert.userPhone && <Text style={{ color: colors.textLight, marginTop: 4 }}>{alert.userPhone}</Text>}

              <View style={{ marginTop: 16, height: 1, backgroundColor: colors.border }} />

              <Text style={{ color: colors.textLight, fontSize: 12, textTransform: 'uppercase', marginTop: 16 }}>Status</Text>
              <Text style={{ color: alert.status === 'active' ? colors.success : colors.warning, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
                {(alert.status || 'unknown').toUpperCase()}
              </Text>

              <Text style={{ color: colors.textLight, fontSize: 12, textTransform: 'uppercase', marginTop: 16 }}>Last Location Update</Text>
              <Text style={{ color: colors.text, marginTop: 4 }}>{formatTime(sosLocation.lastLocationAt || alert.createdAt)}</Text>

              {currentLocation ? (
                <View style={{ marginTop: 16, backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {currentLocation.latitude?.toFixed?.(6)}, {currentLocation.longitude?.toFixed?.(6)}
                  </Text>
                  {!!currentLocation.accuracy && (
                    <Text style={{ color: colors.textLight, marginTop: 4 }}>Accuracy: {Math.round(currentLocation.accuracy)}m</Text>
                  )}
                </View>
              ) : (
                <Text style={{ color: colors.textLight, marginTop: 16 }}>Waiting for the first location update.</Text>
              )}
            </View>

            {mapsUrl && (
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 }}
                onPress={() => Linking.openURL(mapsUrl)}
              >
                <Ionicons name="map" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800' }}>Open Current Location in Maps</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
