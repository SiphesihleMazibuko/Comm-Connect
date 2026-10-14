import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TouchableOpacity from '../../components/FeedbackTouchableOpacity';
import ScreenHeader from '../../components/ScreenHeader';
import { getRows, subscribeToTable, updateRow } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';

const REPORT_TYPES = [
  { id: 'crime', label: 'Crime', icon: 'warning' },
  { id: 'hazard', label: 'Emergency', icon: 'alert-circle' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'business' },
  { id: 'other', label: 'Community', icon: 'chatbubbles' },
];

const ADMIN_MENU_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'User Management', icon: 'people' },
  { id: 'emergencies', label: 'Emergency Management', icon: 'alert-circle' },
  { id: 'reports', label: 'Community Reports', icon: 'document-text' },
  { id: 'audit', label: 'Audit Logs', icon: 'receipt' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'exports', label: 'Exports', icon: 'download' },
  { id: 'monitoring', label: 'System Monitoring', icon: 'pulse' },

];

const ROLE_OPTIONS = [
  { id: 'resident', label: 'Resident' },
  { id: 'community_leader', label: 'Community Leader' },
  { id: 'community_protection_service', label: 'CPS Responder' },
  { id: 'admin', label: 'Admin' },
];

const formatNumber = (value) => new Intl.NumberFormat().format(value || 0);

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

const getActiveSosAlerts = (rows) =>
  (rows || []).filter((alert) => {
    const emergencyType = `${alert?.emergencyType || ''}`.toLowerCase();
    const status = `${alert?.status || ''}`.toLowerCase();
    return emergencyType === 'sos' && ['active', 'pending', 'open'].includes(status);
  });

const getDisplayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Unnamed account';

const getRoleLabel = (role) => ROLE_OPTIONS.find((option) => option.id === role)?.label || role || 'Unknown';

const getRecentRows = (rows, dateField) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    const timestamp = Date.parse(row?.[dateField]);
    return Number.isFinite(timestamp) && timestamp >= weekAgo;
  });
};

