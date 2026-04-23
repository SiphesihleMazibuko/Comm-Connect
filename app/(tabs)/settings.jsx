import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function SettingsScreen({ navigation }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [anonymousDefault, setAnonymousDefault] = useState(false);
  const [language, setLanguage] = useState('en');
  const [userData, setUserData] = useState(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setNotificationsEnabled(data.permissions?.notificationsEnabled ?? true);
        setAnonymousDefault(data.permissions?.anonymousReportsDefault ?? false);
        setLanguage(data.language || 'en');
      }
    }
  };

  const updateSetting = async (key, value) => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        [key]: value
      });
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
            await signOut(auth);
          }
        }
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, children }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '10', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
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
          style={{ backgroundColor: colors.error, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32, marginBottom: 40, flexDirection: 'row', justifyContent: 'center', gap: 10 }}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Logout</Text>
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
                style={{ padding: 12, borderRadius: 8, backgroundColor: language === lang.code ? colors.accent + '20' : 'transparent', marginBottom: 8 }}
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
    </ScrollView>
  );
}