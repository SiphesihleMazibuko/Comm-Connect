import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import {
  Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect,
  useRef,
  useState } from 'react';
import { ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getRows, getUserProfile, insertRow, updateRow } from '../../config/supabase';
import colors from '../../Utils/colors';

const EMERGENCY_SERVICES = [
  {
    id: 'community_protection_service',
    label: 'Community Protection Services',
    icon: 'radio',
    color: '#5bc0be',
    bg: '#1c2541',
    serviceType: 'community_protection_service',
  },
];

const CRIME_CATEGORIES = [
  { id: 'theft', label: 'Theft', icon: 'pricetag' },
  { id: 'burglary', label: 'Burglary', icon: 'home' },
  { id: 'assault', label: 'Assault', icon: 'body' },
  { id: 'robbery', label: 'Robbery', icon: 'alert-circle' },
  { id: 'vandalism', label: 'Vandalism', icon: 'hammer' },
  { id: 'suspicious_activity', label: 'Suspicious Activity', icon: 'eye' },
  { id: 'other_crime', label: 'Other Crime', icon: 'ellipsis-horizontal' },
];

const OTHER_CATEGORIES = [
  { id: 'funeral', label: 'Funeral' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'community_event', label: 'Community Event' },
  { id: 'lost_found', label: 'Lost & Found' },
  { id: 'noise_complaint', label: 'Noise Complaint' },
  { id: 'other_event', label: 'Other' },
];

