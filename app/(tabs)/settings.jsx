import {
  Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect,
  useState } from 'react';
import { ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getSupabaseClient, getUserProfile, updateRow } from '../../config/supabase';
import colors from '../../Utils/colors';

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

const getRoleLabel = (role) => {
  if (role === 'community_protection_service' || role === 'emergency_responder') return 'Community Protection Services';
  if (role === 'community_leader' || role === 'leader') return 'Community Leader';
  return 'Resident';
};

export default function SettingsScreen() {
  const router = useRouter();
  const [anonymousDefault, setAnonymousDefault] = useState(false);
  const [userData, setUserData] = useState(null);
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
      setAnonymousDefault(data?.permissions?.anonymousReportsDefault ?? false);
      setEmergencyContacts(getEmergencyContacts(data));
    }
  };

  const updateSetting = async (key, value) => {
    if (!user) return;

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
  };

  const toggleAnonymousDefault = async (value) => {
    setAnonymousDefault(value);
    await updateSetting('permissions.anonymousReportsDefault', value);
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
      ],
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
          },
        },
      ],
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
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title={`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Settings'}
          subtitle={userData?.email || 'Manage your account'}
          meta={`Role: ${getRoleLabel(userData?.role)}`}
          icon="person"
        />

        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 8 }}>PREFERENCES</Text>

          <SettingItem icon="eye-off" title="Anonymous Reporting" subtitle="Default to anonymous when reporting incidents">
            <Switch value={anonymousDefault} onValueChange={toggleAnonymousDefault} trackColor={{ false: colors.border, true: colors.accent }} />
          </SettingItem>

          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textLight, marginBottom: 12, marginTop: 24 }}>SOS CONTACTS</Text>

          <View>
            {emergencyContacts.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="people-outline" size={34} color={colors.textLight} />
                <Text style={{ color: colors.textLight, marginTop: 8, textAlign: 'center' }}>No emergency contacts yet. Add at least one contact before using SOS.</Text>
              </View>
            ) : (
              emergencyContacts.map((contact) => (
                <View key={contact.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{contact.name}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{contact.relationship || 'Emergency contact'}{contact.phone ? ` - ${contact.phone}` : ''}</Text>
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

          <TouchableOpacity
            style={{ backgroundColor: colors.error, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>LOGOUT</Text>
          </TouchableOpacity>
        </View>

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
