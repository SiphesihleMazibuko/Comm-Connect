import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableOpacity from '../components/FeedbackTouchableOpacity';
import ScreenHeader from '../components/ScreenHeader';
import { uploadReportImages } from '../config/mediaUpload';
import { getCurrentUser, getSupabaseClient, getUserProfile } from '../config/supabase';
import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';

const EMPTY_FORM = {
  name: '', category: '', description: '', contact_phone: '', email: '',
  whatsapp_available: false, whatsapp_phone: '', office_name: '', office_address: '',
  latitude: '', longitude: '', office_hours: '', image_url: '', additional_instructions: '',
  eligibility_requirements: '',
};

const trimOrNull = (value) => value.trim() || null;
const Input = ({ label, value, onChangeText, colors, multiline = false, keyboardType, required = false, placeholder }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 5 }}>{label}{required ? ' *' : ''}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={colors.textLight} multiline={multiline} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} style={{ color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10, minHeight: multiline ? 82 : 44, textAlignVertical: multiline ? 'top' : 'center' }} />
  </View>
);

export default function HelpNearYou() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const role = profile?.role || 'resident';
  const isLeader = ['community_leader', 'leader'].includes(role);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const network = await NetInfo.fetch();
      setOffline(network.isConnected === false || network.isInternetReachable === false);
      const currentUser = await getCurrentUser();
      if (!currentUser) { router.replace('/login'); return; }
      const userProfile = await getUserProfile(currentUser.id);
      setUser(currentUser);
      setProfile(userProfile);
      if (!userProfile?.ward_id) {
        setListings([]);
        setError('Your account has no ward assigned. Update your profile in Settings to use Help Near You.');
        return;
      }
      const supabase = getSupabaseClient();
      let query = supabase.from('help_listings').select('*').eq('ward_id', userProfile.ward_id);
      const leaderProfile = ['community_leader', 'leader'].includes(userProfile.role);
      if (leaderProfile) query = query.eq('created_by', currentUser.id);
      else query = query.eq('status', 'published');
      const { data, error: queryError } = await query.order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setListings(data || []);
    } catch (loadError) {
      console.error('Help Near You load failed:', loadError);
      setError(loadError?.message || 'Could not load help listings. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const categories = useMemo(() => ['All', ...new Set(listings.map((item) => item.category).filter(Boolean))], [listings]);
  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((item) => {
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const searchMatch = !query || [item.name, item.category, item.description, item.office_address, item.office_name, item.office_hours].some((value) => String(value || '').toLowerCase().includes(query));
      return categoryMatch && searchMatch;
    });
  }, [listings, search, selectedCategory]);

  const openNewForm = () => { setEditingId(null); setForm(EMPTY_FORM); setReviewing(false); setFormOpen(true); };
  const openEditForm = (listing) => {
    setEditingId(listing.id);
    setForm({ ...EMPTY_FORM, ...listing, latitude: listing.latitude == null ? '' : String(listing.latitude), longitude: listing.longitude == null ? '' : String(listing.longitude) });
    setReviewing(false);
    setFormOpen(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
      if (!result.canceled && result.assets?.[0]?.uri) setForm((current) => ({ ...current, image_url: result.assets[0].uri }));
    } catch (pickError) { Alert.alert(t('Image unavailable'), pickError?.message || t('Could not select an image.')); }
  };

  const validate = () => {
    if (form.name.trim().length < 2) return t('Enter the person or organisation name.');
    if (!form.category.trim()) return t('Enter the type of assistance offered.');
    if (form.description.trim().length < 5) return t('Add a short description of the assistance.');
    if (!form.contact_phone.trim()) return t('Enter a contact number.');
    if (form.whatsapp_available && !form.whatsapp_phone.trim()) return t('Enter the WhatsApp number, or turn off WhatsApp availability.');
    const hasLat = form.latitude.trim() !== '';
    const hasLng = form.longitude.trim() !== '';
    if (hasLat !== hasLng) return t('Enter both GPS coordinates, or leave both blank.');
    if (hasLat && (!Number.isFinite(Number(form.latitude)) || Number(form.latitude) < -90 || Number(form.latitude) > 90 || !Number.isFinite(Number(form.longitude)) || Number(form.longitude) < -180 || Number(form.longitude) > 180)) return t('Enter valid GPS coordinates.');
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return t('Enter a valid email address.');
    return null;
  };

  const publish = async () => {
    const validationError = validate();
    if (validationError) { Alert.alert(t('Check listing details'), validationError); setReviewing(false); return; }
    if (!user?.id || !profile?.ward_id) { Alert.alert(t('Profile required'), t('Sign in with an approved leader profile assigned to a ward.')); return; }
    setSaving(true);
    try {
      let imageUrl = form.image_url || null;
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        setUploadingImage(true);
        [imageUrl] = await uploadReportImages([imageUrl]);
      }
      const payload = {
        name: form.name.trim(), category: form.category.trim(), description: form.description.trim(),
        contact_phone: form.contact_phone.trim(), email: trimOrNull(form.email),
        whatsapp_available: Boolean(form.whatsapp_available), whatsapp_phone: form.whatsapp_available ? trimOrNull(form.whatsapp_phone) : null,
        office_name: trimOrNull(form.office_name), office_address: trimOrNull(form.office_address),
        latitude: form.latitude.trim() ? Number(form.latitude) : null, longitude: form.longitude.trim() ? Number(form.longitude) : null,
        office_hours: trimOrNull(form.office_hours), image_url: imageUrl,
        additional_instructions: trimOrNull(form.additional_instructions), eligibility_requirements: trimOrNull(form.eligibility_requirements),
        ward_id: profile.ward_id, updated_at: new Date().toISOString(),
      };
      const supabase = getSupabaseClient();
      const request = editingId
        ? supabase.from('help_listings').update(payload).eq('id', editingId).select().single()
        : supabase.from('help_listings').insert({ ...payload, created_by: user.id, status: 'published' }).select().single();
      const { data, error: saveError } = await request;
      if (saveError) throw saveError;
      setListings((current) => editingId ? current.map((item) => item.id === editingId ? data : item) : [data, ...current]);
      setFormOpen(false);
      setReviewing(false);
      Alert.alert(t(editingId ? 'Listing updated' : 'Listing published'), t(editingId ? 'Your help listing was updated.' : 'Residents in your ward can now find this help listing.'));
    } catch (saveError) {
      console.error('Help listing save failed:', saveError);
      const message = saveError?.code === '23505'
        ? 'A listing with this name and assistance type already exists in your ward.'
        : saveError?.message || 'Check your connection and try again.';
      Alert.alert(t('Could not save listing'), t(message));
    } finally { setSaving(false); setUploadingImage(false); }
  };

  const changeStatus = async (listing) => {
    const status = listing.status === 'published' ? 'unpublished' : 'published';
    try {
      const { data, error: updateError } = await getSupabaseClient().from('help_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', listing.id).select().single();
      if (updateError) throw updateError;
      setListings((current) => current.map((item) => item.id === listing.id ? data : item));
    } catch (updateError) { Alert.alert(t('Could not update listing'), updateError?.message || t('Please try again.')); }
  };

  const removeListing = (listing) => Alert.alert(t('Remove listing?'), t('Remove {{name}} from Help Near You?', { name: listing.name }), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Remove'), style: 'destructive', onPress: async () => {
      try {
        const { error: deleteError } = await getSupabaseClient().from('help_listings').delete().eq('id', listing.id);
        if (deleteError) throw deleteError;
        setListings((current) => current.filter((item) => item.id !== listing.id));
      } catch (deleteError) { Alert.alert(t('Could not remove listing'), deleteError?.message || t('Please try again.')); }
    } },
  ]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const input = (key, label, options = {}) => <Input key={key} label={t(label)} value={form[key]} onChangeText={(value) => updateField(key, value)} colors={colors} {...options} />;

  return <>
    <Stack.Screen options={{ headerTransparent: true, headerTitle: '', headerShadowVisible: false, headerBackVisible: false, headerStyle: { backgroundColor: 'transparent' } }} />
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('Help Near You')} subtitle={t('Find support and services in your ward')} leftIcon="arrow-back" onLeftPress={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {offline && <View style={{ backgroundColor: colors.surface, padding: 11, borderRadius: 10, marginBottom: 12 }}><Text style={{ color: colors.textLight }}>{t('You appear to be offline. Listings may not be current.')}</Text></View>}
        {isLeader && <TouchableOpacity onPress={openNewForm} activeOpacity={0.85} style={{ backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 13, borderRadius: 12, marginBottom: 16 }}><Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} /><Text style={{ color: '#fff', fontWeight: '800' }}>{t('Add Help Listing')}</Text></TouchableOpacity>}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.surface : '#fff', borderRadius: 14, paddingHorizontal: 12, marginBottom: 13, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search-outline" size={20} color={colors.textLight} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('Search help and services')} placeholderTextColor={colors.textLight} style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 9, color: colors.text }} />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={colors.textLight} /></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 13 }}>
          {categories.map((category) => { const active = selectedCategory === category; return <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)} style={{ backgroundColor: active ? colors.primary : colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginRight: 7, borderWidth: active ? 0 : 1, borderColor: colors.border }}><Text style={{ color: active ? '#fff' : colors.text, fontWeight: active ? '800' : '500', fontSize: 12 }}>{category === 'All' ? t('All') : category}</Text></TouchableOpacity>; })}
        </ScrollView>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 }}>{t(isLeader ? 'Listings you manage' : 'Community Services')}</Text>
        <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 14 }}>{profile?.wardName ? t('Help available in your ward') + ` · ${profile.wardName}` : t('Help and services available in your ward')}</Text>
        {loading ? <View style={{ alignItems: 'center', paddingVertical: 42 }}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.textLight, marginTop: 10 }}>{t('Loading help listings…')}</Text></View>
          : error ? <View style={{ alignItems: 'center', paddingVertical: 28 }}><Ionicons name="cloud-offline-outline" size={38} color={colors.textLight} /><Text style={{ color: colors.text, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>{t(error)}</Text><TouchableOpacity onPress={() => load(true)} style={{ padding: 12 }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{t('Try again')}</Text></TouchableOpacity></View>
            : filteredListings.length === 0 ? <View style={{ alignItems: 'center', paddingVertical: 40 }}><Ionicons name="heart-outline" size={42} color={colors.textLight} /><Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 11 }}>{t(isLeader ? 'No listings yet' : 'No help listings yet')}</Text><Text style={{ color: colors.textLight, textAlign: 'center', marginTop: 6 }}>{t(isLeader ? 'Add a listing to share trusted help with residents in your ward.' : 'There are no published services in your ward yet. Check back later.')}</Text></View>
              : filteredListings.map((listing) => <View key={listing.id} style={{ backgroundColor: colors.surface, borderRadius: 17, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 }}>
                  {listing.image_url ? <Image accessibilityLabel={`${listing.name} image`} source={{ uri: listing.image_url }} style={{ width: 52, height: 52, borderRadius: 13, marginRight: 11 }} /> : <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}18`, marginRight: 11 }}><Ionicons name="heart-outline" size={24} color={colors.primary} /></View>}
                  <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{listing.name}</Text><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginTop: 3 }}>{listing.category}</Text></View>
                  {isLeader && <Text style={{ color: listing.status === 'published' ? colors.success : colors.textLight, fontSize: 11, fontWeight: '700' }}>{t(listing.status)}</Text>}
                </View>
                <Text numberOfLines={3} style={{ color: colors.textLight, lineHeight: 19, marginBottom: 9 }}>{listing.description}</Text>
                {!!listing.office_address && <Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, marginBottom: 7 }}><Ionicons name="location-outline" size={14} color={colors.primary} /> {listing.office_address}</Text>}
                <Text style={{ color: colors.text, fontSize: 12, marginBottom: 10 }}><Ionicons name="call-outline" size={14} color={colors.primary} /> {listing.contact_phone}</Text>
                <TouchableOpacity onPress={() => router.push({ pathname: '/helpnearyou/[id]', params: { id: listing.id } })} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{t('View details')}</Text></TouchableOpacity>
                {isLeader && <View style={{ flexDirection: 'row', gap: 8, marginTop: 9 }}>
                  <TouchableOpacity onPress={() => openEditForm(listing)} style={{ flex: 1, alignItems: 'center', padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('Edit')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => changeStatus(listing)} style={{ flex: 1, alignItems: 'center', padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t(listing.status === 'published' ? 'Unpublish' : 'Publish')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeListing(listing)} style={{ alignItems: 'center', padding: 9, borderWidth: 1, borderColor: colors.error, borderRadius: 9 }}><Ionicons name="trash-outline" size={18} color={colors.error} /></TouchableOpacity>
                </View>}
              </View>)}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScreenHeader title={t(reviewing ? 'Review Listing' : editingId ? 'Edit Help Listing' : 'Add Help Listing')} subtitle={t(reviewing ? 'Confirm these details before publishing' : 'Share trusted help with residents in your ward')} leftIcon="arrow-back" onLeftPress={() => reviewing ? setReviewing(false) : setFormOpen(false)} />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {!reviewing ? <>
              {input('name', 'Person or organisation name', { required: true })}{input('category', 'Type of assistance', { required: true, placeholder: t('e.g. Healthcare, food support') })}{input('description', 'Description', { required: true, multiline: true })}{input('contact_phone', 'Contact number', { required: true, keyboardType: 'phone-pad' })}{input('email', 'Email address', { keyboardType: 'email-address' })}
              <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 12 }}>{t('This listing will be published for residents in your assigned ward: {{ward}}.', { ward: profile?.wardName || profile?.ward_id || t('No ward assigned') })}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('WhatsApp assistance available')}</Text><Switch value={form.whatsapp_available} onValueChange={(value) => updateField('whatsapp_available', value)} trackColor={{ true: colors.primary }} /></View>
              {form.whatsapp_available && input('whatsapp_phone', 'WhatsApp number', { required: true, keyboardType: 'phone-pad' })}
              {input('office_name', 'Office name (optional)')}{input('office_address', 'Office address (optional)', { multiline: true })}{input('latitude', 'Latitude (optional)', { keyboardType: 'decimal-pad' })}{input('longitude', 'Longitude (optional)', { keyboardType: 'decimal-pad' })}{input('office_hours', 'Operating hours (optional)')}
              <TouchableOpacity onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 8 }}><Ionicons name="image-outline" size={21} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>{t(form.image_url ? 'Change listing image' : 'Add profile photo or logo (optional)')}</Text></TouchableOpacity>
              {form.image_url ? <Image source={{ uri: form.image_url }} style={{ width: 80, height: 80, borderRadius: 12, marginBottom: 12 }} /> : null}
              {input('eligibility_requirements', 'Eligibility requirements (optional)', { multiline: true })}{input('additional_instructions', 'Additional instructions (optional)', { multiline: true })}
              <TouchableOpacity onPress={() => { const validationError = validate(); if (validationError) Alert.alert(t('Check listing details'), validationError); else setReviewing(true); }} style={{ backgroundColor: colors.primary, borderRadius: 11, alignItems: 'center', padding: 13, marginTop: 6 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{t('Review before publishing')}</Text></TouchableOpacity>
            </> : <>
              {form.image_url ? <Image source={{ uri: form.image_url }} style={{ width: 92, height: 92, borderRadius: 16, marginBottom: 12 }} /> : null}
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800' }}>{form.name}</Text><Text style={{ color: colors.primary, fontWeight: '700', marginVertical: 6 }}>{form.category}</Text>
              {[['Description', form.description], ['Contact', form.contact_phone], ['Email', form.email], ['WhatsApp', form.whatsapp_available ? form.whatsapp_phone : t('Not available')], ['Office', [form.office_name, form.office_address].filter(Boolean).join(' · ')], ['Coordinates', form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : t('Not provided')], ['Hours', form.office_hours], ['Eligibility', form.eligibility_requirements], ['Additional instructions', form.additional_instructions]].filter(([, value]) => value).map(([label, value]) => <View key={label} style={{ paddingVertical: 9, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '700' }}>{t(label)}</Text><Text style={{ color: colors.text, lineHeight: 20, marginTop: 3 }}>{value}</Text></View>)}
              <TouchableOpacity disabled={saving || uploadingImage} onPress={publish} style={{ backgroundColor: colors.primary, borderRadius: 11, alignItems: 'center', padding: 13, marginTop: 18, opacity: saving ? 0.7 : 1 }}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{t(uploadingImage ? 'Uploading image…' : editingId ? 'Save Listing' : 'Publish Listing')}</Text>}</TouchableOpacity>
            </>}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  </>;
}
