import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TouchableOpacity from '../components/FeedbackTouchableOpacity';
import ScreenHeader from '../components/ScreenHeader';

import { getCurrentUser, getRows, getUserProfile, subscribeToTable } from '../config/supabase';

import { useTheme } from './context/ThemeContext';

const ALERT_TYPES = ['crime_alert', 'emergency_notice', 'service_update'];

const getElapsedTime = (dateValue, now) => {
  if (!dateValue) return 'No alerts';

  const alertDate = new Date(dateValue);
  if (Number.isNaN(alertDate.getTime())) return 'No alerts';

  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - alertDate.getTime()) / 1000));
  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diffInSeconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return alertDate.toLocaleDateString();
};

const getGreeting = (name) => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${name} 👋`;
  if (hour >= 12 && hour < 18) return `Good day, ${name} 👋`;
  return `Good evening, ${name} 👋`;
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();

  const [userName, setUserName] = useState('');
  const [wardDetails, setWardDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestAlerts, setLatestAlerts] = useState({});
  const [now, setNow] = useState(new Date());

  const fetchWardDetails = useCallback(async (profile) => {
    if (!profile?.ward_id) {
      setWardDetails(null);
      return;
    }

    const details = {
      wardId: profile.ward_id,
      wardNumber: profile.ward_number || null,
      suburbName: profile.suburb_name || null,
      cityName: profile.city_name || null,
      provinceName: profile.province_name || null,
    };

    try {
      const [ward] = await getRows('wards', { filters: { id: profile.ward_id } });
      if (ward) {
        details.wardNumber = details.wardNumber || ward.ward_number || ward.number || null;
        const suburbId = profile.suburb_id || ward.suburb_id;

        if (!details.suburbName && suburbId) {
          const [suburb] = await getRows('suburbs', { filters: { id: suburbId } });
          details.suburbName = suburb?.name || null;

          if (!details.cityName && suburb?.city_id) {
            const [city] = await getRows('cities', { filters: { id: suburb.city_id } });
            details.cityName = city?.name || null;

            if (!details.provinceName && city?.province_id) {
              const [province] = await getRows('provinces', { filters: { id: city.province_id } });
              details.provinceName = province?.name || null;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading ward details:', error);
    }

    setWardDetails(details);
  }, []);

  const fetchLatestAlerts = useCallback(async (profile) => {
    try {
      if (!profile?.ward_id) {
        setLatestAlerts({});
        return;
      }

      const options = {
        filters: { ward_id: profile.ward_id },
        order: [{ column: 'createdAt', ascending: false }],
      };

      const posts = await getRows('posts', options);
      const activePosts = posts.filter((post) => post.status !== 'archived');

      const latestByType = ALERT_TYPES.reduce((accumulator, type) => {
        accumulator[type] = activePosts.find((post) => post.type === type)?.createdAt || null;
        return accumulator;
      }, {});

      setLatestAlerts(latestByType);
    } catch (error) {
      console.error('Error loading latest alerts:', error);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      let profile = null;

      if (user) {
        profile = await getUserProfile(user.id);
        const firstName = profile?.firstName?.trim() || '';
        const lastName = profile?.lastName?.trim() || '';
        const fullName = `${firstName} ${lastName}`.trim();
        setUserName(fullName || 'Resident');
      }

      await fetchWardDetails(profile);
      await fetchLatestAlerts(profile);
      setLoading(false);

      return subscribeToTable('posts', () => fetchLatestAlerts(profile));
    } catch (error) {
      console.error('Error loading home screen:', error);
      setLoading(false);
      return undefined;
    }
  }, [fetchLatestAlerts, fetchWardDetails]);

  useEffect(() => {
    let unsubscribe;
    const load = async () => { unsubscribe = await fetchUserData(); };
    load();
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [fetchUserData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const wardTitle = wardDetails?.wardNumber
    ? `Ward ${wardDetails.wardNumber}`
    : wardDetails?.wardId ? `Ward ${wardDetails.wardId}` : 'No ward assigned';

  const wardLocation = [wardDetails?.suburbName, wardDetails?.cityName, wardDetails?.provinceName]
    .filter(Boolean)
    .join(' • ');

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 12, color: colors.textLight, fontSize: 14 }}>Loading your community...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title={getGreeting(userName)}
          subtitle={wardTitle}
          meta={wardLocation || (wardDetails ? 'Your community is safer together' : 'Add your ward to see local alerts')}
          icon="home"
        />

        <View style={{
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
          shadowOpacity: isDark ? 0 : colors.cardShadowOpacity,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: isDark ? 0 : 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.accentLight,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}>
              <Ionicons name="location" size={20} color={colors.accent} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{wardTitle}</Text>
              {wardLocation ? <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{wardLocation}</Text> : null}
            </View>
          </View>

          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
            <Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 18 }}>
              {wardDetails
                ? 'The information below is based only on alerts and updates posted for your ward.'
                : 'Your profile does not currently have a ward assigned. Ward-specific alerts will appear here once one is assigned.'}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '700' }}>Community Overview</Text>
          <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>Latest activity in {wardTitle}</Text>
        </View>

        <View style={{ flexDirection: 'row', marginHorizontal: 16, gap: 10 }}>
          {[
            { type: 'crime_alert', icon: 'alert-circle', color: colors.error, bg: colors.errorLight, label: 'Crime Alert' },
            { type: 'emergency_notice', icon: 'warning', color: colors.warning, bg: colors.warningLight, label: 'Emergency Notice' },
            { type: 'service_update', icon: 'construct', color: colors.accent, bg: colors.accentLight, label: 'Service Update' },
          ].map((item) => (
            <View key={item.type} style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 13,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.cardShadow,
              shadowOpacity: isDark ? 0 : colors.cardShadowOpacity,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: isDark ? 0 : 2,
            }}>
              <View style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: item.bg,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {getElapsedTime(latestAlerts[item.type], now)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 4, lineHeight: 15 }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text }}>Recent Alerts</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3 }}>Stay informed about your community</Text>
            </View>
            <Ionicons name="notifications-outline" size={22} color={colors.accent} />
          </View>

          <TouchableOpacity onPress={() => router.push('communityfeed')} activeOpacity={0.8}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.cardShadow,
              shadowOpacity: isDark ? 0 : colors.cardShadowOpacity,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 2 },
              elevation: isDark ? 0 : 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.accentLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="megaphone-outline" size={21} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '700' }}>Community Feed</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4, lineHeight: 17 }}>
                    View crime alerts, emergency notices and community updates.
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.accent} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{
          marginHorizontal: 16,
          marginTop: 20,
          padding: 16,
          borderRadius: 14,
          backgroundColor: colors.glassGreen,
          borderWidth: 1,
          borderColor: colors.accentLight,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="shield-checkmark" size={22} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                Community Safety
              </Text>
              <Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 18 }}>
                Stay alert, look out for your neighbours and report incidents through Comm-Connect when necessary.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}