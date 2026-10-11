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

const getElapsedTime = (date) => {
  if (!date) return '';

  const now = new Date();
  const created = new Date(date);
  const difference = Math.floor((now.getTime() - created.getTime()) / 1000);

  if (difference < 60) return 'Just now';

  const minutes = Math.floor(difference / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Home() {
  const { colors, isDark } = useTheme();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wardDetails, setWardDetails] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWardDetails = useCallback(async (profileData) => {
    try {
      if (!profileData) return;

      setWardDetails({
        province: profileData.province,
        city: profileData.city,
        suburb: profileData.suburb,
        ward: profileData.ward,
      });
    } catch (error) {
      console.error('Error fetching ward details:', error);
    }
  }, []);

  const fetchLatestAlerts = useCallback(async () => {
    try {
      const rows = await getRows('community_alerts');

      if (!rows) {
        setAlerts([]);
        return;
      }

      const filtered = rows
        .filter((item) => ALERT_TYPES.includes(item.alert_type))
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 5);

      setAlerts(filtered);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = await getCurrentUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const profileData = await getUserProfile(currentUser.id);
      setProfile(profileData);

      await fetchWardDetails(profileData);
      await fetchLatestAlerts();
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchLatestAlerts, fetchWardDetails]);

  useEffect(() => {
    fetchUserData();

    const interval = setInterval(() => {
      fetchLatestAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchUserData, fetchLatestAlerts]);

  useEffect(() => {
    let subscription;

    try {
      subscription = subscribeToTable('community_alerts', () => {
        fetchLatestAlerts();
      });
    } catch (error) {
      console.error('Could not subscribe to community alerts:', error);
    }

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [fetchLatestAlerts]);

  const userName =
    profile?.full_name ||
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Resident';

  const wardName = wardDetails?.ward || profile?.ward || 'Your Ward';

  const locationText = [wardDetails?.suburb || profile?.suburb, wardDetails?.city || profile?.city]
    .filter(Boolean)
    .join(', ');

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 12, color: colors.textLight, fontSize: 14 }}>
            Loading your community...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <ScreenHeader
          title={`${getGreeting()} ${userName}`}
          subtitle={`Welcome to ${wardName} community feed`}
        />

        {/* COMMUNITY LOCATION */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.cardShadow,
            shadowOpacity: isDark ? 0 : colors.cardShadowOpacity,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 2 },
            elevation: isDark ? 0 : 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accentLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="location-outline" size={23} color={colors.accent} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textLight }}>Your community</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                  {wardName}
                </Text>
                {locationText ? (
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>
                    {locationText}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* HELP NEAR YOU */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text }}>Help Near You</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3 }}>
                Find local support and services in your community
              </Text>
            </View>
            <Ionicons name="heart-outline" size={24} color={colors.accent} />
          </View>

          <TouchableOpacity onPress={() => router.push('/helpnearyou')} activeOpacity={0.8}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.cardShadow,
              shadowOpacity: isDark ? 0 : colors.cardShadowOpacity,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 2 },
              elevation: isDark ? 0 : 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: colors.accentLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="heart-outline" size={25} color={colors.accent} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: '700' }}>
                    Find Support & Services
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4, lineHeight: 17 }}>
                    Find therapists, clinics, community centres, social support and other helpful services near you.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={21} color={colors.accent} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
                {['Mental Health', 'Healthcare', 'Social Support'].map((category) => (
                  <View key={category} style={{
                    backgroundColor: colors.background,
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}>
                    <Text style={{ fontSize: 10, color: colors.textLight, fontWeight: '600' }}>
                      {category}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* COMMUNITY OVERVIEW */}
        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
            Community Overview
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 13,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Ionicons name="warning-outline" size={23} color={colors.warning} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 9 }}>
                Crime Alert
              </Text>
              <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 4 }}>
                Stay informed
              </Text>
            </View>

            <View style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 13,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Ionicons name="alert-circle-outline" size={23} color={colors.error} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 9 }}>
                Emergency
              </Text>
              <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 4 }}>
                Important notices
              </Text>
            </View>

            <View style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 13,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Ionicons name="megaphone-outline" size={23} color={colors.accent} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 9 }}>
                Services
              </Text>
              <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 4 }}>
                Community updates
              </Text>
            </View>
          </View>
        </View>

        {/* RECENT ALERTS */}
        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text }}>Recent Alerts</Text>

            <TouchableOpacity onPress={() => router.push('/(tabs)/communityfeed')}>
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>View all</Text>
            </TouchableOpacity>
          </View>

          {alerts.length === 0 ? (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}>
              <Ionicons name="notifications-off-outline" size={28} color={colors.textLight} />
              <Text style={{ color: colors.textLight, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                No recent community alerts.
              </Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <TouchableOpacity key={alert.id} activeOpacity={0.8} onPress={() => router.push('/(tabs)/communityfeed')}>
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 15,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: colors.accentLight,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                    }}>
                      <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                        {alert.title || alert.heading || 'Community Alert'}
                      </Text>

                      {alert.message ? (
                        <Text style={{
                          color: colors.textLight,
                          fontSize: 12,
                          lineHeight: 17,
                          marginTop: 4,
                        }} numberOfLines={3}>
                          {alert.message}
                        </Text>
                      ) : null}

                      <Text style={{ color: colors.textLight, fontSize: 10, marginTop: 6 }}>
                        {getElapsedTime(alert.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* COMMUNITY SAFETY */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(tabs)/communityfeed')}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.accentLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="shield-checkmark-outline" size={23} color={colors.accent} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    Community Safety
                  </Text>
                  <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>
                    Stay connected with your community.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}