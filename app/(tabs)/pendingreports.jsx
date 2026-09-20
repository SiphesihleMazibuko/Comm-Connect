import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../components/ScreenHeader';
import CrimeReportsModal from '../../components/crime-reports-modal';
import { getCurrentUser, getRows, getUserProfile, insertRow, updateRow } from '../../config/supabase';
import { useLanguage } from '../context/LanguageContext';
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

const StatsGauge = ({ title, value, subtitle, icon, colors, isDark, onPress }) => {
  const maxReports = 50;
  const safePercentage = Math.max(0, Math.min(100, (Number(value) || 0) / maxReports * 100));

  const size = 170;
  const strokeWidth = 11;
  const centerX = size / 2;
  const centerY = 150;
  const radius = 62;

  const startAngle = 180;
  const endAngle = 360;
  const totalAngle = endAngle - startAngle;
  const filledAngle = (safePercentage / 100) * totalAngle;

  const polarToCartesian = (cx, cy, r, angle) => {
    const angleInRadians = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angleInRadians), y: cy + r * Math.sin(angleInRadians) };
  };

  const describeArc = (cx, cy, r, start, end) => {
    const startPoint = polarToCartesian(cx, cy, r, end);
    const endPoint = polarToCartesian(cx, cy, r, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return ['M', startPoint.x, startPoint.y, 'A', r, r, 0, largeArcFlag, 0, endPoint.x, endPoint.y].join(' ');
  };

  const backgroundPath = describeArc(centerX, centerY, radius, startAngle, endAngle);
  const filledPath = safePercentage > 0 ? describeArc(centerX, centerY, radius, startAngle, startAngle + filledAngle) : '';

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}: ${value} ${value === 1 ? 'report' : 'reports'}. View reports`} style={{ width: '48.5%', marginBottom: 14, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ paddingTop: 15, paddingHorizontal: 8, alignItems: 'center' }}>
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 34 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
            <Ionicons name={icon} size={14} color={colors.accent} />
          </View>
          <Text numberOfLines={2} style={{ flex: 1, textAlign: 'left', color: colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.2 }}>
            {title}
          </Text>
        </View>

        <View style={{ width: size, height: 105, marginTop: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0 }}>
            <Defs>
              <SvgLinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.accent} stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>
            <Path d={backgroundPath} fill="none" stroke={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(120,90,160,0.12)'} strokeWidth={strokeWidth} strokeLinecap="round" />
            {safePercentage > 0 && <Path d={filledPath} fill="none" stroke="url(#gaugeGradient)" strokeWidth={strokeWidth} strokeLinecap="round" />}
          </Svg>
        </View>

        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 32, marginTop: -2 }}>{value}</Text>
        <Text numberOfLines={1} style={{ color: colors.textLight, fontSize: 9, fontWeight: '700', marginTop: 2, marginBottom: 14, textAlign: 'center' }}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function PendingReportsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [reports, setReports] = useState([]);
  const [wardReports, setWardReports] = useState([]);
  const [selectedCrimeCategory, setSelectedCrimeCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedReport, setSelectedReport] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);

  const [reportToApprove, setReportToApprove] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [dispatching, setDispatching] = useState(false);

  const [fadeAnim] = useState(() => new Animated.Value(0));

  const fetchPendingReports = useCallback(async (profile) => {
    try {
      let reportsData;
      let wardReportsData;

      if (['community_leader', 'leader'].includes(profile?.role) && profile?.ward_id) {
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
  }, []);

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
  }, [fadeAnim, fetchPendingReports]);

  const getReportCrimeCategory = (report) => {
    const category = report?.crimeCategory || report?.location?.crimeCategory;
    return CRIME_CATEGORIES.some(({ id }) => id === category) ? category : 'other_crime';
  };

  const getCrimeCategoryLabel = (value) => t(CRIME_CATEGORIES.find((category) => category.id === value)?.label || 'Other Crime');

  const getReportOtherCategory = (report) => report?.otherCategory || report?.location?.otherCategory || 'other_event';

  const getOtherCategoryLabel = (value) => t(OTHER_CATEGORIES.find((category) => category.id === value)?.label || 'Other');

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
      case 'crime': return t('Crime');
      case 'hazard': return t('Emergency');
      case 'infrastructure': return t('Infrastructure');
      case 'other': return t('Community');
      default: return t('Incident');
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

  const crimeMatrix = CRIME_CATEGORIES.map((category) => ({
    ...category,
    reports: wardReports
      .filter((report) => report.reportType === 'crime' && getReportCrimeCategory(report) === category.id)
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)),
  }));

  const totalCrimeReports = crimeMatrix.reduce((total, category) => total + category.reports.length, 0);
  const activeCrimeCategory = crimeMatrix.find((category) => category.id === selectedCrimeCategory);

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

      const communityPostTitle =
        reportToApprove.reportType === 'crime' && reportCrimeCategory !== 'other_crime' && crimeCategoryLabel
          ? `${crimeCategoryLabel.toUpperCase()} ${t('ALERT: Verified Incident')}`
          : reportToApprove.reportType === 'other' && reportOtherCategory !== 'other_event' && otherCategoryLabel
          ? `${otherCategoryLabel.toUpperCase()} ${t('UPDATE: Verified Incident')}`
          : `${t(reportToApprove.reportType?.toUpperCase() || 'INCIDENT')} ${t('ALERT: Verified Incident')}`;

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
        createdByName: t('Community Safety Team'),
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

      await fetchPendingReports(userProfile);

      const serviceNames = chosenServices.length > 0 ? chosenServices.map((service) => t(service.label)).join(', ') : t('No services');

      Alert.alert(t('Report Approved'), `${t('Dispatched')}: ${serviceNames}`);
    } catch (error) {
      Alert.alert(t('Error'), t('Error approving report. Please try again.'));
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

      await fetchPendingReports(userProfile);

      Alert.alert(t('Report Rejected'), t('The report has been rejected.'));
    } catch (error) {
      Alert.alert(t('Error'), t('Error rejecting report.'));
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
      : report.reportType === 'other'
      ? getOtherCategoryLabel(getReportOtherCategory(report))
      : null;

    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }], marginBottom: 14 }}>
        <TouchableOpacity
          onPress={() => { setSelectedReport(report); setDetailModalVisible(true); }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}
        >
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
                      <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '800' }}>{t('PENDING')}</Text>
                    </View>
                  </View>

                  {categoryLabel && <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{categoryLabel}</Text>}

                  <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 5 }}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : t('Just now')}
                    {report.ward_id ? `  -  ${t('Ward')} ${report.ward_id}` : ''}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 14 }}>
                {report.description?.substring(0, 120)}{report.description?.length > 120 ? '...' : ''}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ flex: 1, color: colors.textLight, fontSize: 11, fontWeight: '600' }}>{t('Tap to view details')}</Text>

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
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 14 }}>{t('Loading reports...')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <ScreenHeader
            title={t('Pending Reports')}
            subtitle={t('{{count}} report awaiting review', { count: reports.length })}
            meta={userProfile?.ward_number ? `${t('Ward')} ${userProfile.ward_number}` : undefined}
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
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>{t('Community Safety Review')}</Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.78, fontSize: 11, marginTop: 3 }}>{t('Review reports carefully before approval.')}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>{reports.length}</Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.75, fontSize: 9, fontWeight: '700' }}>{t('PENDING')}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {['community_leader', 'leader'].includes(userProfile?.role) && (
          <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="stats-chart" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 11 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{t('Crime Statistics')}</Text>
                <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }}>{t('Live activity reported in your ward')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '900' }}>{totalCrimeReports}</Text>
                <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '800' }}>{t('TOTAL')}</Text>
              </View>
            </View>

            <Text style={{ color: colors.textLight, fontSize: 10, lineHeight: 16, marginBottom: 12 }}>
              {t('Tap a category to view reports and reporter details. Each gauge shows reports out of 50.')}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {crimeMatrix.map((category) => (
                <StatsGauge
                  key={category.id}
                  title={t(category.label)}
                  value={category.reports.length}
                  subtitle={t('Tap to view reports')}
                  onPress={() => setSelectedCrimeCategory(category.id)}
                  icon={category.icon}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' }}>{t('Reports to Review')}</Text>
            <View style={{ backgroundColor: colors.accentLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 }}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>{reports.length}</Text>
            </View>
          </View>

          {reports.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 38, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <LinearGradient colors={[colors.accentLight, colors.surfaceRaised]} style={{ width: 82, height: 82, borderRadius: 26, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={52} color={colors.accent} />
              </LinearGradient>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 18 }}>{t('All Clear')}</Text>
              <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 7, maxWidth: 260 }}>
                {t('There are currently no reports waiting for review in your ward.')}
              </Text>
            </View>
          ) : (
            reports.map((report) => <ReportCard key={report.id} report={report} />)
          )}
        </View>
      </Animated.ScrollView>

      {activeCrimeCategory && (
        <CrimeReportsModal
          key={activeCrimeCategory.id}
          category={{ ...activeCrimeCategory, label: t(activeCrimeCategory.label) }}
          reports={activeCrimeCategory.reports}
          colors={colors}
          onClose={() => setSelectedCrimeCategory(null)}
        />
      )}

      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%', paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 }} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22, paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{t('REPORT REVIEW')}</Text>
                  <Text style={{ color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 4 }}>{t('Report Details')}</Text>
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
                        <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '800' }}>{t('INCIDENT TYPE')}</Text>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 }}>
                          {getReportTypeLabel(selectedReport.reportType)}
                        </Text>
                        {selectedReport.reportType === 'crime' && (
                          <Text style={{ color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                            {getCrimeCategoryLabel(getReportCrimeCategory(selectedReport))}
                          </Text>
                        )}
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.accentLight }}>
                        <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '900' }}>{t('PENDING')}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 7 }}>{t('DESCRIPTION')}</Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>{selectedReport.description || t('No description provided.')}</Text>
                    </View>
                  </View>

                  {getReportPhotos(selectedReport).length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 9 }}>{t('ATTACHED PHOTOS')}</Text>
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
                    <Text style={{ color: colors.textLight, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 9 }}>{t('LOCATION')}</Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="location" size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                          {selectedReport.location?.latitude ?? t('Unknown')}, {selectedReport.location?.longitude ?? t('Unknown')}
                        </Text>
                        {selectedReport.ward_id && <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 3 }}>{t('Ward')} {selectedReport.ward_id}</Text>}
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <TouchableOpacity onPress={() => openDispatchModal(selectedReport)} style={{ backgroundColor: colors.success, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>{t('Approve Report')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleReject(selectedReport.id)} style={{ backgroundColor: colors.error, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>{t('Reject Report')}</Text>
                    </TouchableOpacity>
                  </View>
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
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{t('Dispatch Services')}</Text>
                <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 2 }}>{t('Choose who should respond')}</Text>
              </View>
            </View>

            {reportToApprove && (
              <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 13, marginTop: 18, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textLight, fontSize: 9, fontWeight: '900' }}>{t('VERIFYING')}</Text>
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                  {reportToApprove.description || t('Community incident report')}
                </Text>
              </View>
            )}

            <View style={{ marginTop: 18, gap: 10 }}>
              {EMERGENCY_SERVICES.map((service) => {
                const isSelected = selectedServices.includes(service.id);

                return (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => toggleService(service.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 17, borderWidth: 1.5, borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accentLight : colors.background }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isSelected ? colors.accent : colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name={service.icon} size={21} color={isSelected ? '#FFFFFF' : colors.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{t(service.label)}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 10, marginTop: 2 }}>{t('Community emergency response')}</Text>
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
                  {t('You can approve this report without dispatching a service. It will still appear on the community feed.')}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setDispatchModalVisible(false)} disabled={dispatching} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 15, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{t('Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleConfirmApprove} disabled={dispatching} style={{ flex: 1.8, backgroundColor: colors.accent, borderRadius: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, opacity: dispatching ? 0.7 : 1 }}>
                {dispatching ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={selectedServices.length > 0 ? 'radio' : 'checkmark-circle'} size={19} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>
                      {selectedServices.length > 0 ? t('Approve & Dispatch ({{count}})', { count: selectedServices.length }) : t('Approve Only')}
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
