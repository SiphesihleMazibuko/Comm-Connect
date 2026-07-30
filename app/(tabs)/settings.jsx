import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BackIconButton from '../../components/BackIconButton';
import { getCurrentUser, getSupabaseClient, getUserProfile, updateRow } from '../../config/supabase';
import colors from '../../Utils/colors';
import { useRouter } from 'expo-router';

const emptyContact = {
  name: '',
  relationship: '',
  phone: '',
};

const getEmergencyContacts = (profile) => (
  Array.isArray(profile?.permissions?.emergencyContacts)
    ? profile.permissions.emergencyContacts
    : []
);

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [anonymousDefault, setAnonymousDefault] = useState(false);
  const [language, setLanguage] = useState('en');
  const [userData, setUserData] = useState(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [user, setUser] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactDraft, setContactDraft] = useState(emptyContact);
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const data = await getUserProfile(currentUser.id);
        setUserData(data);
        setNotificationsEnabled(data?.permissions?.notificationsEnabled ?? true);
        setAnonymousDefault(data?.permissions?.anonymousReportsDefault ?? false);
        setLanguage(data?.language || 'en');
        setEmergencyContacts(getEmergencyContacts(data));
      }
  };

  const updateSetting = async (key, value) => {
    if (user) {
      const updates = key.startsWith('permissions.')
        ? {
            permissions: {
              ...(userData?.permissions || {}),
              [key.replace('permissions.', '')]: value,
            },
          }
        : { [key]: value };

      await updateRow('users', user.id, updates);
      setUserData((previous) => ({ ...(previous || {}), ...updates }));
    }
  };

  const toggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    await updateSetting('permissions.notificationsEnabled', value);
  };

  const toggleAnonymousDefault = async (value) => {
    setAnonymousDefault(value);
    await updateSetting('permissions.anonymousReportsDefault', value);
  };

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    setShowLanguageModal(false);
    await updateSetting('language', lang);
    Alert.alert('Language Updated', `App language changed to ${lang === 'en' ? 'English' : lang === 'zu' ? 'isiZulu' : 'Sesotho'}`);
  };

  const saveEmergencyContacts = async (contacts) => {
    if (!user) return;
    const permissions = {
      ...(userData?.permissions || {}),
      emergencyContacts: contacts,
    };

    await updateRow('users', user.id, { permissions });
    setEmergencyContacts(contacts);
    setUserData((previous) => ({ ...(previous || {}), permissions }));
  };

  const addEmergencyContact = async () => {
    if (!contactDraft.name.trim()) {
      Alert.alert('Missing Name', 'Please enter a contact name.');
      return;
    }

    if (!contactDraft.phone.trim()) {
      Alert.alert('Missing Phone Number', 'Please enter the phone number that should receive the SOS SMS.');
      return;
    }

    setSavingContact(true);

    try {
      const nextContacts = [
        ...emergencyContacts,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: contactDraft.name.trim(),
          relationship: contactDraft.relationship.trim(),
          phone: contactDraft.phone.trim(),
        },
      ];

      await saveEmergencyContacts(nextContacts);
      setContactDraft(emptyContact);
      setShowContactModal(false);
      Alert.alert('Contact Saved', 'This contact will be notified when you trigger SOS.');
    } catch (error) {
      console.error('Error saving emergency contact:', error);
      Alert.alert('Error', 'Failed to save emergency contact.');
    } finally {
      setSavingContact(false);
    }
  };

  const removeEmergencyContact = (contactId) => {
    Alert.alert(
      'Remove Contact',
      'Remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveEmergencyContacts(emergencyContacts.filter((contact) => contact.id !== contactId));
            } catch (error) {
              console.error('Error removing emergency contact:', error);
              Alert.alert('Error', 'Failed to remove emergency contact.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const client = getSupabaseClient();
            await client.auth.signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, children }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 12, color: colors.textLight }}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BackIconButton />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, padding: 24, alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 40 }}>👤</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>{userData?.firstName} {userData?.lastName}</Text>
        <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8 }}>{userData?.email}</Text>
        <Text style={{ fontSize: 12, color: colors.accent, marginTop: 5 }}>Role: {userData?.role || 'Resident'}</Text>
      </View>

      <View style={{ padding: 16 }}>
        {/* Preferences Section */}
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 8 }}>PREFERENCES</Text>
        
        <SettingItem icon="notifications" title="Push Notifications" subtitle="Receive alerts and updates">
          <Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ false: colors.border, true: colors.accent }} />
        </SettingItem>

        <SettingItem icon="eye-off" title="Anonymous Reporting" subtitle="Default to anonymous when reporting incidents">
          <Switch value={anonymousDefault} onValueChange={toggleAnonymousDefault} trackColor={{ false: colors.border, true: colors.accent }} />
        </SettingItem>

        <SettingItem icon="language" title="Language" subtitle={language === 'en' ? 'English' : language === 'zu' ? 'isiZulu' : 'Sesotho'}>
          <TouchableOpacity onPress={() => setShowLanguageModal(true)}>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 24 }}>SOS CONTACTS</Text>

        <View>
          {emergencyContacts.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="people-outline" size={34} color={colors.textLight} />
              <Text style={{ color: colors.textLight, marginTop: 8, textAlign: 'center' }}>No emergency contacts yet. SOS will open SMS with the live tracking link.</Text>
            </View>
          ) : (
            emergencyContacts.map((contact) => (
              <View key={contact.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{contact.name}</Text>
                    <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{contact.relationship || 'Emergency contact'}{contact.phone ? ` · ${contact.phone}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeEmergencyContact(contact.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            onPress={() => setShowContactModal(true)}
          >
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add Emergency Contact</Text>
          </TouchableOpacity>
        </View>

        {/* Security Section */}
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 24 }}>SECURITY</Text>

        <SettingItem icon="lock-closed" title="Change Password" subtitle="Update your password">
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        <SettingItem icon="shield-checkmark" title="Privacy Policy" subtitle="How we protect your data">
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        {/* Support Section */}
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 24 }}>SUPPORT</Text>

        <SettingItem icon="help-circle" title="Help Center" subtitle="FAQs and support guides">
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        <SettingItem icon="chatbubbles" title="Contact Support" subtitle="Get help from our team">
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        <SettingItem icon="information-circle" title="About Comm-Connect" subtitle="Version 1.0.0">
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </SettingItem>

        {/* Logout Button */}
        <TouchableOpacity
          style={{ backgroundColor: colors.error, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 10 }}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '80%' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Select Language</Text>
            {[
              { code: 'en', name: 'English' },
              { code: 'zu', name: 'isiZulu' },
              { code: 'st', name: 'Sesotho' }
            ].map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={{ padding: 12, borderRadius: 8, backgroundColor: language === lang.code ? colors.accentSoft : 'rgba(255,255,255,0)', marginBottom: 8 }}
                onPress={() => changeLanguage(lang.code)}
              >
                <Text style={{ fontSize: 16, color: language === lang.code ? colors.accent : colors.text, textAlign: 'center' }}>
                  {lang.name} {language === lang.code && '✓'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showContactModal} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 18, width: '100%', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Add Emergency Contact</Text>

            <TextInput
              style={{ backgroundColor: colors.surfaceRaised, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 }}
              placeholder="Name"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              value={contactDraft.name}
              onChangeText={(value) => setContactDraft((previous) => ({ ...previous, name: value }))}
            />
            <TextInput
              style={{ backgroundColor: colors.surfaceRaised, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 }}
              placeholder="Relationship"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              value={contactDraft.relationship}
              onChangeText={(value) => setContactDraft((previous) => ({ ...previous, relationship: value }))}
            />
            <TextInput
              style={{ backgroundColor: colors.surfaceRaised, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 }}
              placeholder="Phone number"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              keyboardType="phone-pad"
              value={contactDraft.phone}
              onChangeText={(value) => setContactDraft((previous) => ({ ...previous, phone: value }))}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  setContactDraft(emptyContact);
                  setShowContactModal(false);
                }}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={addEmergencyContact}
                disabled={savingContact}
              >
                {savingContact ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
}
