import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getCurrentUser, getUserProfile } from '../config/supabase';
import colors from '../Utils/colors';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const user = await getCurrentUser();
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserName(profile?.firstName || '');
    }
    setLoading(false);
  };

  const features = [
    { name: 'PinPoint Address', icon: 'location', description: 'Generate & share your digital address', color: colors.accent, screen: 'pinpoint' },
    { name: 'Community Feed', icon: 'newspaper', description: 'Latest crime alerts & updates', color: colors.primary, screen: 'communityfeed' },
    { name: 'Emergency Request', icon: 'alert-circle', description: 'Request immediate help', color: colors.error, screen: 'emergencyrequest' },
    { name: 'Report Incident', icon: 'megaphone', description: 'Report crime or hazards', color: colors.warning, screen: 'incidentreport' },
  ];

  if (loading) {
    return (
      
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, padding: 24, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>Hello, {userName || 'Resident'}! 👋</Text>
        <Text style={{ fontSize: 14, color: '#fff', opacity: 0.8, marginTop: 8 }}>Your community is safer together</Text>
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', margin: 16, gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>24/7</Text>
          <Text style={{ fontSize: 12, color: colors.textLight }}>Community Alert</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="location" size={24} color={colors.accent} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>PinPoint</Text>
          <Text style={{ fontSize: 12, color: colors.textLight }}>Digital Address</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 }}>
          <Ionicons name="people" size={24} color={colors.accent} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>Active</Text>
          <Text style={{ fontSize: 12, color: colors.textLight }}>Community</Text>
        </View>
      </View>

      {/* Features Grid */}


      {/* Recent Alerts Preview */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>Recent Alerts</Text>
        <TouchableOpacity onPress={() => router.push('communityfeed')}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 14, color: colors.error, fontWeight: 'bold' }}>⚠️ Crime Alert</Text>
              <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>View all community updates →</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
