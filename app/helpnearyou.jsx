import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TouchableOpacity from '../components/FeedbackTouchableOpacity';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from './context/ThemeContext';

const SERVICES = [
  {
    id: '1',
    name: 'Community Mental Health Support',
    category: 'Mental Health',
    description: 'Community-based mental health support and assistance for residents.',
    address: 'Corner 3 & 6 Ferrari Street',
    availability: 'Monday – Friday',
    openingTime: '08:00',
    closingTime: '16:00',
    phone: '',
  },
  {
    id: '2',
    name: 'Community Psychologist',
    category: 'Mental Health',
    description: 'Psychologist support available to community members at the recreation centre.',
    address: 'Community Recreation Centre',
    availability: 'Every Tuesday',
    openingTime: '09:00',
    closingTime: '15:00',
    phone: '',
  },
  {
    id: '3',
    name: 'Local Community Clinic',
    category: 'Healthcare',
    description: 'Local healthcare services and basic medical assistance for community members.',
    address: 'Local Community Clinic',
    availability: 'Monday – Friday',
    openingTime: '07:00',
    closingTime: '17:00',
    phone: '',
  },
  {
    id: '4',
    name: 'Community Social Support',
    category: 'Social Support',
    description: 'Social support and assistance for residents who need help with community-related matters.',
    address: 'Community Centre',
    availability: 'Monday – Friday',
    openingTime: '08:00',
    closingTime: '16:00',
    phone: '',
  },
];

const CATEGORIES = ['All', 'Mental Health', 'Healthcare', 'Social Support'];

export default function HelpNearYou() {
  const { colors, isDark } = useTheme();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return SERVICES.filter((service) => {
      const matchesCategory = selectedCategory === 'All' || service.category === selectedCategory;

      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query) ||
        service.address.toLowerCase().includes(query) ||
        service.availability.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerShadowVisible: false,
          headerBackVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />

      <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title="Help Near You"
          subtitle="Find support and services in your community"
          leftIcon="arrow-back"
          onLeftPress={() => router.back()}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
            borderRadius: 16,
            paddingHorizontal: 15,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
          }}>
            <Ionicons name="search-outline" size={21} color={colors.textLight} />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search for a service..."
              placeholderTextColor={colors.textLight}
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: colors.text, fontSize: 15 }}
            />

            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;

              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor: active ? '#00C853' : isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                    borderWidth: active ? 0 : 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <Text style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: active ? '700' : '500' }}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Community Services</Text>
            <Text style={{ fontSize: 13, color: colors.textLight, marginTop: 4 }}>
              Find support and services available in your community.
            </Text>
          </View>

          {filteredServices.length > 0 ? (
            filteredServices.map((service) => (
              <View key={service.id} style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                borderRadius: 20,
                padding: 18,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: isDark ? 'rgba(0,200,83,0.18)' : 'rgba(0,200,83,0.10)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons
                      name={
                        service.category === 'Mental Health'
                          ? 'heart-outline'
                          : service.category === 'Healthcare'
                          ? 'medkit-outline'
                          : 'people-outline'
                      }
                      size={24}
                      color="#00C853"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{service.name}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#00C853', marginTop: 3 }}>
                      {service.category}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textLight, marginBottom: 14 }}>
                  {service.description}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 }}>
                  <Ionicons name="location-outline" size={19} color="#00C853" style={{ marginRight: 8 }} />
                  <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.text }}>{service.address}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
                  <Ionicons name="calendar-outline" size={18} color="#00C853" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: colors.text }}>{service.availability}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="time-outline" size={18} color="#00C853" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: colors.text }}>
                    {service.openingTime} – {service.closingTime}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.8}
                    style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#00C853', paddingVertical: 11, borderRadius: 12 }}
                  >
                    <Ionicons name="call-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Contact</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F5F3',
                      paddingVertical: 11,
                      borderRadius: 12,
                    }}
                  >
                    <Ionicons name="navigate-outline" size={17} color={colors.text} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Directions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 50 }}>
              <Ionicons name="search-outline" size={42} color={colors.textLight} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 12 }}>No services found</Text>
              <Text style={{ fontSize: 13, color: colors.textLight, textAlign: 'center', marginTop: 6 }}>
                Try another search term or category.
              </Text>
            </View>
          )}

          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F7F9F8',
            borderRadius: 14,
            padding: 14,
            marginTop: 6,
          }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textLight} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: colors.textLight }}>
              Service information may change. Please confirm availability before visiting.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}