const escapeCsvCell = (value) => `"${`${value ?? ''}`.replace(/"/g, '""')}"`;
const escapeHtml = (value) =>
  `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildCsv = (headers, rows) => [
  headers.map(({ label }) => escapeCsvCell(label)).join(','),
  ...rows.map((row) => headers.map(({ key }) => escapeCsvCell(row?.[key])).join(',')),
].join('\n');

const buildXls = (headers, rows) => `
  <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <table>
        <thead>
          <tr>${headers.map(({ label }) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map(({ key }) => `<td>${escapeHtml(row?.[key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body>
  </html>
`;

const buildPdfHtml = (label, headers, rows) => `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(label)} Export</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { font-size: 22px; margin-bottom: 6px; }
        p { color: #4B5563; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #D1D5DB; padding: 7px; text-align: left; vertical-align: top; }
        th { background: #F3F4F6; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(label)} Export</h1>
      <p>${rows.length} row${rows.length === 1 ? '' : 's'} exported on ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr>${headers.map(({ label: headerLabel }) => `<th>${escapeHtml(headerLabel)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map(({ key }) => `<td>${escapeHtml(row?.[key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </body>
  </html>
`;

function StatCard({ title, value, subtitle, icon, tone, colors }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: colors.cardShadowOpacity,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            backgroundColor: tone.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={22} color={tone.foreground} />
        </View>
        <Ionicons name="trending-up" size={18} color={colors.textLighter} />
      </View>

      <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
        {title}
      </Text>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', marginTop: 5 }}>
        {formatNumber(value)}
      </Text>
      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
        {subtitle}
      </Text>
    </View>
  );
}

function InsightRow({ label, value, icon, colors }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight || colors.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 11,
        }}
      >
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{formatNumber(value)}</Text>
    </View>
  );
}

function MetricBar({ label, value, max, colors }) {
  const width = max > 0 ? Math.max(5, Math.round((value / max) * 100)) : 0;

  return (
    <View style={{ marginBottom: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: colors.textLight, fontSize: 12, fontWeight: '800' }}>{formatNumber(value)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.background, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: `${width}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

function HealthRow({ label, status, detail, tone, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight || colors.border }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tone, marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900' }}>{label}</Text>
        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{detail}</Text>
      </View>
      <Text style={{ color: tone, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{status}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [usersData, reportsData, emergencyData, auditData] = await Promise.all([
        getRows('users'),
        getRows('reports'),
        getRows('emergencyRequests'),
        getRows('audit_logs', {
          allowMissingTable: true,
          order: [{ column: 'created_at', ascending: false }],
        }),
      ]);

      setUsers(usersData || []);
      setReports(reportsData || []);
      setAuditLogs(auditData || []);
      setEmergencyAlerts(emergencyData || []);
      setSosAlerts(getActiveSosAlerts(emergencyData));
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(loadDashboard, 0);

    const unsubscribeUsers = subscribeToTable('users', loadDashboard);
    const unsubscribeReports = subscribeToTable('reports', loadDashboard);
    const unsubscribeEmergencies = subscribeToTable('emergencyRequests', loadDashboard);
    const unsubscribeAuditLogs = subscribeToTable('audit_logs', loadDashboard);

    return () => {
      clearTimeout(initialLoad);
      unsubscribeUsers?.();
      unsubscribeReports?.();
      unsubscribeEmergencies?.();
      unsubscribeAuditLogs?.();
    };
  }, [loadDashboard]);

  const reportBreakdown = useMemo(
    () =>
      REPORT_TYPES.map((type) => ({
        ...type,
        count: reports.filter((report) => report.reportType === type.id).length,
      })),
    [reports]
  );

  const pendingReports = reports.filter((report) => report.status === 'pending_review').length;
  const approvedReports = reports.filter((report) => report.status === 'approved').length;
  const rejectedReports = reports.filter((report) => report.status === 'rejected').length;
  const adminUsers = users.filter((user) => user.role === 'admin').length;
  const responderUsers = users.filter((user) =>
    ['community_protection_service', 'emergency_responder'].includes(user.role)
  ).length;
  const pendingUsers = users.filter((user) => user.approvalStatus === 'pending').length;
  const activeEmergencies = emergencyAlerts.filter((alert) =>
    ['active', 'pending', 'open'].includes(`${alert?.status || ''}`.toLowerCase())
  );
  const recentUsers = getRecentRows(users, 'createdAt').length;
  const recentReports = getRecentRows(reports, 'createdAt').length;
  const recentAlerts = getRecentRows(emergencyAlerts, 'createdAt').length;
  const recentAuditEvents = getRecentRows(auditLogs, 'created_at').length;
  const maxReportTypeCount = Math.max(1, ...reportBreakdown.map((type) => type.count));
  const maxRoleCount = Math.max(
    1,
    ...ROLE_OPTIONS.map((role) => users.filter((user) => user.role === role.id).length)
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const openSection = (section) => {
    setActiveSection(section);
    setMenuVisible(false);
  };

  const updateUserRole = async (user, role) => {
    setUpdatingId(user.id);

    try {
      await updateRow('users', user.id, { role, requestedRole: null, approvalStatus: 'approved' });
      await loadDashboard();
      Alert.alert('Role Updated', `${getDisplayName(user)} is now ${getRoleLabel(role)}.`);
    } catch (error) {
      Alert.alert('Update Failed', error?.message || 'Could not update this account role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateEmergencyStatus = async (alert, status) => {
    setUpdatingId(alert.id);

    try {
      await updateRow('emergencyRequests', alert.id, { status, updatedAt: new Date().toISOString() });
      await loadDashboard();
    } catch (error) {
      Alert.alert('Update Failed', error?.message || 'Could not update this emergency status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateReportStatus = async (report, status) => {
    setUpdatingId(report.id);

    try {
      await updateRow('reports', report.id, {
        status,
        moderatedAt: new Date().toISOString(),
      });
      await loadDashboard();
    } catch (error) {
      Alert.alert('Update Failed', error?.message || 'Could not update this report.');
    } finally {
      setUpdatingId(null);
    }
  };

  const downloadExport = (label, headers, rows, format) => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-${stamp}.${format}`;
    const content =
      format === 'csv'
        ? buildCsv(headers, rows)
        : format === 'xls'
        ? buildXls(headers, rows)
        : buildPdfHtml(label, headers, rows);
    const mime =
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : format === 'xls'
        ? 'application/vnd.ms-excel;charset=utf-8'
        : 'text/html;charset=utf-8';

    if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof Blob !== 'undefined') {
      if (format === 'pdf') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          Alert.alert('Pop-up Blocked', 'Allow pop-ups for this site, then try the PDF export again.');
          return;
        }
        printWindow.document.open();
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    Alert.alert(
      'Export Available on Web',
      'This build can generate downloadable CSV, XLS, and printable PDF files in the web app. Native file export needs expo-file-system and expo-sharing added.'
    );
  };

  const showExportOptions = (label, headers, rows) => {
    Alert.alert(
      `${label} Export`,
      `Choose a format for ${rows.length} row${rows.length === 1 ? '' : 's'}.`,
      [
        { text: 'CSV', onPress: () => downloadExport(label, headers, rows, 'csv') },
        { text: 'XLS', onPress: () => downloadExport(label, headers, rows, 'xls') },
        { text: 'PDF', onPress: () => downloadExport(label, headers, rows, 'pdf') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textLight, marginTop: 12, fontWeight: '700' }}>Loading admin dashboard...</Text>
      </View>
    );
  }

  const activeItem = ADMIN_MENU_ITEMS.find((item) => item.id === activeSection) || ADMIN_MENU_ITEMS[0];

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay || 'rgba(0,0,0,0.45)', flexDirection: 'row' }}>
          <View style={{ width: 304, maxWidth: '82%', backgroundColor: colors.surface, paddingTop: 22, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Admin Menu</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close admin menu" onPress={() => setMenuVisible(false)} style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {ADMIN_MENU_ITEMS.map((item) => {
              const selected = activeSection === item.id;

              return (
                <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => openSection(item.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 8, marginBottom: 9, backgroundColor: selected ? colors.accentLight : 'transparent', borderWidth: 1, borderColor: selected ? colors.accent : colors.border }}>
                  <Ionicons name={item.icon} size={20} color={selected ? colors.accent : colors.textLight} />
                  <Text style={{ color: selected ? colors.accent : colors.text, fontSize: 15, fontWeight: '800', marginLeft: 11 }}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close admin menu" onPress={() => setMenuVisible(false)} style={{ flex: 1 }} />
        </View>
      </Modal>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open admin menu" onPress={() => setMenuVisible(true)} style={{ position: 'absolute', left: 18, top: 18, zIndex: 10, width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="menu" size={25} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <ScreenHeader
          title={activeSection === 'overview' ? 'Admin Dashboard' : activeItem.label}
          subtitle={
              activeSection === 'users'
                ? 'View accounts and manage roles'
                : activeSection === 'emergencies'
                ? 'Review alerts and track their status'
                : activeSection === 'reports'
                ? 'Review and moderate submissions'
                : activeSection === 'audit'
                ? 'Track administrative actions'
                : activeSection === 'analytics'
                ? 'Trends and operational insights'
                : activeSection === 'exports'
                ? 'Prepare operational data extracts'
                : activeSection === 'monitoring'
                ? 'Monitor data freshness and system health'
                : activeSection === 'campaigns'
                ? 'Planned notification tooling'
                : 'Overview of users, SOS alerts, and community reports'
          }
          meta={activeSection === 'overview' ? 'System overview' : 'Admin workspace'}
          icon={activeItem.icon}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {activeSection === 'overview' && (
            <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatCard
              title="Total Users"
              value={users.length}
              subtitle={`${formatNumber(adminUsers)} admins · ${formatNumber(responderUsers)} responders`}
              icon="people"
              tone={{ background: colors.infoLight, foreground: colors.info }}
              colors={colors}
            />
            <StatCard
              title="SOS Alerts"
              value={sosAlerts.length}
              subtitle="Active SOS requests needing attention"
              icon="alert-circle"
              tone={{ background: colors.errorLight, foreground: colors.error }}
              colors={colors}
            />
            <StatCard
              title="Reports"
              value={reports.length}
              subtitle={`${formatNumber(pendingReports)} pending · ${formatNumber(approvedReports)} approved`}
              icon="document-text"
              tone={{ background: colors.warningLight, foreground: colors.warning }}
              colors={colors}
            />
          </View>

          <LinearGradient
            colors={[colors.primary, colors.greenTeal || colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 8, padding: 18, marginTop: 18 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 13,
                }}
              >
                <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>Live Operations Snapshot</Text>
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 4 }}>
                  {sosAlerts.length > 0
                    ? `${formatNumber(sosAlerts.length)} SOS alert${sosAlerts.length === 1 ? '' : 's'} currently active`
                    : 'No active SOS alerts at the moment'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 8,
              padding: 16,
              marginTop: 18,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>Report Breakdown</Text>
            <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 8 }}>Reports grouped by category</Text>
            {reportBreakdown.map((type) => (
              <InsightRow key={type.id} label={type.label} value={type.count} icon={type.icon} colors={colors} />
            ))}
          </View>
            </>
          )}

          {activeSection === 'users' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="Accounts" value={users.length} subtitle={`${formatNumber(pendingUsers)} waiting for approval`} icon="people" tone={{ background: colors.infoLight, foreground: colors.info }} colors={colors} />
                <StatCard title="Admins" value={adminUsers} subtitle="Approved administrator accounts" icon="shield-checkmark" tone={{ background: colors.successLight, foreground: colors.success }} colors={colors} />
              </View>

              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>User Management</Text>
              {users.map((user) => (
                <View key={user.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="person" size={21} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{getDisplayName(user)}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 3 }}>{getRoleLabel(user.role)}</Text>
                      {user.requestedRole && (
                        <Text style={{ color: colors.warning, fontSize: 12, marginTop: 3, fontWeight: '800' }}>Requested: {getRoleLabel(user.requestedRole)}</Text>
                      )}
                    </View>
                    <View style={{ backgroundColor: user.approvalStatus === 'pending' ? colors.warningLight : colors.successLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
                      <Text style={{ color: user.approvalStatus === 'pending' ? colors.warning : colors.success, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{user.approvalStatus || 'approved'}</Text>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 13 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {ROLE_OPTIONS.map((role) => (
                        <TouchableOpacity key={role.id} disabled={updatingId === user.id || user.role === role.id} onPress={() => updateUserRole(user, role.id)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: user.role === role.id ? colors.accent : colors.background, borderWidth: 1, borderColor: user.role === role.id ? colors.accent : colors.border, opacity: updatingId === user.id ? 0.6 : 1 }}>
                          <Text style={{ color: user.role === role.id ? colors.textInverse : colors.text, fontSize: 12, fontWeight: '800' }}>{role.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>
          )}

          {activeSection === 'emergencies' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="Active Alerts" value={activeEmergencies.length} subtitle="Alerts currently open or pending" icon="radio" tone={{ background: colors.errorLight, foreground: colors.error }} colors={colors} />
                <StatCard title="SOS Alerts" value={sosAlerts.length} subtitle="SOS emergency requests" icon="alert-circle" tone={{ background: colors.warningLight, foreground: colors.warning }} colors={colors} />
              </View>

              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Emergency Management</Text>
              {emergencyAlerts.length === 0 ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 34, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="shield-checkmark-outline" size={44} color={colors.accent} />
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>No Alerts</Text>
                  <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', marginTop: 6 }}>Emergency alerts will appear here when residents submit them.</Text>
                </View>
              ) : (
                emergencyAlerts.map((alert) => (
                  <View key={alert.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: `${alert.emergencyType || ''}`.toLowerCase() === 'sos' ? colors.error : colors.warning }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="alert-circle" size={22} color={colors.error} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', textTransform: 'capitalize' }}>{alert.emergencyType || 'Emergency'} Alert</Text>
                        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{alert.userName || 'Unknown resident'} · {formatDateTime(alert.createdAt)}</Text>
                        <Text style={{ color: colors.text, fontSize: 13, marginTop: 8, lineHeight: 19 }} numberOfLines={3}>{alert.description || alert.message || 'No alert description provided.'}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{alert.status || 'active'}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
                      {['active', 'in_review', 'resolved'].map((status) => (
                        <TouchableOpacity key={status} disabled={updatingId === alert.id || alert.status === status} onPress={() => updateEmergencyStatus(alert, status)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: alert.status === status ? colors.accent : colors.background, borderWidth: 1, borderColor: alert.status === status ? colors.accent : colors.border, opacity: updatingId === alert.id ? 0.6 : 1 }}>
                          <Text style={{ color: alert.status === status ? colors.textInverse : colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{status.replace('_', ' ')}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeSection === 'reports' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="Pending" value={pendingReports} subtitle="Reports awaiting moderation" icon="time" tone={{ background: colors.warningLight, foreground: colors.warning }} colors={colors} />
                <StatCard title="Approved" value={approvedReports} subtitle="Visible to the community" icon="checkmark-circle" tone={{ background: colors.successLight, foreground: colors.success }} colors={colors} />
                <StatCard title="Rejected" value={rejectedReports} subtitle="Removed from the queue" icon="close-circle" tone={{ background: colors.errorLight, foreground: colors.error }} colors={colors} />
              </View>

              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Community Reports</Text>
              {reports.length === 0 ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 34, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="document-text-outline" size={44} color={colors.accent} />
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>No Reports</Text>
                  <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', marginTop: 6 }}>Community submissions will appear here for review.</Text>
                </View>
              ) : (
                reports.map((report) => (
                  <View key={report.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="document-text" size={21} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', textTransform: 'capitalize' }}>{report.reportType || 'Report'}</Text>
                        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{formatDateTime(report.createdAt)}</Text>
                        <Text style={{ color: colors.text, fontSize: 13, marginTop: 8, lineHeight: 19 }} numberOfLines={3}>{report.description || 'No description provided.'}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{report.status || 'pending'}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
                      {[
                        { id: 'pending_review', label: 'Review' },
                        { id: 'approved', label: 'Approve' },
                        { id: 'rejected', label: 'Reject' },
                      ].map((status) => (
                        <TouchableOpacity key={status.id} disabled={updatingId === report.id || report.status === status.id} onPress={() => updateReportStatus(report, status.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: report.status === status.id ? colors.accent : colors.background, borderWidth: 1, borderColor: report.status === status.id ? colors.accent : colors.border, opacity: updatingId === report.id ? 0.6 : 1 }}>
                          <Text style={{ color: report.status === status.id ? colors.textInverse : colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{status.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeSection === 'audit' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="Audit Events" value={auditLogs.length} subtitle="Administrative and data changes" icon="receipt" tone={{ background: colors.infoLight, foreground: colors.info }} colors={colors} />
              </View>

              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Audit Logs</Text>
              {auditLogs.length === 0 ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 34, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="receipt-outline" size={44} color={colors.accent} />
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>No Audit Logs</Text>
                  <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', marginTop: 6 }}>Logs will show here when the database allows this admin account to read them.</Text>
                </View>
              ) : (
                auditLogs.map((log) => (
                  <View key={log.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="receipt" size={20} color={colors.info} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>{log.action_summary || `${log.operation || 'Change'} on ${log.table_name || 'record'}`}</Text>
                        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{formatDateTime(log.created_at)}</Text>
                        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{log.actor_display_name || log.actor_email || 'Unknown actor'}</Text>
                        {!!log.record_label && (
                          <Text style={{ color: colors.text, fontSize: 13, marginTop: 8 }} numberOfLines={2}>{log.record_label}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeSection === 'analytics' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="New Users" value={recentUsers} subtitle="Joined in the last 7 days" icon="person-add" tone={{ background: colors.infoLight, foreground: colors.info }} colors={colors} />
                <StatCard title="New Reports" value={recentReports} subtitle="Submitted in the last 7 days" icon="document-text" tone={{ background: colors.warningLight, foreground: colors.warning }} colors={colors} />
                <StatCard title="New Alerts" value={recentAlerts} subtitle="Emergency requests in the last 7 days" icon="alert-circle" tone={{ background: colors.errorLight, foreground: colors.error }} colors={colors} />
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Report Mix</Text>
                {reportBreakdown.map((type) => (
                  <MetricBar key={type.id} label={type.label} value={type.count} max={maxReportTypeCount} colors={colors} />
                ))}
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Account Roles</Text>
                {ROLE_OPTIONS.map((role) => (
                  <MetricBar key={role.id} label={role.label} value={users.filter((user) => user.role === role.id).length} max={maxRoleCount} colors={colors} />
                ))}
              </View>
            </View>
          )}

          {activeSection === 'exports' && (
            <View style={{ marginTop: 18 }}>
              {[
                {
                  icon: 'people',
                  title: 'Users Export',
                  subtitle: `${formatNumber(users.length)} account rows`,
                  action: () => showExportOptions('Users', [
                    { key: 'id', label: 'ID' },
                    { key: 'firstName', label: 'First Name' },
                    { key: 'lastName', label: 'Last Name' },
                    { key: 'role', label: 'Role' },
                    { key: 'approvalStatus', label: 'Approval Status' },
                  ], users),
                },
                {
                  icon: 'document-text',
                  title: 'Reports Export',
                  subtitle: `${formatNumber(reports.length)} community report rows`,
                  action: () => showExportOptions('Reports', [
                    { key: 'id', label: 'ID' },
                    { key: 'reportType', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'description', label: 'Description' },
                    { key: 'createdAt', label: 'Created At' },
                  ], reports),
                },
                {
                  icon: 'alert-circle',
                  title: 'Emergency Alerts Export',
                  subtitle: `${formatNumber(emergencyAlerts.length)} emergency rows`,
                  action: () => showExportOptions('Emergency Alerts', [
                    { key: 'id', label: 'ID' },
                    { key: 'emergencyType', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'userName', label: 'Resident' },
                    { key: 'createdAt', label: 'Created At' },
                  ], emergencyAlerts),
                },
                {
                  icon: 'receipt',
                  title: 'Audit Logs Export',
                  subtitle: `${formatNumber(auditLogs.length)} audit rows`,
                  action: () => showExportOptions('Audit Logs', [
                    { key: 'id', label: 'ID' },
                    { key: 'operation', label: 'Operation' },
                    { key: 'table_name', label: 'Table' },
                    { key: 'actor_display_name', label: 'Actor' },
                    { key: 'created_at', label: 'Created At' },
                  ], auditLogs),
                },
              ].map((item) => (
                <TouchableOpacity key={item.title} accessibilityRole="button" onPress={item.action} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={item.icon} size={21} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{item.title}</Text>
                    <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="download" size={20} color={colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeSection === 'monitoring' && (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <StatCard title="Data Tables" value={4} subtitle="Users, reports, alerts, audit logs" icon="server" tone={{ background: colors.infoLight, foreground: colors.info }} colors={colors} />
                <StatCard title="Open Alerts" value={activeEmergencies.length} subtitle="Operational load right now" icon="pulse" tone={{ background: colors.errorLight, foreground: colors.error }} colors={colors} />
                <StatCard title="Audit Activity" value={recentAuditEvents} subtitle="Audit events in the last 7 days" icon="receipt" tone={{ background: colors.successLight, foreground: colors.success }} colors={colors} />
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>System Health</Text>
                <HealthRow label="Supabase Data Sync" status="online" detail={`${formatNumber(users.length + reports.length + emergencyAlerts.length + auditLogs.length)} records loaded`} tone={colors.success} colors={colors} />
                <HealthRow label="Realtime Subscriptions" status="active" detail="Listening for users, reports, emergency requests, and audit logs" tone={colors.success} colors={colors} />
                <HealthRow label="Emergency Queue" status={activeEmergencies.length > 0 ? 'attention' : 'clear'} detail={`${formatNumber(activeEmergencies.length)} active emergency alert${activeEmergencies.length === 1 ? '' : 's'}`} tone={activeEmergencies.length > 0 ? colors.warning : colors.success} colors={colors} />
                <HealthRow label="Moderation Queue" status={pendingReports > 0 ? 'pending' : 'clear'} detail={`${formatNumber(pendingReports)} report${pendingReports === 1 ? '' : 's'} awaiting moderation`} tone={pendingReports > 0 ? colors.warning : colors.success} colors={colors} />
                <HealthRow label="Audit Visibility" status={auditLogs.length > 0 ? 'active' : 'quiet'} detail={auditLogs.length > 0 ? 'Audit log records are available to this admin account' : 'No audit log records are currently visible'} tone={auditLogs.length > 0 ? colors.success : colors.warning} colors={colors} />
              </View>
            </View>
          )}


        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
