  import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const log = (...args) => console.log('[SOSNotifications]', ...args);
const warn = (...args) => console.warn('[SOSNotifications]', ...args);

const cleanPhone = (value = '') => value.replace(/[^\d+]/g, '');

export const buildSosMessage = ({ alert, trackingUrl }) => (
  `SOS ALERT: ${alert.userName || 'Your emergency contact'} needs help.\n` +
  `Live tracking: ${trackingUrl}\n` +
  'Their location updates every 10 seconds while SOS is active.'
);

export const notifyEmergencyContactsBySms = async ({ contacts, alert, trackingUrl }) => {
  const phoneNumbers = (contacts || [])
    .map((contact) => cleanPhone(contact.phone))
    .filter(Boolean);

  if (phoneNumbers.length === 0) {
    warn('No emergency contact phone numbers were found.');
    return false;
  }

  const message = buildSosMessage({ alert, trackingUrl });
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const smsUrl = `sms:${phoneNumbers.join(',')}${separator}body=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(smsUrl);

  if (!canOpen) {
    warn('SMS app is not available on this device.');
    return false;
  }

  log(`Opening SMS composer for ${phoneNumbers.length} emergency contact(s).`);
  await Linking.openURL(smsUrl);
  return true;
};

export const showLocalSosNotification = async (alertId) => {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS is active',
        body: 'Your live location is being updated every 10 seconds.',
        data: { type: 'sos_alert', sosAlertId: alertId },
      },
      trigger: null,
    });
  } catch (error) {
    warn('Local SOS notification could not be shown:', error);
  }
};
