import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getSupabaseClient, getUserProfile } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const cleanNumber = (value) => {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
};

export default function HelpListingDetails() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { id } = useLocalSearchParams();
  const [listing, setListing] = useState(null);
  const [wardName, setWardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const user = await getCurrentUser();
        if (!user) { router.replace('/login'); return; }
        const profile = await getUserProfile(user.id);
        if (active) setWardName(profile?.wardName || '');
        const { data, error: fetchError } = await getSupabaseClient().from('help_listings').select('*').eq('id', id).eq('ward_id', profile?.ward_id).maybeSingle();
        if (fetchError) throw fetchError;
        if (!data) throw new Error('This listing is unavailable or is no longer published.');
        if (active) setListing(data);
      } catch (fetchError) {
        console.error('Help listing details load failed:', fetchError);
        if (active) setError(fetchError?.message || 'Could not load this listing.');
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [id]);

  const openDirections = async () => {
    if (!listing) return;
    const query = listing.latitude != null && listing.longitude != null
      ? `${listing.latitude},${listing.longitude}`
      : listing.office_address;
    if (!query) return;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
    try { await Linking.openURL(googleUrl); }
    catch {
      const fallback = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
      try { await Linking.openURL(fallback); }
      catch { Alert.alert(t('Directions unavailable'), t('This device could not open a maps application.')); }
    }
  };

  const callProvider = async () => {
    if (!listing?.contact_phone) return;
    try { await Linking.openURL(`tel:${listing.contact_phone.replace(/[^\d+]/g, '')}`); }
    catch { Alert.alert(t('Contact number'), listing.contact_phone); }
  };

  const chatWhatsApp = async () => {
    const number = cleanNumber(listing?.whatsapp_phone);
    if (!number) return;
    const message = t('Hello, I found your details on Comm-Connect Help Near You. I would like to enquire about the assistance you offer.');
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert(t('WhatsApp unavailable'), t('WhatsApp could not be opened. You can call {{phone}} instead.', { phone: listing.contact_phone }), [{ text: t('OK') }, { text: t('Call'), onPress: callProvider }]); }
  };

  const hasLocation = Boolean(listing?.office_address || (listing?.latitude != null && listing?.longitude != null));
  const fields = listing ? [
    [t('Office'), [listing.office_name, listing.office_address].filter(Boolean).join('\n')],
    [t('Contact number'), listing.contact_phone],
    [t('Email'), listing.email],
    [t('Office hours'), listing.office_hours],
    [t('Ward served'), wardName || listing.ward_id],
    [t('Eligibility requirements'), listing.eligibility_requirements],
    [t('Additional instructions'), listing.additional_instructions],
  ].filter(([, value]) => value) : [];

  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('Help Listing')} subtitle={t('Service details and contact information')} leftIcon="arrow-back" onLeftPress={() => router.back()} />
      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.textLight, marginTop: 10 }}>{t('Loading listing…')}</Text></View>
        : error ? <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="alert-circle-outline" size={42} color={colors.textLight} /><Text style={{ color: colors.text, textAlign: 'center', marginTop: 12 }}>{t(error)}</Text><TouchableOpacity onPress={() => router.back()} style={{ padding: 14 }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{t('Back to Help Near You')}</Text></TouchableOpacity></View>
          : listing && <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 38 }}>
            {listing.image_url ? <Image source={{ uri: listing.image_url }} style={{ width: 88, height: 88, borderRadius: 18, marginBottom: 13 }} /> : <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}18`, marginBottom: 13 }}><Ionicons name="heart-outline" size={30} color={colors.primary} /></View>}
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{listing.name}</Text>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800', marginTop: 5 }}>{listing.category}</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 14, marginBottom: 17 }}>{listing.description}</Text>
            <View style={{ flexDirection: 'row', gap: 9, marginBottom: 16 }}>
              <TouchableOpacity onPress={callProvider} style={{ flex: 1, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingVertical: 12 }}><Ionicons name="call-outline" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', marginLeft: 7 }}>{t('Call')}</Text></TouchableOpacity>
              {listing.whatsapp_available && listing.whatsapp_phone ? <TouchableOpacity onPress={chatWhatsApp} style={{ flex: 1, borderRadius: 11, backgroundColor: '#16834a', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingVertical: 12 }}><Ionicons name="logo-whatsapp" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', marginLeft: 7 }}>{t('Chat on WhatsApp')}</Text></TouchableOpacity> : null}
            </View>
            {hasLocation ? <TouchableOpacity onPress={openDirections} style={{ borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingVertical: 12, marginBottom: 12 }}><Ionicons name="navigate-outline" size={18} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: '800', marginLeft: 7 }}>{t('Get Directions')}</Text></TouchableOpacity> : <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 12 }}>{t('No office location is listed for this service.')}</Text>}
            {fields.map(([label, value]) => <View key={label} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.textLight, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label}</Text><Text selectable style={{ color: colors.text, lineHeight: 21 }}>{value}</Text></View>)}
          </ScrollView>}
    </SafeAreaView>
  </>;
}
