import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, updateDoc, doc, where } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, TouchableOpacity, View, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import colors from '../../Utils/colors';

export default function PendingReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const user = auth.currentUser;

  useEffect(() => {
    fetchPendingReports();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const fetchPendingReports = async () => {
    try {
      const q = query(collection(db, 'reports'), where('status', '==', 'pending_review'));
      const querySnapshot = await getDocs(q);
      const reportsData = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() });
      });
      setReports(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'approved' });
      setReports(reports.filter(r => r.id !== reportId));
      alert('Report approved successfully!');
    } catch (error) {
      alert('Error approving report');
    }
  };

  const handleReject = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'rejected' });
      setReports(reports.filter(r => r.id !== reportId));
      alert('Report rejected');
    } catch (error) {
      alert('Error rejecting report');
    }
  };

  const ReportCard = ({ report, index }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const onHoverStart = () => {
      setHoveredCard(report.id);
      Animated.parallel([
        An.spring(scaleValue, { toValue: 1.02, friction: 3, useNativeDriver: true }),
        An.spring(translateY, { toValue: -3, friction: 3, useNativeDriver: true })
      ]).start();
    };

    const onHoverEnd = () => {
      setHoveredCard(null);
      Animated.parallel([
        An.spring(scaleValue, { toValue: 1, friction: 3, useNativeDriver: true }),
        An.spring(translateY, { toValue: 0, friction: 3, useNativeDriver: true })
      ]).start();
    };

    const getReportColor = (type) => {
      switch(type) {
        case 'crime': return ['#DC2626', '#991B1B'];
        case 'hazard': return ['#F59E0B', '#D97706'];
        case 'infrastructure': return ['#6D28D9', '#8B5CF6'];
        default: return ['#00A896', '#02C39A'];
      }
    };

    const getReportIcon = (type) => {
      switch(type) {
        case 'crime': return 'warning';
        case 'hazard': return 'alert-circle';
        case 'infrastructure': return 'business';
        default: return 'document-text';
      }
    };

    return (
      <Animated.View style={{ marginBottom: 16, transform: [{ scale: scaleValue }, { translateY }] }}>
        <TouchableOpacity 
          onPress={() => { setSelectedReport(report); setModalVisible(true); }}
          onPressIn={onHoverStart}
          onPressOut={onHoverEnd}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          activeOpacity={0.9}
        >
          <LinearGradient 
            colors={getReportColor(report.reportType)} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={getReportIcon(report.reportType)} size={28} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
                    {report.reportType?.toUpperCase() || 'INCIDENT'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#fff', opacity: 0.8, marginTop: 4 }}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Just now'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  onPress={() => handleApprove(report.id)}
                  style={{ backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleReject(report.id)}
                  style={{ backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 12, lineHeight: 20 }}>
              {report.description?.substring(0, 100)}...
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <LinearGradient 
          colors={[colors.gradient1 || '#6D28D9', colors.gradient2 || '#F43F5E']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={{ padding: 28, paddingTop: 50, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>Pending Reports 📋</Text>
                <Text style={{ fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 8 }}>
                  {reports.length} reports awaiting review
                </Text>
              </View>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="checkmark-done-circle" size={32} color="#fff" />
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* REPORTS LIST */}
        <View style={{ padding: 16 }}>
          {reports.length === 0 ? (
            <LinearGradient 
              colors={[colors.surface, colors.surface]} 
              style={{ borderRadius: 24, padding: 50, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Ionicons name="checkmark-circle" size={60} color={colors.accent} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>All Clear! ✨</Text>
              <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
                No pending reports to review
              </Text>
            </LinearGradient>
          ) : (
            reports.map((report, index) => <ReportCard key={report.id} report={report} index={index} />)
          )}
        </View>
      </Animated.ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <LinearGradient colors={['#1A1A1A', '#0F0F0F']} style={{ borderRadius: 32, padding: 24, width: '90%', maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Report Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            
            {selectedReport && (
              <>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>TYPE</Text>
                  <Text style={{ fontSize: 18, color: colors.text, marginTop: 4, fontWeight: '600' }}>
                    {selectedReport.reportType?.toUpperCase()}
                  </Text>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>DESCRIPTION</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 4, lineHeight: 24 }}>
                    {selectedReport.description}
                  </Text>
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>LOCATION</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 4 }}>
                    {selectedReport.location?.latitude}, {selectedReport.location?.longitude}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity 
                    onPress={() => { handleApprove(selectedReport.id); setModalVisible(false); }}
                    style={{ flex: 1, backgroundColor: '#10B981', padding: 14, borderRadius: 16, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => { handleReject(selectedReport.id); setModalVisible(false); }}
                    style={{ flex: 1, backgroundColor: '#EF4444', padding: 14, borderRadius: 16, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}