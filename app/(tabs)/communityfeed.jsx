import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import GlossyCardSmall from '../../components/GlossyCardSmall';
import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getUserProfile } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const destinations = {
  civicservices: '/(tabs)/civicservices',
  communityupdates: '/(tabs)/communityupdates',
  emergencysafety: '/(tabs)/emergencysafety',
  pinpoint: '/(tabs)/pinpoint',
  incidentreport: '/(tabs)/incidentreport',
  helpnearyou: '/helpnearyou',
  walkwithme: '/(tabs)/walkwithme',
};

export default function CommunityHubScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const role = profile?.role || 'resident';
  const isResident = role === 'resident';
  const isLeader = role === 'community_leader' || role === 'leader';

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        if (active) setAuthenticated(true);
        const nextProfile = await getUserProfile(user.id);
        if (active) setProfile(nextProfile || { role: 'resident' });
      } catch (error) {
        console.error('Community hub profile load failed:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const cards = [
    { key: 'civicservices', title: 'Civic Services', description: 'Access civic services and find the right place to report service issues.', icon: 'business-outline', show: isResident || isLeader },
    { key: 'communityupdates', title: 'Community Feed', description: 'Stay up to date with announcements and activities in your ward.', icon: 'newspaper-outline', show: isResident || isLeader },
    { key: 'emergencysafety', title: 'Emergency & Safety', description: 'Open emergency assistance, safety tools and responder resources.', icon: 'shield-checkmark-outline', show: isResident || isLeader },
    { key: 'walkwithme', title: 'WalkWithMe', description: 'Request a trusted CPF member to accompany you safely.', icon: 'walk-outline', show: isResident },
    { key: 'pinpoint', title: 'Digital Address', description: 'Create, save and share your PinPoint address and location.', icon: 'location-outline', show: isResident || isLeader },
    { key: 'incidentreport', title: 'Community Reports', description: 'Submit a report and follow its status and updates.', icon: 'megaphone-outline', show: isResident },
    { key: 'helpnearyou', title: 'Help Near You', description: 'Find support and services available in your community.', icon: 'heart-outline', show: isResident || isLeader },
  ].filter((card) => card.show);

  const firstName = profile?.firstName?.trim()?.split(/\s+/)[0];

  if (!loading && !authenticated) {
    router.replace('/login');
    return null;
  }
  if (!loading && !isResident && !isLeader) {
    router.replace(role === 'community_protection_service' || role === 'emergency_responder' ? '/(tabs)/emergencyResponderDashboard' : '/(tabs)/adminDashboard');
    return null;
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={firstName ? `Welcome, ${firstName}` : 'Community Hub'} subtitle="Your community, all in one place" meta={profile?.ward_number ? `Ward ${profile.ward_number}` : undefined} icon="people-circle-outline" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800', marginBottom: 12 }}>Explore your community</Text>
          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textLight, marginTop: 10 }}>Loading your hub…</Text></View>
          ) : loadError ? (
            <GlossyCardSmall style={{ padding: 16 }}><Text style={{ color: colors.text, lineHeight: 21 }}>Your profile could not be loaded. You can still open available community services.</Text></GlossyCardSmall>
          ) : null}
          {cards.map((card) => (
            <TouchableOpacity key={card.key} accessibilityRole="button" accessibilityLabel={t(card.title)} onPress={() => router.push(destinations[card.key])} activeOpacity={0.8} style={{ marginBottom: 11 }}>
              <GlossyCardSmall style={{ minHeight: 96, paddingHorizontal: 15, paddingVertical: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}><Ionicons name={card.icon} size={23} color={colors.primary} /></View>
                  <View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{t(card.title)}</Text><Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{t(card.description)}</Text></View>
                  <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                </View>
              </GlossyCardSmall>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
