import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import BackIconButton from '../../components/BackIconButton';

import { getRow, subscribeToTable } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';

const formatTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

const isValidRemoteId = (value) => (
  value !== null &&
  value !== undefined &&
  `${value}`.trim() !== '' &&
  `${value}`.trim().toLowerCase() !== 'null' &&
  `${value}`.trim().toLowerCase() !== 'undefined'
);

export default function SosTrackingScreen() {
  const { colors } = useTheme();
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
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [alertId, loadAlert]);

  const sosLocation = alert?.location || {};
  const currentLocation = sosLocation.currentLocation || sosLocation;

  const mapsUrl = currentLocation?.mapsUrl || (
    currentLocation?.latitude && currentLocation?.longitude
      ? `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`
      : null
  );

  const isActive = alert?.status === 'active';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <BackIconButton />

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          backgroundColor: colors.error,
          borderRadius: 18,
          padding: 20,
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <View style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="alert-circle" size={42} color="#FFFFFF" />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 12 }}>SOS Live Tracking</Text>
          <Text style={{ color: '#FFFFFF', opacity: 0.88, textAlign: 'center', marginTop: 6, fontSize: 13, lineHeight: 19 }}>
            Location refreshes automatically every 10 seconds.
          </Text>
        </View>

        {loading ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 30,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textLight, marginTop: 12, fontSize: 14 }}>Loading SOS location...</Text>
          </View>
        ) : !alert ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 22,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name="search-outline" size={25} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>SOS alert not found</Text>
            <Text style={{ color: colors.textLight, marginTop: 7, fontSize: 13, lineHeight: 19 }}>
              The alert may be offline, expired, or unavailable to this account.
            </Text>
          </View>
        ) : (
          <>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Text style={{
                color: colors.textLight,
                fontSize: 11,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
              }}>Triggered By</Text>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }}>
                {alert.userName || 'PinPoint user'}
              </Text>
              {!!alert.userPhone && (
                <Text style={{ color: colors.textLight, marginTop: 4, fontSize: 13 }}>{alert.userPhone}</Text>
              )}

              <View style={{ marginTop: 17, height: 1, backgroundColor: colors.border }} />

              <Text style={{
                color: colors.textLight,
                fontSize: 11,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                marginTop: 17,
              }}>Status</Text>
              <View style={{
                alignSelf: 'flex-start',
                marginTop: 7,
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: isActive ? `${colors.success}18` : `${colors.warning}18`,
              }}>
                <Text style={{ color: isActive ? colors.success : colors.warning, fontSize: 13, fontWeight: '800' }}>
                  {(alert.status || 'unknown').toUpperCase()}
                </Text>
              </View>

              <Text style={{
                color: colors.textLight,
                fontSize: 11,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                marginTop: 18,
              }}>Last Location Update</Text>
              <Text style={{ color: colors.text, marginTop: 5, fontSize: 14 }}>
                {formatTime(sosLocation.lastLocationAt || alert.createdAt)}
              </Text>

              {currentLocation ? (
                <View style={{
                  marginTop: 17,
                  backgroundColor: colors.surfaceRaised || colors.background,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="location" size={18} color={colors.primary} />
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginLeft: 7 }}>
                      Current Location
                    </Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    {currentLocation.latitude?.toFixed?.(6) || '—'}, {currentLocation.longitude?.toFixed?.(6) || '—'}
                  </Text>
                  {!!currentLocation.accuracy && (
                    <Text style={{ color: colors.textLight, marginTop: 5, fontSize: 12 }}>
                      Accuracy: {Math.round(currentLocation.accuracy)}m
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 17, backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 14 }}>
                  <Text style={{ color: colors.textLight, fontSize: 13 }}>Waiting for the first location update.</Text>
                </View>
              )}
            </View>

            {mapsUrl && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 15,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 16,
                }}
                onPress={() => Linking.openURL(mapsUrl)}
              >
                <Ionicons name="map" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                  Open Current Location in Maps
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}