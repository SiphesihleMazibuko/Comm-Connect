import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import ScreenHeader from '../../components/ScreenHeader';

import { getCurrentUser, getSupabaseClient, getUserProfile, updateRow } from '../../config/supabase';

import { useTheme } from '../context/ThemeContext';

const EMPTY_CONTACT = { name: '', relationship: '', phone: '' };

const getProfileEmergencyContacts = (profile) => (
  Array.isArray(profile?.permissions?.emergencyContacts) ? profile.permissions.emergencyContacts : []
);

const getRoleLabel = (role) => {
  if (role === 'community_protection_service' || role === 'emergency_responder') {
    return 'Community Protection Services';
  }

  if (role === 'community_leader' || role === 'leader') {
    return 'Community Leader';
  }

  return 'Resident';
};

const normalizePhoneNumber = (countryCode, phoneNumber) => {
  const trimmedPhone = phoneNumber.trim();
  if (trimmedPhone.startsWith('+')) return trimmedPhone.replace(/\s/g, '');
  return `${countryCode}${trimmedPhone.replace(/\s/g, '').replace(/^0+/, '')}`;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anonymousDefault, setAnonymousDefault] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactDraft, setContactDraft] = useState(EMPTY_CONTACT);
  const [savingContact, setSavingContact] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { loadUserSettings(); }, []);

  const loadUserSettings = async () => {
    try {
      setLoading(true);

      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (!currentUser?.id) return;

      const profile = await getUserProfile(currentUser.id);

      setUserData(profile);

      setAnonymousDefault(profile?.permissions?.anonymousReportsDefault ?? false);
      setEmergencyContacts(getEmergencyContacts(profile));
    } catch (error) {
      if (error?.name === 'AuthSessionMissingError') {
        console.log('[SETTINGS] No authentication session. User is logged out.');
        return;
      }

      console.error('[SETTINGS] Failed to load settings:', error);
      Alert.alert('Error', 'Unable to load your settings.');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    if (!user?.id) return;

    const isPermissionSetting = key.startsWith('permissions.');
    const permissionKey = key.replace('permissions.', '');

    const updates = isPermissionSetting
      ? { permissions: { ...(userData?.permissions || {}), [permissionKey]: value } }
      : { [key]: value };

    await updateRow('users', user.id, updates);

    setUserData((previous) => ({ ...(previous || {}), ...updates }));
  };

  const toggleAnonymousDefault = async (value) => {
    const previousValue = anonymousDefault;

    setAnonymousDefault(value);

    try {
      await updateSetting('permissions.anonymousReportsDefault', value);
    } catch (error) {
      console.error('[SETTINGS] Anonymous reporting update failed:', error);

      setAnonymousDefault(previousValue);

      Alert.alert('Error', 'Failed to update anonymous reporting setting.');
    }
  };

  const addEmergencyContact = async () => {
    const name = contactDraft.name.trim();
    const relationship = contactDraft.relationship.trim();
    const phone = contactDraft.phone.trim();
    if (!name) { Alert.alert('Missing Name', 'Please enter the contact name.'); return; }
    if (!phone) { Alert.alert('Missing Phone Number', 'Please enter the phone number that should receive the SOS SMS.'); return; }
    setSavingContact(true);

    try {
      const newContact = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, relationship, phone };
      const updatedContacts = [...emergencyContacts, newContact];
      await saveEmergencyContacts(updatedContacts);
      setContactDraft(EMPTY_CONTACT);
      setShowContactModal(false);

      Alert.alert('Contact Saved', `${name} has been added as an emergency contact.`);
    } catch (error) {
      console.error('[SETTINGS] Add emergency contact failed:', error);

      Alert.alert('Error', 'Failed to save emergency contact.');
    } finally {
      setSavingContact(false);
    }
  };

  const removeEmergencyContact = (contactId) => {
    Alert.alert('Remove Contact', 'Are you sure you want to remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const updatedContacts = emergencyContacts.filter((contact) => contact.id !== contactId);
          await saveEmergencyContacts(updatedContacts);
        } catch (error) {
          console.error('[SETTINGS] Remove emergency contact failed:', error);
          Alert.alert('Error', 'Failed to remove emergency contact.');
        }
      }},
    ]);
  };

  const performLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const client = getSupabaseClient();

      console.log('[LOGOUT] Starting logout...');

      const { data: { session }, error: sessionError } = await client.auth.getSession();

      if (sessionError) {
        console.warn('[LOGOUT] Could not read current session:', sessionError);
      }

      console.log('[LOGOUT] Current session:', session ? 'exists' : 'none');

      if (!session) {
        console.log('[LOGOUT] No active session. Redirecting to login...');
        router.replace('/login');
        return;
      }

      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });

      if (signOutError) {
        console.error('[LOGOUT] Supabase signOut error:', signOutError);
        router.replace('/login');
        return;
      }

      console.log('[LOGOUT] Supabase signOut successful.');

      setUser(null);
      setUserData(null);

      router.replace('/login');

      console.log('[LOGOUT] Redirected to login.');
    } catch (error) {
      console.error('[LOGOUT] Logout failed:', error);

      if (error?.name === 'AuthSessionMissingError') {
        console.log('[LOGOUT] Session was already cleared.');
        router.replace('/login');
        return;
      }

      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: performLogout },
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, children }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>

      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4, lineHeight: 17 }}>{subtitle}</Text> : null}
      </View>

      {children}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textLight, fontSize: 14 }}>Loading settings...</Text>
      </View>
    );
  }

  const fullName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim();
  const roleLabel = getRoleLabel(userData?.role);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title={fullName || 'Settings'}
          subtitle={userData?.email || 'Manage your account'}
          meta={`Role: ${roleLabel}`}
          icon="person"
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight, marginTop: 8, marginBottom: 10, letterSpacing: 0.7 }}>
            ACCOUNT
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 24 }}>
            <SettingItem icon="person-outline" title="Name" subtitle={fullName || 'No name available'}>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </SettingItem>

            <SettingItem icon="mail-outline" title="Email" subtitle={userData?.email || user?.email || 'No email available'}>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </SettingItem>

            <SettingItem icon="shield-checkmark-outline" title="Account Role" subtitle={roleLabel}>
              <Ionicons name="checkmark-circle" size={19} color={colors.success} />
            </SettingItem>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight, marginBottom: 10, letterSpacing: 0.7 }}>
            PREFERENCES
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 24 }}>
            <SettingItem icon={isDark ? 'moon' : 'sunny'} title="Dark Mode" subtitle={isDark ? 'Dark theme enabled' : 'Light theme enabled'}>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.border}
              />
            </SettingItem>

            <SettingItem icon="eye-off-outline" title="Anonymous Reporting" subtitle="Default to anonymous when reporting incidents">
              <Switch
                value={anonymousDefault}
                onValueChange={toggleAnonymousDefault}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.border}
              />
            </SettingItem>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textLight, marginBottom: 10, letterSpacing: 0.7 }}>
            SOS CONTACTS
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.errorLight || `${colors.error}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="call" size={21} color={colors.error} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Emergency Contacts</Text>
                <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 3, lineHeight: 17 }}>
                  These contacts can receive your SOS emergency message.
                </Text>
              </View>
            </View>

            {emergencyContacts.length === 0 ? (
              <View style={{ backgroundColor: colors.surfaceSoft || colors.primaryLight, borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="people-outline" size={32} color={colors.textLight} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
                  No emergency contacts
                </Text>
                <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
                  Add at least one emergency contact before using SOS.
                </Text>
              </View>
            ) : (
              emergencyContacts.map((contact) => (
                <View key={contact.id} style={{ backgroundColor: colors.surfaceSoft || colors.background, borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Ionicons name="person" size={19} color={colors.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{contact.name}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{contact.relationship || 'Emergency contact'}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 2 }}>{contact.phone}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeEmergencyContact(contact.id)}
                      style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorLight || `${colors.error}15` }}
                    >
                      <Ionicons name="trash-outline" size={19} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              onPress={() => {
                setContactDraft(EMPTY_CONTACT);
                setShowContactModal(true);
              }}
              style={{ backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 3 }}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Add Emergency Contact</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={{ backgroundColor: colors.error, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginBottom: 10, opacity: loggingOut ? 0.7 : 1 }}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={21} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>LOGOUT</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', color: colors.textLight, fontSize: 11, marginTop: 5 }}>Comm-Connect</Text>
        </View>

        <Modal
          visible={showContactModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setContactDraft(EMPTY_CONTACT);
            setShowContactModal(false);
            setShowCountryPicker(false);
            setCountrySearch('');
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ width: '100%', maxWidth: 500, backgroundColor: colors.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                  <Ionicons name="person-add" size={21} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Add Emergency Contact</Text>
                  <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>This contact can receive SOS notifications.</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setContactDraft(EMPTY_CONTACT);
                    setShowContactModal(false);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                  style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>NAME</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceLight || colors.background, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, fontSize: 14 }}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={colors.inputPlaceholder || colors.textLight}
                selectionColor={colors.primary}
                value={contactDraft.name}
                onChangeText={(value) => setContactDraft((previous) => ({ ...previous, name: value }))}
                autoCapitalize="words"
              />

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>RELATIONSHIP</Text>
              <TextInput
                style={{ backgroundColor: colors.surfaceLight || colors.background, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, fontSize: 14 }}
                placeholder="e.g. Mother, Partner, Friend"
                placeholderTextColor={colors.inputPlaceholder || colors.textLight}
                selectionColor={colors.primary}
                value={contactDraft.relationship}
                onChangeText={(value) => setContactDraft((previous) => ({ ...previous, relationship: value }))}
                autoCapitalize="words"
              />

              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>PHONE NUMBER</Text>
              <TextInput style={{ backgroundColor: colors.surfaceLight || colors.background, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 18, fontSize: 14 }} placeholder="+27 82 123 4567" placeholderTextColor={colors.inputPlaceholder || colors.textLight} selectionColor={colors.primary} keyboardType="phone-pad" value={contactDraft.phone} onChangeText={(value) => setContactDraft((previous) => ({ ...previous, phone: value }))} autoComplete="tel" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setContactDraft(EMPTY_CONTACT);
                    setShowContactModal(false);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                  style={{ flex: 1, backgroundColor: colors.surfaceLight || colors.background, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addEmergencyContact}
                  disabled={savingContact}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', opacity: savingContact ? 0.7 : 1 }}
                >
                  {savingContact ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Save Contact</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}
