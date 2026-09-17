import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { buildWhatsAppSosUrl } from '../Utils/sos-message';

const log = (...args) => console.log('[SOSNotifications]', ...args);
const warn = (...args) => console.warn('[SOSNotifications]', ...args);

const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';

let notificationsModule = null;

const getNotificationsModule = () => {
  if (Platform.OS === 'web' || isAndroidExpoGo) return null;

  if (!notificationsModule) {
    // Keep this optional native module in the initial bundle. A dynamic import
    // would require another Metro request at the moment an SOS is activated.
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    notificationsModule = Notifications;
  }

  return notificationsModule;
};

export const notifyEmergencyContactByWhatsApp = async ({ contact, alert, trackingUrl }) => {
  const url = buildWhatsAppSosUrl({ contact, alert, trackingUrl, platform: Platform.OS });
  log('Opening WhatsApp with the SOS message.');
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error('Install or open WhatsApp on this device, then tap the contact again.');
  }
};

export const showLocalSosNotification = async (alertId) => {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS is active',
        body: 'Your SOS stays active until you or a CPF member stops it. Open Comm-Connect to update your location.',
        data: { type: 'sos_alert', sosAlertId: alertId },
      },
      trigger: null,
    });
  } catch (error) {
    warn('Local SOS notification could not be shown:', error);
  }
};
