import { cacheRow } from './localDb/offlineStore';
import { getSupabaseClient, withRequestTimeout } from './supabase';

// Do not queue stop requests offline or hide an SOS before the server confirms.
export const stopSosAlert = async (alertId) => {
  const { data, error } = await withRequestTimeout(
    getSupabaseClient().rpc('stop_sos_alert', { alert_id: alertId }),
  );
  if (error) throw error;
  if (!data || !['cancelled', 'completed', 'resolved'].includes(data.status)) {
    throw new Error('The SOS could not be confirmed as stopped. Please try again.');
  }
  await cacheRow('emergencyRequests', data);
  return data;
};
