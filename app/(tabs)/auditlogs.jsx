import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import ScreenHeader from '../../components/ScreenHeader';
import { getCurrentUser, getRows, getUserProfile, subscribeToTable } from '../../config/supabase';
import { useTheme } from '../context/ThemeContext';

const OPERATION_META = {
  INSERT: { icon: 'add-circle', label: 'Created' },
  UPDATE: { icon: 'create', label: 'Updated' },
  DELETE: { icon: 'trash', label: 'Deleted' },
};

const SENSITIVE_FIELDS = new Set(['idNumber', 'phoneNumber', 'phone', 'contactDetails', 'qrPayload']);

const formatDateTime = (value) => {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFieldName = (field) => `${field || ''}`
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (letter) => letter.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = `${value}`;
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

const getChangeDetails = (log) => {
  if (Array.isArray(log.change_details)) return log.change_details;

  const fields = Array.isArray(log.changed_fields) ? log.changed_fields : [];
  return fields.map((field) => ({
    field,
    oldValue: log.old_record?.[field],
    newValue: log.new_record?.[field],
  }));
};

const getFallbackSummary = (log) => {
  const meta = OPERATION_META[log.operation] || { label: log.operation || 'Changed' };
  const table = `${log.table_name || 'record'}`.replace(/_/g, ' ');
  const label = log.record_label ? ` "${log.record_label}"` : '';
  return `${meta.label} ${table}${label}`;
};

export default function AuditLogsScreen() {
  const { colors } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);

  const loadLogs = async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        setIsAllowed(false);
        setLogs([]);
        return;
      }

      const profile = await getUserProfile(currentUser.id);
      const allowed = profile?.role === 'community_leader' || profile?.role === 'leader';
      setIsAllowed(allowed);
      if (!allowed) {
        setLogs([]);
        return;
      }

      const rows = await getRows('audit_logs', {
        order: [{ column: 'created_at', ascending: false }],
        allowMissingTable: true,
      });
      setLogs(rows.slice(0, 100));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs({ showLoader: true });

    const unsubscribe = subscribeToTable('audit_logs', () => {
      loadLogs();
    });

    return unsubscribe;
  }, []);

  const tableCounts = useMemo(() => (
    logs.reduce((counts, log) => ({
      ...counts,
      [log.table_name]: (counts[log.table_name] || 0) + 1,
    }), {})
  ), [logs]);

  const mostActiveTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textLight, fontSize: 14 }}>Loading activity...</Text>
      </View>
    );
  }

  if (!isAllowed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Audit Logs" subtitle="Community leader access required" meta="Restricted" icon="shield" />
        <View style={{ margin: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={34} color={colors.textLight} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 10 }}>Audit logs are restricted</Text>
          <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 }}>Only community leaders can view user activity changes.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 112 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLogs(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Audit Logs" subtitle="Specific user actions and field changes" meta={mostActiveTable ? `Most active: ${mostActiveTable}` : 'Live activity'} icon="receipt" />

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 }}>
              <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800' }}>RECENT EVENTS</Text>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 5 }}>{logs.length}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 }}>
              <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '800' }}>AUTO CAPTURE</Text>
              <Text style={{ color: colors.success, fontSize: 14, fontWeight: '900', marginTop: 9 }}>Enabled</Text>
            </View>
          </View>

          {logs.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={36} color={colors.textLight} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 10 }}>No audit activity yet</Text>
              <Text style={{ color: colors.textLight, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 }}>New inserts, updates, and deletes will appear here automatically after the audit migration is applied.</Text>
            </View>
          ) : (
            logs.map((log) => {
              const meta = OPERATION_META[log.operation] || { icon: 'ellipse', label: log.operation || 'Change' };
              const details = getChangeDetails(log).filter((detail) => !SENSITIVE_FIELDS.has(detail.field));

              return (
                <View key={log.id} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name={meta.icon} size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900', lineHeight: 20 }}>{log.action_summary || getFallbackSummary(log)}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>{formatDateTime(log.created_at)} by {log.actor_display_name || log.actor_email || 'Unknown user'}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 3 }}>{log.table_name} #{log.record_id || 'unknown'}</Text>
                    </View>
                  </View>

                  {details.length > 0 && (
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                      {details.slice(0, 6).map((detail) => (
                        <View key={`${log.id}-${detail.field}`} style={{ marginBottom: 9 }}>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{formatFieldName(detail.field)}</Text>
                          <Text style={{ color: colors.textLight, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                            {formatValue(detail.oldValue)} to {formatValue(detail.newValue)}
                          </Text>
                        </View>
                      ))}
                      {details.length > 6 && (
                        <Text style={{ color: colors.textLight, fontSize: 12, fontWeight: '700' }}>+{details.length - 6} more changes</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
