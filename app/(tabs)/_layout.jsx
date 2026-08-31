import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import {
  getCurrentUser,
  getSupabaseClient,
  getUserProfile,
} from '../../config/supabase';

import { useTheme } from '../context/ThemeContext';

function GlassTabBackground({ colors, isDark }) {
  return (
    <LinearGradient
      colors={
        isDark
          ? [
              'rgba(255,255,255,0.08)',
              `${colors.primary}20`,
              'rgba(15,23,42,0.92)',
            ]
          : [
              'rgba(255,255,255,0.92)',
              `${colors.primary}12`,
              'rgba(255,255,255,0.82)',
            ]
      }
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        borderRadius: 30,
      }}
    />
  );
}

function GlassTabIcon({
  name,
  color,
  size,
  focused,
  colors,
  isDark,
}) {
  return (
    <View
      style={{
        width: focused ? 55 : 34,
        height: focused ? 55 : 40,
        borderRadius: 50,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor: focused
          ? `${colors.primary}30`
          : 'transparent',

        borderWidth: focused ? 1 : 0,

        borderColor: focused
          ? `${colors.primary}55`
          : 'transparent',

        shadowColor: colors.primary,

        shadowOffset: {
          width: 0,
          height: 6,
        },

        shadowOpacity: focused
          ? isDark
            ? 0.35
            : 0.18
          : 0,

        shadowRadius: 12,

        elevation: focused ? 8 : 0,

        marginTop: focused ? 10 : 0,
      }}
    >
      <Ionicons
        name={name}
        size={focused ? size + 2 : size}
        color={color}
      />
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();

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
            await new Promise((resolve) =>
              setTimeout(resolve, 1000)
            );
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

    getCurrentUser().then((currentUser) =>
      loadUserRole(currentUser)
    );

    const {
      data: authListener,
    } = client.auth.onAuthStateChange(
      (_event, session) => {
        loadUserRole(session?.user || null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading || !role) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  // ============================================================
  // ROLE DEFINITIONS
  // ============================================================

  const isResident = role === 'resident';

  const isLeader =
    role === 'community_leader';

  const isCps =
    role === 'community_protection_service' ||
    role === 'emergency_responder';

  // ============================================================
  // TAB ICONS
  // ============================================================

  const createTabIcon = (name) => {
    const TabIcon = (props) => (
      <GlassTabIcon
        name={name}
        {...props}
        colors={colors}
        isDark={isDark}
      />
    );

    TabIcon.displayName = `TabIcon(${name})`;

    return TabIcon;
  };

  const communityFeedIcon =
    createTabIcon('newspaper');

  const responderHomeIcon =
    createTabIcon('radio');

  const emergencyIcon =
    createTabIcon('alert-circle');

  const pinpointIcon =
    createTabIcon('location');

  const reportIcon =
    createTabIcon('megaphone');

  const approvalsIcon =
    createTabIcon('checkmark-done-circle');

  const dutyIcon =
    createTabIcon('people-circle');

  const settingsIcon =
    createTabIcon('settings');

  // ============================================================
  // TABS
  // ============================================================

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor:
          isDark
            ? colors.text
            : colors.primary,

        tabBarInactiveTintColor:
          isDark
            ? 'rgba(255,255,255,0.60)'
            : colors.tabBarInactive,

        tabBarBackground: () => (
          <GlassTabBackground
            colors={colors}
            isDark={isDark}
          />
        ),

        tabBarStyle: {
          position: 'absolute',

          left: 16,
          right: 16,

          bottom:
            Platform.OS === 'ios'
              ? 18
              : 14,

          height: 72,

          paddingTop: 10,

          paddingBottom:
            Platform.OS === 'ios'
              ? 14
              : 10,

          paddingHorizontal: 10,

          backgroundColor:
            isDark
              ? 'rgba(15,23,42,0.72)'
              : 'rgba(255,255,255,0.72)',

          borderTopWidth: 1,

          borderWidth: 1,

          borderColor:
            isDark
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.08)',

          borderRadius: 30,

          overflow: 'hidden',

          shadowColor: isDark
            ? '#000000'
            : colors.primary,

          shadowOffset: {
            width: 0,
            height: 14,
          },

          shadowOpacity: isDark
            ? 0.35
            : 0.10,

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

      {/* ========================================================
          RESIDENT / COMMUNITY LEADER HOME
          Community Feed is the Home screen
      ======================================================== */}

      <Tabs.Screen
        name="communityfeed"
        options={{
          title: 'Home',

          href:
            isResident ||
            isLeader
              ? undefined
              : null,

          tabBarIcon:
            communityFeedIcon,
        }}
      />

      {/* ========================================================
          EMERGENCY RESPONDER HOME
      ======================================================== */}

      <Tabs.Screen
        name="emergencyResponderDashboard"
        options={{
          title: 'Responder',

          href:
            isCps
              ? undefined
              : null,

          tabBarIcon:
            responderHomeIcon,
        }}
      />

      {/* ========================================================
          EMERGENCIES
      ======================================================== */}

      <Tabs.Screen
        name="emergencyrequest"
        options={{
          title: 'Emergencies',

          // Keep hidden from the resident/leader tab bar.
          // Responders access this from their own navigation.
          href: null,

          tabBarIcon:
            emergencyIcon,
        }}
      />

      {/* ========================================================
          ON DUTY
      ======================================================== */}

      <Tabs.Screen
        name="cpsmembers"
        options={{
          title: 'On Duty',

          href:
            isCps
              ? undefined
              : null,

          tabBarIcon:
            dutyIcon,
        }}
      />

      {/* ========================================================
          PINPOINT
      ======================================================== */}

      <Tabs.Screen
        name="pinpoint"
        options={{
          title: 'PinPoint',

          href:
            isResident ||
            isLeader
              ? undefined
              : null,

          tabBarIcon:
            pinpointIcon,
        }}
      />

      {/* ========================================================
          INCIDENT REPORT
      ======================================================== */}

      <Tabs.Screen
        name="incidentreport"
        options={{
          title: 'Report',

          href:
            isResident
              ? undefined
              : null,

          tabBarIcon:
            reportIcon,
        }}
      />

      {/* ========================================================
          COMMUNITY LEADER APPROVALS
      ======================================================== */}

      <Tabs.Screen
        name="pendingreports"
        options={{
          title: 'Approvals',

          href:
            isLeader
              ? undefined
              : null,

          tabBarIcon:
            approvalsIcon,
        }}
      />

      {/* ========================================================
          SETTINGS
          Visible to everybody
      ======================================================== */}

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',

          href: undefined,

          tabBarIcon:
            settingsIcon,
        }}
      />

    </Tabs>
  );
}