import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { getCurrentUser, getSupabaseClient, getUserProfile } from '../../config/supabase';
import colors from '../../Utils/colors';

function GlassTabBackground() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.22)', 'rgba(91,192,190,0.14)', 'rgba(28,37,65,0.86)']}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, borderRadius: 30 }}
    />
  );
}

function GlassTabIcon({ name, color, size, focused }) {
  return (
  <View
    style={{
      width: focused ? 55 : 34,
      height: focused ? 55  : 40,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: focused ? 'rgba(91,192,190,0.24)' : 'transparent',
      borderWidth: focused ? 1 : 0,
      borderColor: focused ? 'rgba(255,255,255,0.34)' : 'transparent',
      shadowColor: colors.glow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: focused ? 0.34 : 0,
      shadowRadius: 12,
      elevation: focused ? 8 : 0,
      marginTop:focused? 10: 0
    }}
  >
    <Ionicons name={name} size={focused ? size + 2 : size} color={color} />
  </View>
  );
}

const communityFeedIcon = (props) => <GlassTabIcon name="newspaper" {...props} />;
const responderHomeIcon = (props) => <GlassTabIcon name="medical" {...props} />;
const emergencyIcon = (props) => <GlassTabIcon name="alert-circle" {...props} />;
const pinpointIcon = (props) => <GlassTabIcon name="location" {...props} />;
const reportIcon = (props) => <GlassTabIcon name="megaphone" {...props} />;
const approvalsIcon = (props) => <GlassTabIcon name="checkmark-done-circle" {...props} />;
const settingsIcon = (props) => <GlassTabIcon name="settings" {...props} />;

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
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.66)',
        tabBarBackground: GlassTabBackground,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 18 : 14,
          height: 72,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 14 : 10,
          paddingHorizontal: 10,
          backgroundColor: 'rgba(28,37,65,0.52)',
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
          borderRadius: 30,
          overflow: 'hidden',
          shadowColor: colors.glow,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 18,
        },
        tabBarItemStyle: {
          borderRadius: 24,
          minHeight: 52,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: colors.background,
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
          tabBarIcon: communityFeedIcon,
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
          tabBarIcon: responderHomeIcon,
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
          tabBarIcon: emergencyIcon,
        }}
      />

      {/* ─── Resident: PinPoint ─────────────────────────────────────────────── */}
      <Tabs.Screen
        name="pinpoint"
        options={{
          title: 'PinPoint',
          href: isResident || isLeader ? undefined : null,
          tabBarIcon: pinpointIcon,
        }}
      />

      {/* ─── Resident: Incident Report ──────────────────────────────────────── */}
      <Tabs.Screen
        name="incidentreport"
        options={{
          title: 'Report',
          href: isResident ? undefined : null,
          tabBarIcon: reportIcon,
        }}
      />

      {/* ─── Leader: Approvals ──────────────────────────────────────────────── */}
      <Tabs.Screen
        name="pendingreports"
        options={{
          title: 'Approvals',
          href: isLeader ? undefined : null,
          tabBarIcon: approvalsIcon,
        }}
      />

      {/* ─── Shared: Settings (visible to all roles) ────────────────────────── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: undefined,
          tabBarIcon: settingsIcon,
        }}
      />
    </Tabs>
  );
}
