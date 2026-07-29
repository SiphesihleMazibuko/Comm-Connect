import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, getRows, getUserProfile, subscribeToTable } from '../config/supabase';
import colors from '../Utils/colors';

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

export default function HomeScreen() {
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
      const latestByType = ALERT_TYPES.reduce((acc, type) => {
        acc[type] = activePosts.find((post) => post.type === type)?.createdAt || null;
        return acc;
      }, {});

      setLatestAlerts(latestByType);
    } catch (error) {
      console.error('Error loading latest alerts:', error);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    const user = await getCurrentUser();
    let profile = null;

    if (user) {
      profile = await getUserProfile(user.id);
      setUserName(profile?.firstName || '');
    }

    await fetchWardDetails(profile);
    await fetchLatestAlerts(profile);
    setLoading(false);

    return subscribeToTable('posts', () => fetchLatestAlerts(profile));
  }, [fetchLatestAlerts, fetchWardDetails]);

  useEffect(() => {
    let unsubscribe;

    const load = async () => {
      unsubscribe = await fetchUserData();
    };

    load();

    return () => unsubscribe && unsubscribe();
  }, [fetchUserData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const wardTitle = wardDetails?.wardNumber
    ? `Ward ${wardDetails.wardNumber}`
    : wardDetails?.wardId
      ? `Ward ${wardDetails.wardId}`
      : 'No ward assigned';

  const wardLocation = [wardDetails?.suburbName, wardDetails?.cityName, wardDetails?.provinceName]
    .filter(Boolean)
    .join(' - ');

  if (loading) {
    return (
      
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, padding: 24, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>Hello, {userName || 'Resident'}! 👋</Text>
        <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8, marginTop: 8 }}>{wardTitle}</Text>
        <Text style={{ fontSize: 12, color: '#fff', opacity: 0.7, marginTop: 4 }}>
          {wardLocation || (wardDetails ? 'Your community is safer together' : 'Add your ward to see local alerts')}
        </Text>
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="location" size={18} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }}>{wardTitle}</Text>
        </View>
        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 6 }}>
          {wardDetails
            ? 'Stats below are based only on alerts posted for this ward.'
            : 'Stats are unavailable until your profile has a ward assigned.'}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', margin: 16, gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{getElapsedTime(latestAlerts.crime_alert, now)}</Text>
          <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center' }}>Ward Crime Reported</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="warning" size={24} color={colors.warning} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{getElapsedTime(latestAlerts.emergency_notice, now)}</Text>
          <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center' }}>Ward Emergency Notice</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="construct" size={24} color={colors.accent} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{getElapsedTime(latestAlerts.service_update, now)}</Text>
          <Text style={{ fontSize: 12, color: colors.textLight, textAlign: 'center' }}>Ward Service Update</Text>
        </View>
      </View>

      {/* Recent Alerts Preview */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>Recent Alerts</Text>
        <TouchableOpacity onPress={() => router.push('communityfeed')}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 14, color: colors.error, fontWeight: 'bold' }}>⚠️ Crime Alert</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>View all community updates →</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
