import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import ScreenHeader from '../../components/ScreenHeader';
import WalkMapPreview from '../../components/WalkMapPreview';
import { getCurrentUser, getRows, getSupabaseClient, getUserProfile, subscribeToTable } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { searchOpenStreetMapAddress } from '../../Utils/openStreetMapLocation';

const validPoint = (point) => Number.isFinite(Number(point.latitude)) && Number(point.latitude) >= -90 && Number(point.latitude) <= 90 && Number.isFinite(Number(point.longitude)) && Number(point.longitude) >= -180 && Number(point.longitude) <= 180;
const statusLabel = (status, t) => t(({ pending: 'Finding a CPF member', accepted: 'Accepted', member_on_way: 'CPF member on the way', in_progress: 'Walk in progress', completed: 'Completed', cancelled: 'Cancelled', declined: 'No CPF member accepted' }[status] || status));

function LocationFields({ title, point, setPoint, colors, currentLocation, onUseCurrent, t, allowMap = true }) {
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const change = (key, value) => setPoint((old) => ({ ...old, [key]: value }));
  const search = async () => {
    setSearching(true);
    try {
      const result = await searchOpenStreetMapAddress(point.label);
      setPoint((old) => ({ ...old, ...result }));
    }
    catch (error) {
      Alert.alert(t('Address search'), `${error?.message || t('Could not find that address.')} ${t('You can select the location on the map instead.')}`);
    }
    finally { setSearching(false); }
  };
  const parsed = { latitude: Number(point.latitude), longitude: Number(point.longitude) };
  const hasPoint = validPoint(parsed);
  const mapPoint = hasPoint ? parsed : { latitude: -29.0, longitude: 24.0 };
  const selectMapPoint = ({ latitude, longitude }) => {
    setPoint((old) => ({
      ...old,
      latitude: String(latitude),
      longitude: String(longitude),
      label: old.label.trim() || `${title === t('Destination') ? t('Pinned destination') : t('Pinned starting point')} (${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)})`,
    }));
  };
  return <View style={{ marginBottom: 16 }}>
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>{t(title)}</Text>
    <TextInput accessibilityLabel={`${title} address`} value={point.label} onChangeText={(value) => change('label', value)} placeholder={t('Address or place description')} placeholderTextColor={colors.textLight} style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 8 }} />
    <TouchableOpacity onPress={search} disabled={searching || !point.label.trim()} style={{ paddingVertical: 7, opacity: searching || !point.label.trim() ? 0.55 : 1 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{searching ? 'Searching…' : 'Find coordinates for this address'}</Text></TouchableOpacity>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput accessibilityLabel={`${title} latitude`} value={String(point.latitude ?? '')} onChangeText={(value) => change('latitude', value)} keyboardType="decimal-pad" placeholder={t('Latitude')} placeholderTextColor={colors.textLight} style={{ flex: 1, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 10 }} />
      <TextInput accessibilityLabel={`${title} longitude`} value={String(point.longitude ?? '')} onChangeText={(value) => change('longitude', value)} keyboardType="decimal-pad" placeholder={t('Longitude')} placeholderTextColor={colors.textLight} style={{ flex: 1, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 10 }} />
    </View>
    {title === t('Starting point') && <TouchableOpacity onPress={onUseCurrent} style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}><Ionicons name="locate" size={18} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 7 }}>{currentLocation ? t('Use my current location') : t('Get my current location')}</Text></TouchableOpacity>}
    {allowMap && <>
      <TouchableOpacity accessibilityRole="button" onPress={() => setMapOpen((open) => !open)} style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="map-outline" size={18} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 7 }}>{mapOpen ? t('Close map') : hasPoint ? t('Adjust location on map') : t('Choose location on map')}</Text>
      </TouchableOpacity>
      {mapOpen && <>
        <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 2 }}>{t('Tap the map to drop the {{point}} pin.', { point: title === t('Destination') ? t('destination') : t('starting point') })}</Text>
        <WalkMapPreview point={mapPoint} colors={colors} onSelect={selectMapPoint} />
      </>}
    </>}
  </View>;
}

