import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getCurrentUser, getSupabaseClient, getUserProfile } from '../../config/supabase';
import colors from '../../Utils/colors';

export default function TabLayout() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserRole = async (user) => {
      if (!user) {
        setLoading(false);
        router.replace('/login');
        return;
      }

      let fetchedRole = null;
      let attempts = 0;

      while (!fetchedRole && attempts < 5) {
        try {
          const profile = await getUserProfile(user.id);
          if (profile?.role) {
            fetchedRole = profile.role;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
        attempts++;
      }

      if (fetchedRole) {
        setRole(fetchedRole);
      } else {
        router.replace('/login');
      }

      setLoading(false);
    };

    const client = getSupabaseClient();

    getCurrentUser().then((currentUser) => loadUserRole(currentUser));

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      loadUserRole(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading || !role) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isResident = role === 'resident';
  const isLeader = role === 'community_leader';
  const isResponder = role === 'emergency_responder';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      {/* ─── Shared: Community Feed ─────────────────────────────────────────────
          Residents and Leaders land here as "Home".
          Hidden from responders — they have their own home tab below.       */}
      <Tabs.Screen
        name="communityfeed"
        options={{
          title: 'Home',
          href: isResident || isLeader ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Responder: Home (Emergency Responder Dashboard) ────────────────────
          This is the "Home" tab exclusively for emergency_responder role.
          File: app/(tabs)/emergencyresponder.jsx                             */}
      <Tabs.Screen
        name="emergencyResponderDashboard"
        options={{
          title: 'Home',
          href: isResponder ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="medical" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Responder: Emergencies (User requests needing response) ────────────
          Shows incoming emergency requests for the responder to action.
          File: app/(tabs)/emergencyrequest.jsx                               */}
      <Tabs.Screen
        name="emergencyrequest"
        options={{
          title: 'Emergencies',
          href: isResponder ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Resident: PinPoint ─────────────────────────────────────────────── */}
      <Tabs.Screen
        name="pinpoint"
        options={{
          title: 'PinPoint',
          href: isResident || isLeader ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Resident: Incident Report ──────────────────────────────────────── */}
      <Tabs.Screen
        name="incidentreport"
        options={{
          title: 'Report',
          href: isResident ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Leader: Approvals ──────────────────────────────────────────────── */}
      <Tabs.Screen
        name="pendingreports"
        options={{
          title: 'Approvals',
          href: isLeader ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-circle" size={size} color={color} />
          ),
        }}
      />

      {/* ─── Shared: Settings (visible to all roles) ────────────────────────── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