export default function PendingReportsScreen() {
  const [reports, setReports] = useState([]);
  const [wardReports, setWardReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Detail view modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Dispatch modal — shown after tapping Approve
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [reportToApprove, setReportToApprove] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [dispatching, setDispatching] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);
        await fetchPendingReports(profile);
      } else {
        await fetchPendingReports();
      }
    };

    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const fetchPendingReports = async (profile = userProfile) => {
    try {
      let reportsData;
      let wardReportsData;
      
      // Community leaders see pending reports from their ward
      if (profile?.role === 'community_leader' && profile?.ward_id) {
        reportsData = await getRows('reports', {
          filters: { 
            status: 'pending_review',
            ward_id: profile.ward_id 
          },
        });

        wardReportsData = await getRows('reports', {
          filters: {
            ward_id: profile.ward_id,
          },
        });
      } else {
        // Fallback: show all pending reports
        reportsData = await getRows('reports', {
          filters: { status: 'pending_review' },
        });
        wardReportsData = [];
      }
      
      setReports(reportsData || []);
      setWardReports(wardReportsData || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDispatchModal = (report) => {
    setReportToApprove(report);
    setSelectedServices([]);
    setDetailModalVisible(false);
    setDispatchModalVisible(true);
  };

  // Toggle a service on/off in the multi-select
  const toggleService = (serviceId) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  };

  //leader confirms dispatch → write to Supabase
  const handleConfirmApprove = async () => {
    if (!reportToApprove) return;
    setDispatching(true);

    try {
      const now = new Date().toISOString();
      const chosenServices = EMERGENCY_SERVICES.filter((s) => selectedServices.includes(s.id));
      const reportCrimeCategory = reportToApprove.crimeCategory || reportToApprove.location?.crimeCategory || 'other_crime';
      const crimeCategoryLabel = CRIME_CATEGORIES.find((category) => category.id === reportCrimeCategory)?.label;
      const reportOtherCategory = reportToApprove.otherCategory || reportToApprove.location?.otherCategory || 'other_event';
      const otherCategoryLabel = OTHER_CATEGORIES.find((category) => category.id === reportOtherCategory)?.label;
      const communityPostTitle =
        reportToApprove.reportType === 'crime' && reportCrimeCategory !== 'other_crime' && crimeCategoryLabel
          ? `${crimeCategoryLabel.toUpperCase()} ALERT: Verified Incident`
          : reportToApprove.reportType === 'other' && reportOtherCategory !== 'other_event' && otherCategoryLabel
          ? `${otherCategoryLabel.toUpperCase()} UPDATE: Verified Incident`
          : `${reportToApprove.reportType?.toUpperCase() || 'INCIDENT'} ALERT: Verified Incident`;

      // 1. Update the report document
      await updateRow('reports', reportToApprove.id, {
        status: 'approved',
        approvedAt: now,
        approvedBy: user?.id,
        dispatchedServices: chosenServices.map((s) => s.serviceType),
      });

      // 2. Create a community feed post with ward_id
      await insertRow('posts', {
        type:
          reportToApprove.reportType === 'crime'
            ? 'crime_alert'
            : reportToApprove.reportType === 'hazard'
            ? 'emergency_notice'
            : 'service_update',
        title: communityPostTitle,
        description: reportToApprove.description,
        createdBy: user?.id,
        createdByName: 'Community Safety Team',
        createdAt: now,
        status: 'approved',
        priority: 'high',
        sourceReportId: reportToApprove.id,
        ward_id: reportToApprove.ward_id,
        suburb_id: reportToApprove.suburb_id,
      });

      // 3. Create one dispatch record per selected service
      for (const service of chosenServices) {
        await insertRow('emergency_dispatches', {
          reportId: reportToApprove.id,
          serviceType: service.serviceType,
          reportType: reportToApprove.reportType,
          description: reportToApprove.description,
          location: reportToApprove.location || null,
          dispatchedAt: now,
          dispatchedBy: user?.id,
          status: 'pending',
          acknowledged: false,
          ward_id: reportToApprove.ward_id,
          suburb_id: reportToApprove.suburb_id,
        });
      }

      // Remove from local list
      setReports((prev) => prev.filter((r) => r.id !== reportToApprove.id));
      setDispatchModalVisible(false);
      setReportToApprove(null);

      const serviceNames =
        chosenServices.length > 0
          ? chosenServices.map((s) => s.label).join(', ')
          : 'No services';
      alert(`Report approved!\nDispatched: ${serviceNames}`);
    } catch (error) {
      alert('Error approving report. Please try again.');
      console.error('Error approving report:', error);
    } finally {
      setDispatching(false);
    }
  };

  const handleReject = async (reportId) => {
    try {
      await updateRow('reports', reportId, { status: 'rejected' });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setDetailModalVisible(false);
      alert('Report rejected');
    } catch (error) {
      alert('Error rejecting report');
      console.error('Error rejecting report:', error);
    }
  };

  const getReportCrimeCategory = (report) => (
    report?.crimeCategory || report?.location?.crimeCategory || 'other_crime'
  );

  const getCrimeCategoryLabel = (value) => (
    CRIME_CATEGORIES.find((category) => category.id === value)?.label || 'Other Crime'
  );

  const getReportOtherCategory = (report) => (
    report?.otherCategory || report?.location?.otherCategory || 'other_event'
  );

  const getOtherCategoryLabel = (value) => (
    OTHER_CATEGORIES.find((category) => category.id === value)?.label || 'Other'
  );

  const getReportPhotos = (report) => (
    Array.isArray(report?.photoUrls)
      ? report.photoUrls.filter(Boolean)
      : []
  );

  const crimeMatrix = CRIME_CATEGORIES.map((category) => ({
    ...category,
    count: wardReports.filter((report) => (
      report.reportType === 'crime'
      && getReportCrimeCategory(report) === category.id
    )).length,
  }));

  const totalCrimeReports = crimeMatrix.reduce((total, category) => total + category.count, 0);

  // ─── Report Card ────────────────────────────────────────────────────
  const ReportCard = ({ report }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const onPressIn = () => {
      Animated.parallel([
        Animated.spring(scaleValue, { toValue: 1.02, friction: 3, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: -3, friction: 3, useNativeDriver: true }),
      ]).start();
    };

    const onPressOut = () => {
      Animated.parallel([
        Animated.spring(scaleValue, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 3, useNativeDriver: true }),
      ]).start();
    };

    const getReportColor = (type) => {
      switch (type) {
        case 'crime': return ['#3a506b', '#0b132b'];
        case 'hazard': return ['#1c2541', '#3a506b'];
        case 'infrastructure': return ['#0b132b', '#5bc0be'];
        default: return ['#1c2541', '#5bc0be'];
      }
    };

    const getReportIcon = (type) => {
      switch (type) {
        case 'crime': return 'warning';
        case 'hazard': return 'alert-circle';
        case 'infrastructure': return 'business';
        default: return 'document-text';
      }
    };

    return (
      <Animated.View style={{ marginBottom: 16, transform: [{ scale: scaleValue }, { translateY }] }}>
        <TouchableOpacity
          onPress={() => { setSelectedReport(report); setDetailModalVisible(true); }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
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
                  {report.ward_id && (
                    <Text style={{ fontSize: 10, color: '#fff', opacity: 0.7, marginTop: 2 }}>
                      Ward {report.ward_id}
                    </Text>
                  )}
                  {report.reportType === 'crime' && (
                    <Text style={{ fontSize: 10, color: '#fff', opacity: 0.8, marginTop: 2 }}>
                      {getCrimeCategoryLabel(getReportCrimeCategory(report))}
                    </Text>
                  )}
                  {report.reportType === 'other' && (
                    <Text style={{ fontSize: 10, color: '#fff', opacity: 0.8, marginTop: 2 }}>
                      {getOtherCategoryLabel(getReportOtherCategory(report))}
                    </Text>
                  )}
                </View>
              </View>

              {/* Quick-action buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => openDispatchModal(report)}
                  style={{ backgroundColor: '#5bc0be', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReject(report.id)}
                  style={{ backgroundColor: '#3a506b', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}
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

  //Loading 
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  //Render
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim }}>
          <ScreenHeader
            title="Pending Reports"
            subtitle={`${reports.length} reports awaiting review`}
            meta={userProfile?.ward_number ? `Ward ${userProfile.ward_number}` : undefined}
            icon="checkmark-done-circle"
          />
        </Animated.View>

        {userProfile?.role === 'community_leader' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                    Crime Matrix
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>
                    {totalCrimeReports} crime reports created in your ward
                  </Text>
                </View>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="grid" size={22} color={colors.accent} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {crimeMatrix.map((category) => (
                  <View
                    key={category.id}
                    style={{
                      width: '47%',
                      backgroundColor: colors.background,
                      borderRadius: 10,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.border
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Ionicons name={category.icon} size={18} color={colors.accent} />
                      <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 12 }}>
                        {category.label}
                      </Text>
                    </View>
                    <Text style={{ color: colors.accent, fontSize: 24, fontWeight: 'bold' }}>
                      {category.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* REPORTS LIST */}
        <View style={{ padding: 16 }}>
          {reports.length === 0 ? (
            <LinearGradient
              colors={[colors.surface, colors.surface]}
              style={{ borderRadius: 24, padding: 50, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Ionicons name="checkmark-circle" size={60} color={colors.accent} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>All Clear!</Text>
              <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
                No pending reports in your ward
              </Text>
            </LinearGradient>
          ) : (
            reports.map((report) => <ReportCard key={report.id} report={report} />)
          )}
        </View>
      </Animated.ScrollView>

      {/* DETAIL MODAL  */}
      <Modal visible={detailModalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <LinearGradient
            colors={['#1A1A1A', '#0F0F0F']}
            style={{ borderRadius: 32, padding: 24, width: '90%', maxHeight: '80%' }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Report Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
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
                  {selectedReport.reportType === 'crime' && (
                    <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 4 }}>
                      {getCrimeCategoryLabel(getReportCrimeCategory(selectedReport))}
                    </Text>
                  )}
                  {selectedReport.reportType === 'other' && (
                    <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 4 }}>
                      {getOtherCategoryLabel(getReportOtherCategory(selectedReport))}
                    </Text>
                  )}
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>DESCRIPTION</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 4, lineHeight: 24 }}>
                    {selectedReport.description}
                  </Text>
                </View>

                {getReportPhotos(selectedReport).length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold', marginBottom: 10 }}>
                      PHOTOS
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {getReportPhotos(selectedReport).map((uri, index) => (
                          <Image
                            key={`${uri}-${index}`}
                            source={{ uri }}
                            style={{
                              width: 150,
                              height: 110,
                              borderRadius: 14,
                              backgroundColor: colors.surfaceRaised,
                              borderWidth: 1,
                              borderColor: colors.border
                            }}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, color: colors.accent, fontWeight: 'bold' }}>LOCATION</Text>
                  <Text style={{ fontSize: 16, color: colors.text, marginTop: 4 }}>
                    {selectedReport.location?.latitude}, {selectedReport.location?.longitude}
                  </Text>
                  {selectedReport.ward_id && (
                    <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 4 }}>
                      Ward: {selectedReport.ward_id}
                    </Text>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => openDispatchModal(selectedReport)}
                    style={{ flex: 1, backgroundColor: '#5bc0be', padding: 14, borderRadius: 16, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReject(selectedReport.id)}
                    style={{ flex: 1, backgroundColor: '#3a506b', padding: 14, borderRadius: 16, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* DISPATCH MODAL */}
      <Modal visible={dispatchModalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: 36,
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c2541', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="radio" size={20} color="#5bc0be" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>Dispatch Services</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textLight, marginBottom: 24, marginLeft: 46 }}>
              Dispatch this verified incident to Community Protection Services for your ward.
            </Text>

            <View style={{ gap: 12, marginBottom: 28 }}>
              {EMERGENCY_SERVICES.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => toggleService(service.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: isSelected ? service.color : colors.border,
                      backgroundColor: isSelected ? service.bg : colors.background,
                    }}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: isSelected ? service.color : colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons name={service.icon} size={22} color="#fff" />
                    </View>

                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: isSelected ? service.color : colors.text }}>
                      {service.label}
                    </Text>

                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? service.color : colors.border,
                      backgroundColor: isSelected ? service.color : 'rgba(255,255,255,0)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedServices.length === 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10 }}>
                <Ionicons name="information-circle" size={18} color="#5bc0be" />
                <Text style={{ fontSize: 12, color: '#5bc0be', flex: 1 }}>
                  No services selected — the report will still be approved and posted to the community feed.
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.border, borderRadius: 14, padding: 14, alignItems: 'center' }}
                onPress={() => setDispatchModalVisible(false)}
                disabled={dispatching}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 2,
                  backgroundColor: '#5bc0be',
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: dispatching ? 0.7 : 1,
                }}
                onPress={handleConfirmApprove}
                disabled={dispatching}
              >
                {dispatching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="radio" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                      {selectedServices.length > 0
                        ? `Approve & Dispatch (${selectedServices.length})`
                        : 'Approve Only'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

