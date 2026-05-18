import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function EmergencyResponderScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [activeTab, setActiveTab] = useState('pending');
  const [emergencies, setEmergencies] = useState({ pending: [], ongoing: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [responderNotes, setResponderNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = subscribeToEmergencies();
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      )
    ]).start();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const subscribeToEmergencies = () => {
    const q = query(collection(db, 'emergencyRequests'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const pending = [], ongoing = [], completed = [];
      
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.status === 'completed') completed.push(data);
        else if (data.status === 'in_progress') ongoing.push(data);
        else if (data.status === 'pending') pending.push(data);
      });
      
      setEmergencies({ pending, ongoing, completed });
      
      // Update selectedEmergency if it exists in the new data
      if (selectedEmergency) {
        const allEmergencies = [...pending, ...ongoing, ...completed];
        const updatedEmergency = allEmergencies.find(e => e.id === selectedEmergency.id);
        if (updatedEmergency && updatedEmergency.status !== selectedEmergency.status) {
          setSelectedEmergency(updatedEmergency);
        }
      }
      
      setLoading(false);
    });
  };

  const acknowledgeEmergency = async (emergency) => {
    console.log('🔵 Acknowledge button pressed for:', emergency.id);
    
    try {
      setUpdating(true);
      console.log('🔵 Updating Firestore...');
      
      await updateDoc(doc(db, 'emergencyRequests', emergency.id), {
        status: 'in_progress',
        responderId: user.uid,
        responderName: user.displayName || 'Responder',
        respondedAt: serverTimestamp()
      });
      
      console.log('🔵 Update successful!');
      Alert.alert('Success', 'Emergency moved to Ongoing tab');
      setModalVisible(false);
      
    } catch (error) {
      console.log('🔴 Error:', error.message);
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const completeEmergency = async (emergency) => {
    try {
      setUpdating(true);
      await updateDoc(doc(db, 'emergencyRequests', emergency.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        responderNotes: responderNotes || 'Emergency resolved'
      });
      Alert.alert('Success', 'Emergency completed');
      setModalVisible(false);
      setResponderNotes('');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const openLocation = (emergency) => {
    const url = emergency.location?.mapsUrl || `https://www.google.com/maps?q=${emergency.location?.latitude},${emergency.location?.longitude}`;
    Linking.openURL(url);
  };

  const callContact = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getEmergencyColor = (type) => {
    switch(type) {
      case 'medical': return ['#DC2626', '#991B1B'];
      case 'crime': return ['#B91C1C', '#7F1D1D'];
      case 'fire': return ['#EA580C', '#C2410C'];
      case 'accident': return ['#D97706', '#B45309'];
      default: return [colors.error, '#991B1B'];
    }
  };

  const getEmergencyIcon = (type) => {
    switch(type) {
      case 'medical': return 'medkit';
      case 'crime': return 'warning';
      case 'fire': return 'flame';
      case 'accident': return 'car';
      default: return 'alert-circle';
    }
  };

  const timeAgo = (date) => {
    if (!date) return 'Just now';
    let dateObj = date;
    if (date && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    }
    const seconds = Math.floor((new Date() - new Date(dateObj)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const EmergencyCard = ({ emergency, type }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const isHovered = hoveredCard === emergency.id;

    const onHoverStart = () => {
      setHoveredCard(emergency.id);
      Animated.parallel([
        Animated.spring(scaleValue, { toValue: 1.02, friction: 3, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 5, friction: 3, useNativeDriver: true })
      ]).start();
    };

    const onHoverEnd = () => {
      setHoveredCard(null);
      Animated.parallel([
        Animated.spring(scaleValue, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, friction: 3, useNativeDriver: true })
      ]).start();
    };

    return (
      <Animated.View style={{ marginBottom: 14, transform: [{ scale: scaleValue }, { translateX }] }}>
        <TouchableOpacity
          onPress={() => { setSelectedEmergency(emergency); setModalVisible(true); }}
          onPressIn={onHoverStart}
          onPressOut={onHoverEnd}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={getEmergencyColor(emergency.emergencyType)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: isHovered ? 8 : 4 },
              shadowOpacity: 0.3,
              shadowRadius: isHovered ? 12 : 6,
              elevation: isHovered ? 8 : 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={getEmergencyIcon(emergency.emergencyType)} size={28} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
                    {emergency.emergencyType?.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#fff', opacity: 0.8, marginTop: 2 }}>
                    {timeAgo(emergency.createdAt)}
                  </Text>
                </View>
              </View>
              {type === 'pending' && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>URGENT</Text>
                  </View>
                </Animated.View>
              )}
              {type === 'ongoing' && (
                <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>IN PROGRESS</Text>
                </View>
              )}
            </View>
            
            <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 12, lineHeight: 20 }} numberOfLines={2}>
              {emergency.description}
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, opacity: 0.8 }} numberOfLines={1}>
                  {emergency.location?.digitalAddress || 'Location available'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, opacity: 0.8 }}>{emergency.contactDetails}</Text>
              </View>
            </View>

            {type === 'pending' && (
              <TouchableOpacity
                onPress={() => acknowledgeEmergency(emergency)}
                disabled={updating}
                style={{ marginTop: 14 }}
              >
                <LinearGradient
                  colors={updating ? ['#999', '#777'] : ['#fff', '#f0f0f0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 30, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: updating ? '#666' : '#DC2626', fontWeight: 'bold', fontSize: 13 }}>
                    {updating ? 'PROCESSING...' : 'ACKNOWLEDGE & RESPOND'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const StatsCard = ({ title, count, gradient }) => (
    <LinearGradient colors={gradient} style={{ flex: 1, borderRadius: 20, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>{count}</Text>
      <Text style={{ fontSize: 12, color: '#fff', opacity: 0.9, marginTop: 4 }}>{title}</Text>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={[colors.gradient1 || '#6D28D9', colors.gradient2 || '#F43F5E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 28, paddingTop: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>Emergency Response</Text>
              <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 6 }}>Ready to serve your community</Text>
            </View>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="medical" size={32} color="#fff" />
              </View>
            </Animated.View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={{ flexDirection: 'row', margin: 16, gap: 12 }}>
          <StatsCard title="Pending" count={emergencies.pending.length} gradient={['#DC2626', '#991B1B']} />
          <StatsCard title="Ongoing" count={emergencies.ongoing.length} gradient={['#F59E0B', '#D97706']} />
          <StatsCard title="Completed" count={emergencies.completed.length} gradient={['#10B981', '#059669']} />
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 50, padding: 4 }}>
          {[
            { id: 'pending', label: 'Just Reported', icon: 'alert-circle' },
            { id: 'ongoing', label: 'Ongoing', icon: 'time' },
            { id: 'completed', label: 'Completed', icon: 'checkmark-done-circle' }
          ].map((tab) => (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={{ flex: 1 }}>
              <LinearGradient
                colors={activeTab === tab.id ? [colors.accent, `${colors.accent}CC`] : ['transparent', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 40, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? '#fff' : colors.textLight} />
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: activeTab === tab.id ? '#fff' : colors.textLight }}>
                  {tab.label} ({emergencies[tab.id].length})
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency List */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {emergencies[activeTab].length === 0 ? (
            <LinearGradient colors={[colors.surface, colors.surface]} style={{ borderRadius: 24, padding: 60, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="checkmark-circle" size={70} color={colors.accent} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>All Clear!</Text>
              <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
                No {activeTab} emergencies at this time
              </Text>
            </LinearGradient>
          ) : (
            emergencies[activeTab].map((emergency) => (
              <EmergencyCard key={emergency.id} emergency={emergency} type={activeTab} />
            ))
          )}
        </View>
      </Animated.ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <LinearGradient colors={['#1A1A1A', '#0F0F0F']} style={{ borderRadius: 32, padding: 24, width: '90%', maxHeight: '85%' }}>
            {selectedEmergency && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Emergency Details</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={28} color={colors.textLight} />
                  </TouchableOpacity>
                </View>

                <LinearGradient
                  colors={getEmergencyColor(selectedEmergency.emergencyType)}
                  style={{ borderRadius: 16, padding: 12, alignItems: 'center', marginBottom: 20 }}
                >
                  <Ionicons name={getEmergencyIcon(selectedEmergency.emergencyType)} size={32} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>
                    {selectedEmergency.emergencyType?.toUpperCase()} EMERGENCY
                  </Text>
                </LinearGradient>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>REPORTED BY</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 6 }}>
                    {selectedEmergency.userName || 'Anonymous'}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 2 }}>
                    {selectedEmergency.userPhone || selectedEmergency.contactDetails}
                  </Text>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>DESCRIPTION</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 6, lineHeight: 24 }}>
                    {selectedEmergency.description}
                  </Text>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>CONTACT</Text>
                  <TouchableOpacity onPress={() => callContact(selectedEmergency.contactDetails)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
                    <Ionicons name="call" size={22} color={colors.accent} />
                    <Text style={{ fontSize: 18, color: colors.text }}>{selectedEmergency.contactDetails}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>LOCATION</Text>
                  <TouchableOpacity onPress={() => openLocation(selectedEmergency)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
                    <Ionicons name="location" size={22} color={colors.accent} />
                    <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>
                      {selectedEmergency.location?.digitalAddress || `${selectedEmergency.location?.latitude}, ${selectedEmergency.location?.longitude}`}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>REPORTED</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 6 }}>
                    {timeAgo(selectedEmergency.createdAt)}
                  </Text>
                </View>

                {selectedEmergency.status === 'pending' && (
                  <TouchableOpacity onPress={() => acknowledgeEmergency(selectedEmergency)} style={{ marginBottom: 20 }}>
                    <LinearGradient colors={['#DC2626', '#991B1B']} style={{ borderRadius: 12, padding: 14, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
                        {updating ? 'PROCESSING...' : '🚨 ACKNOWLEDGE & RESPOND'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {selectedEmergency.status === 'in_progress' && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>UPDATE STATUS</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                      <TouchableOpacity onPress={() => openLocation(selectedEmergency)} style={{ flex: 1 }}>
                        <LinearGradient colors={[colors.primary, `${colors.primary}CC`]} style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>📍 Navigate</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => completeEmergency(selectedEmergency)} style={{ flex: 1 }}>
                        <LinearGradient colors={['#10B981', '#059669']} style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>✅ Complete</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {(selectedEmergency.status === 'in_progress' || selectedEmergency.status === 'pending') && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>NOTES (Optional)</Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        color: colors.text,
                        minHeight: 80,
                        textAlignVertical: 'top'
                      }}
                      placeholder="Add notes about the response..."
                      placeholderTextColor={colors.textLight}
                      multiline
                      value={responderNotes}
                      onChangeText={setResponderNotes}
                    />
                  </View>
                )}

                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 20 }}>
                  <LinearGradient colors={[colors.border, colors.border]} style={{ borderRadius: 12, padding: 14, alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', textAlign: 'center' }}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}