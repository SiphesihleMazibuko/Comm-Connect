import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserProfile } from '../config/supabase';
import TouchableOpacity from './FeedbackTouchableOpacity';
import { useLanguage } from '../app/context/LanguageContext';

const formatDate = (value, fallback = 'Not recorded') => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString() : fallback;
};
const statusLabel = (status) => (status || 'unknown').replace(/_/g, ' ');

function ReportDetails({ report, colors }) {
  const { t } = useLanguage();
  const reporterId = report.anonymous ? null : report.submittedBy || report.userId;
  const [reporter, setReporter] = useState(null);
  const [loading, setLoading] = useState(Boolean(reporterId));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (reporterId) {
      getUserProfile(reporterId)
        .then((profile) => { if (active) setReporter(profile); })
        .catch(() => { if (active) setReporter(null); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [reporterId, attempt]);

  const field = (label, value) => (
    <View style={{ gap: 5, marginBottom: 16 }}>
      <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800' }}>{label}</Text>
      <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{value || t('Not recorded')}</Text>
    </View>
  );
  const photos = Array.isArray(report.photoUrls) ? report.photoUrls.filter(Boolean) : [];
  const location = report.location;
  const reporterName = [reporter?.firstName, reporter?.lastName].filter(Boolean).join(' ').trim();

  return (
    <>
      {field(t('STATUS'), t(statusLabel(report.status)))}
      {field(t('REPORTED ON'), formatDate(report.createdAt, t('Not recorded')))}
      <View style={{ backgroundColor: colors.background, padding: 16, borderRadius: 16, marginBottom: 20 }}>
        <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800', marginBottom: 10 }}>{t('REPORTED BY')}</Text>
        {report.anonymous ? (
          <Text style={{ color: colors.text }}>{t('Anonymous reporter')}</Text>
        ) : loading ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textLight }}>{t('Loading reporter details...')}</Text>
          </View>
        ) : reporter ? (
          <>
            {field(t('NAME'), reporterName || t('Name not provided'))}
            {field(t('EMAIL'), reporter.email || t('Email not provided'))}
            {field(t('PHONE'), reporter.phoneNumber || t('Phone not provided'))}
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.textLight }}>{t('Reporter details are currently unavailable.')}</Text>
            {reporterId && <TouchableOpacity accessibilityRole="button" onPress={() => { setLoading(true); setAttempt((value) => value + 1); }} style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('Retry reporter details')}</Text>
            </TouchableOpacity>}
          </View>
        )}
      </View>
      {field(t('DESCRIPTION'), report.description || t('No description provided.'))}
      {field(t('LOCATION'), [location?.label, location?.digitalAddress].filter(Boolean).join(' - ') || t('Location not provided'))}
      {location?.latitude != null && location?.longitude != null && field(t('COORDINATES'), `${location.latitude}, ${location.longitude}`)}
      {report.approvedAt && field(t('APPROVED ON'), formatDate(report.approvedAt, t('Not recorded')))}
      {Array.isArray(report.dispatchedServices) && report.dispatchedServices.length > 0 && field(t('DISPATCHED SERVICES'), report.dispatchedServices.map((service) => t(statusLabel(service))).join(', '))}
      {field(t('REPORT REFERENCE'), report.id)}
      <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800', marginBottom: 10 }}>{t('ATTACHED PHOTOS')}</Text>
      {photos.length ? photos.map((uri, index) => (
        <Image key={`${uri}-${index}`} source={{ uri }} accessibilityLabel={t('Report photo {{count}}', { count: index + 1 })} resizeMode="contain" style={{ width: '100%', height: 240, backgroundColor: colors.background, borderRadius: 16, marginBottom: 12 }} />
      )) : <Text style={{ color: colors.textLight }}>{t('No photos attached.')}</Text>}
    </>
  );
}

export default function CrimeReportsModal({ category, reports, colors, onClose }) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState(null);
  const insets = useSafeAreaInsets();
  const selectedReport = reports.find((report) => report.id === selectedId);
  const goBack = () => setSelectedId(null);
  const title = selectedReport ? t('Report Details') : t('{{category}} Reports', { category: category.label });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={selectedReport ? goBack : onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', paddingTop: insets.top + 12 }}>
        <View accessibilityViewIsModal style={{ height: '92%', width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {selectedReport && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Back to {{category}} reports', { category: category.label })} onPress={goBack} style={{ padding: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>}
            <View style={{ flex: 1, gap: 4 }}>
              <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
              <Text style={{ color: colors.textLight, fontSize: 12 }}>{selectedReport ? category.label : t('{{count}} report in your ward - All statuses', { count: reports.length })}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close crime reports')} onPress={onClose} style={{ padding: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {selectedReport ? (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <ReportDetails key={`${selectedReport.id}-${selectedReport.anonymous}-${selectedReport.submittedBy || selectedReport.userId}`} report={selectedReport} colors={colors} />
            </ScrollView>
          ) : (
            <FlatList
              data={reports}
              keyExtractor={(report) => report.id}
              contentContainerStyle={{ padding: 20, flexGrow: 1, gap: 12 }}
              ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Ionicons name="documents-outline" size={40} color={colors.accent} />
                <Text style={{ color: colors.text, fontWeight: '700' }}>{t('No {{category}} reports yet', { category: category.label.toLowerCase() })}</Text>
                <Text style={{ color: colors.textLight, textAlign: 'center' }}>{t('Reports in this category will appear here when submitted in your ward.')}</Text>
              </View>}
              renderItem={({ item }) => (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${category.label} report, ${statusLabel(item.status)}, ${formatDate(item.createdAt)}`} onPress={() => setSelectedId(item.id)} style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' }}>{t(statusLabel(item.status))}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                  </View>
                  <Text numberOfLines={3} style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{item.description || t('No description provided.')}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 12 }}>{formatDate(item.createdAt, t('Not recorded'))}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 12 }}>{item.anonymous ? t('Anonymous reporter') : t('View reporter and full details')}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
