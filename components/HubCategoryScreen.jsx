import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableOpacity from './FeedbackTouchableOpacity';
import GlossyCardSmall from './GlossyCardSmall';
import ScreenHeader from './ScreenHeader';
import { getCurrentUser, getUserProfile } from '../config/supabase';
import { useTheme } from '../app/context/ThemeContext';
import { useLanguage } from '../app/context/LanguageContext';

const categoryConfigs = {
  civicservices: {
    title: 'Civic Services', icon: 'business-outline',
    description: 'Official civic services and the existing channels for community service issues.',
    actions: [
      { title: 'Register to Vote', description: 'Register through the official IEC portal.', icon: 'checkbox-outline', url: 'https://registertovote.elections.org.za/' },
      { title: 'Verify Registration', description: 'Check voter information on the IEC website.', icon: 'checkmark-circle-outline', url: 'https://www.elections.org.za/' },
      { title: 'Report a Service Issue', description: 'Use Community Reports for existing service and infrastructure reports.', icon: 'megaphone-outline', route: '/(tabs)/incidentreport' },
    ],
  },
  emergencysafety: { title: 'Emergency & Safety', icon: 'shield-checkmark-outline', description: 'Emergency help, safety features and role-specific response tools.' },
};

const openExternal = async (url, t) => {
  try {
    if (!(await Linking.canOpenURL(url))) throw new Error(t('This link cannot be opened on this device.'));
    await Linking.openURL(url);
  } catch (error) { Alert.alert(t('Unable to Open'), error?.message || t('Please try again.')); }
};

export default function HubCategoryScreen({ category }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const config = categoryConfigs[category];

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const user = await getCurrentUser();
        if (!user) { router.replace('/login'); return; }
        if (active) setAuthenticated(true);
        const nextProfile = await getUserProfile(user.id);
        if (active) setProfile(nextProfile || { role: 'resident' });
      } catch (error) { console.error('Category profile load failed:', error); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const role = profile?.role || 'resident';
  const resident = role === 'resident';
  const leader = role === 'community_leader' || role === 'leader';
  const cpf = role === 'community_protection_service' || role === 'emergency_responder';
  const actions = category === 'civicservices'
    ? (resident || leader ? config.actions : [])
    : [
        ...(resident ? [
          { title: 'SOS and Digital Address', description: 'Use your saved PinPoint address and emergency SOS tools.', icon: 'location-outline', route: '/(tabs)/pinpoint' },
          { title: 'Request Emergency Help', description: 'Submit an emergency request and view your existing requests.', icon: 'alert-circle-outline', route: '/(tabs)/emergencyrequest' },
          { title: 'Emergency Contacts', description: 'Manage your saved emergency contacts.', icon: 'people-outline', route: '/(tabs)/settings' },
          { title: 'WalkWithMe', description: 'Request a trusted CPF member to accompany you safely.', icon: 'walk-outline', route: '/(tabs)/walkwithme' },
        ] : []),
        ...(cpf ? [
          { title: 'Responder Dashboard', description: 'Open emergency response tools.', icon: 'radio-outline', route: '/(tabs)/emergencyResponderDashboard' },
          { title: 'CPF Duty', description: 'Manage your community protection duty status.', icon: 'people-circle-outline', route: '/(tabs)/cpsmembers' },
        ] : []),
        ...(leader ? [{ title: 'Emergency SOS', description: 'Open the existing emergency and PinPoint tools.', icon: 'location-outline', route: '/(tabs)/pinpoint' }] : []),
      ];

  if (!config) return null;
  if (!loading && !authenticated) { router.replace('/login'); return null; }
  if (!loading && category === 'civicservices' && !resident && !leader) {
    router.replace(cpf ? '/(tabs)/emergencyResponderDashboard' : '/(tabs)/adminDashboard');
    return null;
  }
  if (!loading && category === 'emergencysafety' && !resident && !leader && !cpf) {
    router.replace('/(tabs)/adminDashboard');
    return null;
  }
  const blocked = !loading && actions.length === 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t(config.title)} subtitle={t(config.description)} icon={config.icon} leftIcon="arrow-back" onLeftPress={() => router.replace('/(tabs)/communityfeed')} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {loading ? <Text style={{ color: colors.textLight, padding: 12 }}>{t('Loading services')}</Text> : null}
          {blocked ? <GlossyCardSmall style={{ padding: 16 }}><Text style={{ color: colors.text, lineHeight: 21 }}>{t('These actions are not available for this account role.')}</Text></GlossyCardSmall> : null}
          {actions.map((action) => (
            <TouchableOpacity key={action.title} accessibilityRole="button" accessibilityLabel={t(action.title)} activeOpacity={0.8} onPress={() => action.route ? router.push(action.route) : openExternal(action.url, t)} style={{ marginBottom: 11 }}>
              <GlossyCardSmall style={{ minHeight: 88, paddingHorizontal: 15, paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={action.icon} size={22} color={colors.primary} /></View>
                  <View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{t(action.title)}</Text><Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{t(action.description)}</Text></View>
                  <Ionicons name={action.url ? 'open-outline' : 'chevron-forward'} size={19} color={colors.accent} />
                </View>
              </GlossyCardSmall>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
