import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getRows, getUserProfile, insertRow, updateRow } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';

const EMERGENCY_SERVICES = [
  { id: 'community_protection_service', label: 'Community Protection Services', icon: 'radio', serviceType: 'community_protection_service' },
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
  const { colors, isDark } = useTheme();

  const [reports, setReports] = useState([]);
  const [wardReports, setWardReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [crimeModalVisible, setCrimeModalVisible] = useState(false);
  const [selectedCrimeCategory, setSelectedCrimeCategory] = useState(null);
  const [reportToApprove, setReportToApprove] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [dispatching, setDispatching] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          const profile = await getUserProfile(currentUser.id);
          setUserProfile(profile);
          await fetchPendingReports(profile);
        } else {
          await fetchPendingReports();
        }
      } catch (error) {
        console.error('Error loading pending reports:', error);
        setLoading(false);
      }
    };
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 650, useNativeDriver: true }).start();
  }, []);

  const fetchPendingReports = async (profile = userProfile) => {
    try {
      let reportsData;
      let wardReportsData;
      if (profile?.role === 'community_leader' && profile?.ward_id) {
        reportsData = await getRows('reports', { filters: { status: 'pending_review', ward_id: profile.ward_id } });
        wardReportsData = await getRows('reports', { filters: { ward_id: profile.ward_id } });
      } else {
        reportsData = await getRows('reports', { filters: { status: 'pending_review' } });
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

  const getReportCrimeCategory = (report) => report?.crimeCategory || report?.location?.crimeCategory || 'other_crime';
  const getCrimeCategoryLabel = (value) => CRIME_CATEGORIES.find((category) => category.id === value)?.label || 'Other Crime';
  const getReportOtherCategory = (report) => report?.otherCategory || report?.location?.otherCategory || 'other_event';
  const getOtherCategoryLabel = (value) => OTHER_CATEGORIES.find((category) => category.id === value)?.label || 'Other';
  const getReportPhotos = (report) => Array.isArray(report?.photoUrls) ? report.photoUrls.filter(Boolean) : [];

  const getReportIcon = (type) => {
    switch (type) {
      case 'crime': return 'warning';
      case 'hazard': return 'alert-circle';
      case 'infrastructure': return 'business';
      default: return 'document-text';
    }
  };

  const getReportTypeLabel = (type) => {
    switch (type) {
      case 'crime': return 'Crime';
      case 'hazard': return 'Emergency';
      case 'infrastructure': return 'Infrastructure';
      case 'other': return 'Community';
      default: return 'Incident';
    }
  };

  const getReportColors = (type) => {
    switch (type) {
      case 'crime': return [colors.primary, colors.accent];
      case 'hazard': return [colors.error, colors.primary];
      case 'infrastructure': return [colors.primary, colors.accentSoft];
      default: return [colors.accent, colors.primary];
    }
  };

  const getCrimeReportsForCategory = (categoryId) => (
    wardReports.filter((report) => report.reportType === 'crime' && getReportCrimeCategory(report) === categoryId)
  );

  const crimeMatrix = CRIME_CATEGORIES.map((category) => {
    const categoryReports = getCrimeReportsForCategory(category.id);
    return {
      ...category,
      count: categoryReports.length,
      pendingCount: categoryReports.filter((report) => report.status === 'pending_review').length,
      approvedCount: categoryReports.filter((report) => report.status === 'approved').length,
      rejectedCount: categoryReports.filter((report) => report.status === 'rejected').length,
      latestReportAt: categoryReports[0]?.createdAt || null,
    };
  });

  const totalCrimeReports = crimeMatrix.reduce((total, category) => total + category.count, 0);
  const selectedCrimeReports = selectedCrimeCategory ? getCrimeReportsForCategory(selectedCrimeCategory.id) : [];

  const openCrimeCategory = (category) => {
    setSelectedCrimeCategory(category);
    setCrimeModalVisible(true);
  };

  const openReportFromCrimeMatrix = (report) => {
    setCrimeModalVisible(false);
    setSelectedReport(report);
    setDetailModalVisible(true);
  };

  const openDispatchModal = (report) => {
    setReportToApprove(report);
    setSelectedServices([]);
    setDetailModalVisible(false);
    setDispatchModalVisible(true);
  };

  const toggleService = (serviceId) => {
    setSelectedServices((previous) =>
      previous.includes(serviceId) ? previous.filter((service) => service !== serviceId) : [...previous, serviceId]
    );
  };

  const handleConfirmApprove = async () => {
    if (!reportToApprove) return;
    setDispatching(true);
    try {
      const now = new Date().toISOString();
      const chosenServices = EMERGENCY_SERVICES.filter((service) => selectedServices.includes(service.id));
      const reportCrimeCategory = reportToApprove.crimeCategory || reportToApprove.location?.crimeCategory || 'other_crime';
      const crimeCategoryLabel = CRIME_CATEGORIES.find((category) => category.id === reportCrimeCategory)?.label;
      const reportOtherCategory = reportToApprove.otherCategory || reportToApprove.location?.otherCategory || 'other_event';
      const otherCategoryLabel = OTHER_CATEGORIES.find((category) => category.id === reportOtherCategory)?.label;

      const communityPostTitle = reportToApprove.reportType === 'crime' && reportCrimeCategory !== 'other_crime' && crimeCategoryLabel
        ? `${crimeCategoryLabel.toUpperCase()} ALERT: Verified Incident`
        : reportToApprove.reportType === 'other' && reportOtherCategory !== 'other_event' && otherCategoryLabel
          ? `${otherCategoryLabel.toUpperCase()} UPDATE: Verified Incident`
          : `${reportToApprove.reportType?.toUpperCase() || 'INCIDENT'} ALERT: Verified Incident`;

      await updateRow('reports', reportToApprove.id, {
        status: 'approved',
        approvedAt: now,
        approvedBy: user?.id,
        dispatchedServices: chosenServices.map((service) => service.serviceType),
      });

      await insertRow('posts', {
        type: reportToApprove.reportType === 'crime' ? 'crime_alert' : reportToApprove.reportType === 'hazard' ? 'emergency_notice' : 'service_update',
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

      setReports((previous) => previous.filter((report) => report.id !== reportToApprove.id));
      setDispatchModalVisible(false);
      setReportToApprove(null);

      const serviceNames = chosenServices.length > 0 ? chosenServices.map((service) => service.label).join(', ') : 'No services';
      Alert.alert('Report Approved', `Dispatched: ${serviceNames}`);
    } catch (error) {
      Alert.alert('Error', 'Error approving report. Please try again.');
      console.error('Error approving report:', error);
    } finally {
      setDispatching(false);
    }
  };

  const handleReject = async (reportId) => {
    try {
      await updateRow('reports', reportId, { status: 'rejected' });
      setReports((previous) => previous.filter((report) => report.id !== reportId));
      setDetailModalVisible(false);
      Alert.alert('Report Rejected', 'The report has been rejected.');
    } catch (error) {
      Alert.alert('Error', 'Error rejecting report.');
      console.error('Error rejecting report:', error);
    }
  };

  const ReportCard = ({ report }) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const onPressIn = () => Animated.spring(scaleValue, { toValue: 0.985, friction: 6, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scaleValue, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    const typeLabel = getReportTypeLabel(report.reportType);
    const categoryLabel = report.reportType === 'crime'
      ? getCrimeCategoryLabel(getReportCrimeCategory(report))
      : report.reportType === 'other' ? getOtherCategoryLabel(getReportOtherCategory(report)) : null;

    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }], marginBottom: 14 }}>
        <TouchableOpacity onPress={() => { setSelectedReport(report); setDetailModalVisible(true); }} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
          <LinearGradient colors={getReportColors(report.reportType)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 1 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.95)', borderRadius: 21, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <LinearGradient colors={getReportColors(report.reportType)} style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={getReportIcon(report.reportType)} size={23} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{typeLabel}</Text>
                    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.accentLight }}>
                      <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '800' }}>PENDING</Text>
                    </View>
                  </View>
                  {categoryLabel && <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{categoryLabel}</Text>}
                  <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 5 }}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}
                    {report.ward_id ? `  •  Ward ${report.ward_id}` : ''}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 14 }}>
                {report.description?.substring(0, 120)}{report.description?.length > 120 ? '...' : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ flex: 1, color: colors.textLight, fontSize: 11, fontWeight: '600' }}>Tap to view details</Text>
                <TouchableOpacity onPress={() => openDispatchModal(report)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <Ionicons name="checkmark" size={21} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReject(report.id)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="close" size={21} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 14 }}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <ScreenHeader
            title="Pending Reports"
            subtitle={reports.length === 1 ? '1 report awaiting review' : `${reports.length} reports awaiting review`}
            meta={userProfile?.ward_number ? `Ward ${userProfile.ward_number}` : undefined}
            icon="checkmark-done-circle"
          />
        </Animated.View>

        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 18, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Community Safety Review</Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.78, fontSize: 11, marginTop: 3 }}>Review reports carefully before approval.</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>{reports.length}</Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.75, fontSize: 9, fontWeight: '700' }}>PENDING</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {userProfile?.role === 'community_leader' && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="stats-chart" size={21} color={colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Crime Overview</Text>
                  <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }}>Activity reported in your ward</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '900' }}>{totalCrimeReports}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '700' }}>TOTAL</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {crimeMatrix.map((category) => (
                  <TouchableOpacity key={category.id} onPress={() => openCrimeCategory(category)} activeOpacity={0.86} style={{ width: '48.5%', backgroundColor: colors.background, borderRadius: 15, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: category.count > 0 ? colors.accent + '55' : colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={category.icon} size={16} color={colors.accent} />
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 11, fontWeight: '700', marginLeft: 7 }}>{category.label}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textLight} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: colors.text, fontSize: 23, fontWeight: '900' }}>{category.count}</Text>
                      {category.pendingCount > 0 && (
                        <View style={{ backgroundColor: colors.warningLight || colors.accentLight, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: colors.warning || colors.accent, fontSize: 9, fontWeight: '900' }}>{category.pendingCount} PENDING</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={{ color: colors.textLight, fontSize: 10, marginTop: 5 }}>
                      {category.latestReportAt ? `Latest ${new Date(category.latestReportAt).toLocaleDateString()}` : 'No reports yet'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' }}>Reports to Review</Text>
            <View style={{ backgroundColor: colors.accentLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 }}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>{reports.length}</Text>
            </View>
          </View>
          {reports.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 38, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <LinearGradient colors={[colors.accentLight, colors.surfaceRaised]} style={{ width: 82, height: 82, borderRadius: 26, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
              </LinearGradient>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 18 }}>All Clear</Text>
              <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 7, maxWidth: 260 }}>
                There are currently no reports waiting for review in your ward.
              </Text>
            </View>
          ) : (
            reports.map((report) => <ReportCard key={report.id} report={report} />)
          )}
        </View>
      </Animated.ScrollView>

      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%', paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>REPORT REVIEW</Text>
                  <Text style={{ color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 4 }}>Report Details</Text>
                </View>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="close" size={22} color={colors.textLight} />
                </TouchableOpacity>
              </View>
              {selectedReport && (
                <>
                  <LinearGradient colors={getReportColors(selectedReport.reportType)} style={{ borderRadius: 20, padding: 1, marginBottom: 20 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 19, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name={getReportIcon(selectedReport.reportType)} size={24} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '800' }}>INCIDENT TYPE</Text>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 }}>{getReportTypeLabel(selectedReport.reportType)}</Text>
                        {selectedReport.reportType === 'crime' && (
                          <Text style={{ color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '600' }}>{getCrimeCategoryLabel(getReportCrimeCategory(selectedReport))}</Text>
                        )}
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.accentLight }}>
                        <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '900' }}>PENDING</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 7 }}>DESCRIPTION</Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>{selectedReport.description || 'No description provided.'}</Text>
                    </View>
                  </View>

                  {getReportPhotos(selectedReport).length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 9 }}>ATTACHED PHOTOS</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {getReportPhotos(selectedReport).map((uri, index) => (
                            <Image key={`${uri}-${index}`} source={{ uri }} style={{ width: 145, height: 110, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} resizeMode="cover" />
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  <View style={{ marginBottom: 22 }}>
                    <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 9 }}>LOCATION</Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="location" size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{selectedReport.location?.latitude ?? 'Unknown'}, {selectedReport.location?.longitude ?? 'Unknown'}</Text>
                        {selectedReport.ward_id && <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 3 }}>Ward {selectedReport.ward_id}</Text>}
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <TouchableOpacity onPress={() => openDispatchModal(selectedReport)} style={{ backgroundColor: colors.success, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Approve Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReject(selectedReport.id)} style={{ backgroundColor: colors.error, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Reject Report</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={crimeModalVisible} animationType="slide" transparent onRequestClose={() => setCrimeModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%', paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 34 }}>
              {selectedCrimeCategory && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name={selectedCrimeCategory.icon} size={23} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>CRIME MATRIX</Text>
                      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 3 }}>{selectedCrimeCategory.label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCrimeModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                      <Ionicons name="close" size={22} color={colors.textLight} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18 }}>
                    {[
                      { label: 'Total', value: selectedCrimeCategory.count, color: colors.accent },
                      { label: 'Pending', value: selectedCrimeCategory.pendingCount, color: colors.warning || colors.accent },
                      { label: 'Approved', value: selectedCrimeCategory.approvedCount, color: colors.success },
                      { label: 'Rejected', value: selectedCrimeCategory.rejectedCount, color: colors.error },
                    ].map((stat) => (
                      <View key={stat.label} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border, minHeight: 72 }}>
                        <Text style={{ color: stat.color, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>{stat.value}</Text>
                        <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '800', textAlign: 'center', marginTop: 4 }}>{stat.label.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 18 }}>
                    <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>SUMMARY</Text>
                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 7 }}>
                      {selectedCrimeCategory.count === 0
                        ? `No ${selectedCrimeCategory.label.toLowerCase()} reports have been submitted in this ward yet.`
                        : `${selectedCrimeCategory.label} has ${selectedCrimeCategory.count} report${selectedCrimeCategory.count === 1 ? '' : 's'} in this ward, with ${selectedCrimeCategory.pendingCount} still waiting for review.`}
                    </Text>
                  </View>

                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>Reports</Text>
                  {selectedCrimeReports.length === 0 ? (
                    <View style={{ backgroundColor: colors.background, borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                      <Ionicons name="folder-open-outline" size={38} color={colors.textLight} />
                      <Text style={{ color: colors.text, fontWeight: '800', marginTop: 10 }}>No reports in this category</Text>
                    </View>
                  ) : (
                    selectedCrimeReports
                      .slice()
                      .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
                      .map((report) => {
                        const isPending = report.status === 'pending_review';
                        const photos = getReportPhotos(report);
                        return (
                          <TouchableOpacity key={report.id} onPress={() => openReportFromCrimeMatrix(report)} activeOpacity={0.86} style={{ backgroundColor: colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: isPending ? colors.accent + '55' : colors.border, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
                              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: isPending ? colors.accentLight : colors.surfaceRaised }}>
                                <Text style={{ color: isPending ? colors.accent : colors.textLight, fontSize: 9, fontWeight: '900' }}>{(report.status || 'unknown').replace('_', ' ').toUpperCase()}</Text>
                              </View>
                              <Text style={{ flex: 1, color: colors.textLight, fontSize: 11, textAlign: 'right' }} numberOfLines={1}>
                                {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Just now'}
                              </Text>
                            </View>
                            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '600' }} numberOfLines={3}>
                              {report.description || 'No description provided.'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, gap: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                                <Ionicons name="location" size={14} color={colors.textLight} />
                                <Text style={{ color: colors.textLight, fontSize: 11 }} numberOfLines={1}>
                                  {report.location?.latitude ? `${report.location.latitude}, ${report.location.longitude}` : 'No location'}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name="image" size={14} color={colors.textLight} />
                                <Text style={{ color: colors.textLight, fontSize: 11 }}>{photos.length}</Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                            </View>
                          </TouchableOpacity>
                        );
                      })
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dispatchModalVisible} animationType="slide" transparent onRequestClose={() => setDispatchModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 34, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient colors={[colors.primary, colors.accent]} style={{ width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="radio" size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Dispatch Services</Text>
                <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }}>Choose who should respond</Text>
              </View>
            </View>

            {reportToApprove && (
              <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 13, marginTop: 18, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '900' }}>VERIFYING</Text>
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{reportToApprove.description || 'Community incident report'}</Text>
              </View>
            )}

            <View style={{ marginTop: 18, gap: 10 }}>
              {EMERGENCY_SERVICES.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity key={service.id} onPress={() => toggleService(service.id)} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 17,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.accent : colors.border,
                    backgroundColor: isSelected ? colors.accentLight : colors.background,
                  }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isSelected ? colors.accent : colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name={service.icon} size={21} color={isSelected ? '#FFFFFF' : colors.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{service.label}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 10, marginTop: 2 }}>Community emergency response</Text>
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedServices.length === 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.accentLight, borderRadius: 14, padding: 11, marginTop: 14, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="information-circle" size={18} color={colors.accent} />
                <Text style={{ flex: 1, color: colors.text, fontSize: 11, lineHeight: 17, marginLeft: 8 }}>
                  You can approve this report without dispatching a service. It will still appear on the community feed.
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setDispatchModalVisible(false)} disabled={dispatching} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 15, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmApprove} disabled={dispatching} style={{ flex: 1.8, backgroundColor: colors.accent, borderRadius: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, opacity: dispatching ? 0.7 : 1 }}>
                {dispatching ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={selectedServices.length > 0 ? 'radio' : 'checkmark-circle'} size={19} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>{selectedServices.length > 0 ? `Approve & Dispatch (${selectedServices.length})` : 'Approve Only'}</Text>
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
