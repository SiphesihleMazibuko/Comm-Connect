import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function TabLayout() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    // Retry fetching role up to 5 times with a 1 second delay
    // This handles the race condition where auth fires before
    // the Firestore user document has finished writing
    let fetchedRole = null;
    let attempts = 0;

    while (!fetchedRole && attempts < 5) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role) {
          fetchedRole = userSnap.data().role;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error fetching user role:', error); 
      }
    }

    if (fetchedRole) {
      setRole(fetchedRole);
    } else {
      router.replace('/login');
    }

    setLoading(false);
  });

  return () => unsubscribe();
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
      <Tabs.Screen
        name="communityfeed"
        options={{
          title: 'Home',
          href: isResident || isLeader || isResponder ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          ),
        }}
      />

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

      <Tabs.Screen
        name="emergencyrequest"
        options={{
          title: 'Emergency',
          href: isResident || isResponder ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
        }}
      />

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