export default function WalkWithMeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [walks, setWalks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [start, setStart] = useState({ label: '', latitude: '', longitude: '' });
  const [destination, setDestination] = useState({ label: '', latitude: '', longitude: '' });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [latestLocation, setLatestLocation] = useState(null);
  const [eligible, setEligible] = useState([]);
  const activeWalk = walks.find((walk) => ['pending', 'accepted', 'member_on_way', 'in_progress'].includes(walk.status));
  const activeWalkId = activeWalk?.id;
  const activeWalkStatus = activeWalk?.status;
  const activeWalkMemberId = activeWalk?.assigned_member_id;

  const load = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      if (!current) return;
      const profileData = await getUserProfile(current.id); setProfile(profileData);
      if (profileData?.role !== 'resident') { router.replace('/(tabs)/communityfeed'); return; }
      const [requests, emergencyContacts] = await Promise.all([
        getRows('walk_requests', { filters: { resident_id: current.id }, order: [{ column: 'created_at', ascending: false }] }),
        getRows('emergency_contacts', { filters: { userId: current.id }, order: [{ column: 'createdAt', ascending: false }] }),
      ]);
      const rows = requests || [];
      const decoratedRows = await Promise.all(rows.map(async (walk) => {
        if (!walk.assigned_member_id) return walk;
        const { data } = await getSupabaseClient().rpc('walk_assigned_member', { p_walk_id: walk.id });
        return { ...walk, member_name: data?.[0]?.member_name || null, member_ward: data?.[0]?.ward_name || null };
      }));
      setWalks(decoratedRows); setContacts(emergencyContacts || []);
      if (profileData?.ward_id) {
        const { data, error } = await getSupabaseClient().rpc('walk_eligible_members', { p_ward_id: profileData.ward_id });
        if (error) throw error;
        setEligible(data || []);
      }
    } catch (error) { console.error('WalkWithMe load failed:', error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { Promise.resolve().then(load); const unsub = subscribeToTable('walk_requests', load); return () => unsub?.(); }, [load]);
  useEffect(() => {
    if (!activeWalkId || activeWalkStatus !== 'in_progress' || !activeWalkMemberId) return undefined;
    let alive = true;
    const fetchLocation = async () => {
      try {
        const { data, error } = await getSupabaseClient().from('walk_locations').select('*').eq('walk_id', activeWalkId).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (alive && data) setLatestLocation(data);
      } catch (error) { console.warn('Walk location is currently unavailable:', error?.message); }
    };
    fetchLocation(); const interval = setInterval(fetchLocation, 10000);
    const unsubscribe = subscribeToTable('walk_locations', fetchLocation);
    return () => { alive = false; clearInterval(interval); unsubscribe?.(); };
  }, [activeWalkId, activeWalkStatus, activeWalkMemberId]);

  const useCurrent = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(permission.status === 'granted');
      if (permission.status !== 'granted') { Alert.alert(t('Location permission needed'), t('Allow location access while using Comm-Connect, or enter coordinates manually.')); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setStart((old) => ({ ...old, latitude: String(latitude), longitude: String(longitude), label: old.label || t('My current location') }));
      setLatestLocation({ latitude, longitude });
    } catch { Alert.alert(t('Location unavailable'), t('Enter your starting address and coordinates manually.')); }
  };

  const submit = async () => {
    if (!start.label.trim() || !destination.label.trim() || !validPoint(start) || !validPoint(destination)) { Alert.alert(t('Check the route'), t('Add a starting point and destination with valid latitude and longitude coordinates.')); return; }
    setSaving(true);
    try {
      const { data, error } = await getSupabaseClient().rpc('create_walk_request', {
        p_start_label: start.label, p_start_latitude: Number(start.latitude), p_start_longitude: Number(start.longitude),
        p_destination_label: destination.label, p_destination_latitude: Number(destination.latitude), p_destination_longitude: Number(destination.longitude),
        p_notes: notes || null, p_emergency_contact_ids: selectedContacts,
      });
      if (error) throw error;
      setWalks((previous) => [data, ...previous]); setFormOpen(false); setConfirmed(false);
      Alert.alert(t('Walk request sent'), t(eligible.length ? 'CPF members on duty in your ward can now respond.' : 'Your request is saved, but there are currently no eligible CPF members. You can refresh to check again.'));
    } catch (error) { Alert.alert(t('Request not sent'), error?.message || t('Check your connection and try again.')); }
    finally { setSaving(false); }
  };
  const cancel = async (walk) => {
    try { const { error } = await getSupabaseClient().rpc('transition_walk', { p_walk_id: walk.id, p_status: 'cancelled', p_reason: null }); if (error) throw error; await load(); }
    catch (error) { Alert.alert(t('Could not cancel'), error?.message || t('Please try again.')); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />} contentContainerStyle={{ paddingBottom: 28 }}>
      <ScreenHeader title={t('WalkWithMe')} subtitle={t('A trusted CPF member can accompany you safely.')} icon="walk" leftIcon="arrow-back" onLeftPress={() => router.replace('/(tabs)/communityfeed')} />
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        {!formOpen && <>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{t('Request a Walk')}</Text>
            <Text style={{ color: colors.textLight, lineHeight: 20, marginTop: 6, marginBottom: 13 }}>{t('Request a trusted CPF member to accompany you safely to your destination.')}</Text>
            <TouchableOpacity disabled={!!activeWalk} onPress={() => { setFormOpen(true); setConfirmed(false); }} style={{ backgroundColor: activeWalk ? colors.textLight : colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: 'center', opacity: activeWalk ? 0.65 : 1 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{activeWalk ? t('Active request in progress') : t('Request a Walk')}</Text></TouchableOpacity>
            {profile?.ward_id && <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 9 }}>{t('Eligible CPF members on duty in your ward: {{count}}', { count: eligible.length })}</Text>}
            {!!eligible.length && <View style={{ marginTop: 11 }}><Text style={{ color: colors.text, fontWeight: '700', marginBottom: 7 }}>{t('CPF members currently available')}</Text>{eligible.map((member) => <View key={member.member_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderColor: colors.border }}><Ionicons name="person-circle-outline" size={24} color={colors.accent}/><View style={{ marginLeft: 8 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{member.member_name || t('CPF Member')}</Text><Text style={{ color: colors.textLight, fontSize: 11 }}>{member.ward_name || t('Your ward')} · On duty · Available</Text></View></View>)}</View>}
          </View>
          {!!activeWalk && <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: colors.accent, marginBottom: 13 }}>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 16 }}>{statusLabel(activeWalk.status, t)}</Text>
            <Text style={{ color: colors.text, marginTop: 8 }}>{t('From: ')}{activeWalk.start_label}</Text><Text style={{ color: colors.text, marginTop: 3 }}>{t('To: ')}{activeWalk.destination_label}</Text>
            {activeWalk.status === 'in_progress' && <><Text style={{ color: colors.textLight, marginTop: 8 }}>{<>{t('Live tracking is foreground only while the CPF member keeps Comm-Connect open. ')}{latestLocation ? t('Last update {{time}}.', { time: new Date(latestLocation.recorded_at).toLocaleTimeString() }) : t('Waiting for a location update.')}</>}</Text>{latestLocation && <WalkMapPreview mode="route" start={{ latitude: activeWalk.start_latitude, longitude: activeWalk.start_longitude }} destination={{ latitude: activeWalk.destination_latitude, longitude: activeWalk.destination_longitude }} current={{ latitude: latestLocation.latitude, longitude: latestLocation.longitude }} colors={colors}/>}</>}
            {!!activeWalk.assigned_member_id && <Text style={{ color: colors.textLight, marginTop: 8 }}>{t('Assigned CPF member: ')}{activeWalk.member_name || t('Assigned CPF member')}{activeWalk.member_ward ? ` · ${activeWalk.member_ward}` : ''}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}><TouchableOpacity onPress={() => router.push('/(tabs)/pinpoint')} style={{ flex: 1, backgroundColor: colors.error, borderRadius: 9, padding: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{t('SOS')}</Text></TouchableOpacity><TouchableOpacity onPress={() => Alert.alert(t('Cancel walk?'), t('Your CPF member will be notified when the request is cancelled.'), [{ text: t('Keep walk'), style: 'cancel' }, { text: t('Cancel walk'), style: 'destructive', onPress: () => cancel(activeWalk) }])} style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 12, alignItems: 'center' }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('Cancel request')}</Text></TouchableOpacity></View>
          </View>}
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 9 }}>{t('Walk request history')}</Text>
          {!walks.length ? <Text style={{ color: colors.textLight, paddingVertical: 15 }}>{t('No previous walk requests.')}</Text> : walks.map((walk) => <View key={walk.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '700' }}>{statusLabel(walk.status, t)}</Text><Text style={{ color: colors.textLight, marginTop: 4 }} numberOfLines={2}>{walk.start_label} → {walk.destination_label}</Text><Text style={{ color: colors.textLight, fontSize: 11, marginTop: 4 }}>{new Date(walk.created_at).toLocaleString()}</Text></View>)}
        </>}
        {formOpen && <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border }}>
          {!confirmed ? <>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, marginBottom: 12 }}>{t('Plan your walk')}</Text>
            <LocationFields title={t('Starting point')} point={start} setPoint={setStart} colors={colors} currentLocation={locationGranted} onUseCurrent={useCurrent} t={t}/>
            <LocationFields title={t('Destination')} point={destination} setPoint={setDestination} colors={colors} t={t}/>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 7 }}>{t('Notes for your CPF member (optional)')}</Text>
            <TextInput value={notes} onChangeText={setNotes} multiline placeholder={t('Anything your CPF member should know')} placeholderTextColor={colors.textLight} style={{ color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 11, minHeight: 75, textAlignVertical: 'top', marginBottom: 14 }}/>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 5 }}>{t('Emergency contacts (optional)')}</Text>
            <Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>{t('Your selection is saved with the request. Contacts cannot currently view live location or receive walk notifications because the app has no authenticated contact access or delivery service configured.')}</Text>
            {contacts.length ? contacts.map((contact) => { const checked = selectedContacts.includes(contact.id); return <TouchableOpacity key={contact.id} onPress={() => setSelectedContacts((list) => checked ? list.filter((id) => id !== contact.id) : [...list, contact.id])} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? colors.accent : colors.textLight}/><Text style={{ color: colors.text, marginLeft: 8 }}>{contact.name} · {contact.phone}</Text></TouchableOpacity>; }) : <Text style={{ color: colors.textLight, marginBottom: 12 }}>{t('No registered contacts. Add contacts in Settings.')}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><TouchableOpacity onPress={() => setFormOpen(false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', padding: 12 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('Back')}</Text></TouchableOpacity><TouchableOpacity onPress={() => { if (!validPoint(start) || !start.label.trim() || !validPoint(destination) || !destination.label.trim()) { Alert.alert(t('Route details needed'), t('Enter a label and valid coordinates for both points.')); return; } setConfirmed(true); }} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', padding: 12 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{t('Review request')}</Text></TouchableOpacity></View>
          </> : <>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t('Confirm your walk request')}</Text><Text style={{ color: colors.textLight, lineHeight: 20, marginVertical: 10 }}>{t('Route and notes are shared with on-duty CPF members in your ward. Emergency contacts cannot view the walk or receive notifications. The assigned member shares live location after the walk starts.')}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('From: ')}{start.label} ({Number(start.latitude).toFixed(5)}, {Number(start.longitude).toFixed(5)})</Text><Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>{t('To: ')}{destination.label} ({Number(destination.latitude).toFixed(5)}, {Number(destination.longitude).toFixed(5)})</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}><TouchableOpacity disabled={saving} onPress={() => setConfirmed(false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', padding: 12 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('Edit')}</Text></TouchableOpacity><TouchableOpacity disabled={saving} onPress={submit} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', padding: 12 }}>{saving ? <ActivityIndicator color="#fff"/> : <Text style={{ color: '#fff', fontWeight: '800' }}>{t('Send request')}</Text>}</TouchableOpacity></View>
          </>}
        </View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
