import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const log = (...args) => console.log('[SOSNotifications]', ...args);
const warn = (...args) => console.warn('[SOSNotifications]', ...args);

const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';

let notificationsModulePromise = null;

const getNotificationsModule = async () => {
  if (Platform.OS === 'web' || isAndroidExpoGo) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      return Notifications;
    });
  }

  return notificationsModulePromise;
};

const cleanPhone = (value = '') => value.replace(/[^\d+]/g, '');
const cleanWhatsAppPhone = (value = '') => cleanPhone(value).replace(/^\+/, '');

const isHttpUrl = (value = '') => /^https?:\/\//i.test(value);

export const buildSosMessage = ({ alert, trackingUrl, mapUrl }) => {
  const hasClickableTrackingUrl = isHttpUrl(trackingUrl);
  const lines = [
    `SOS ALERT: ${alert.userName || 'Your emergency contact'} needs help.`,
  ];

  if (hasClickableTrackingUrl) {
    lines.push(`Live tracking: ${trackingUrl}`);
  }

  if (mapUrl && (!hasClickableTrackingUrl || mapUrl !== trackingUrl)) {
    lines.push(`Current map location: ${mapUrl}`);
  }

  lines.push('Their location updates every 10 seconds while SOS is active.');

  return lines.join('\n');
};

export const notifyEmergencyContactsByWhatsApp = async ({ contacts, alert, trackingUrl, mapUrl }) => {
  const phoneNumbers = (contacts || [])
    .map((contact) => cleanWhatsAppPhone(contact.phone))
    .filter(Boolean);

  if (phoneNumbers.length === 0) {
    warn('No emergency contact phone numbers were found.');
    return false;
  }

  const message = buildSosMessage({ alert, trackingUrl, mapUrl });
  const encodedMessage = encodeURIComponent(message);
  const primaryPhoneNumber = phoneNumbers[0];
  const whatsappUrl = `whatsapp://send?phone=${primaryPhoneNumber}&text=${encodedMessage}`;
  const whatsappWebUrl = `https://wa.me/${primaryPhoneNumber}?text=${encodedMessage}`;
  try {
    const canOpenWhatsApp = Platform.OS !== 'web' && (await Linking.canOpenURL(whatsappUrl));

    log(`Opening WhatsApp for ${phoneNumbers.length} SOS contact(s).`);

    if (canOpenWhatsApp) {
      await Linking.openURL(whatsappUrl);
      return true;
    }

    await Linking.openURL(whatsappWebUrl);
    return true;
  } catch (error) {
    warn('WhatsApp could not be opened on this device:', error);
    return false;
  }
};

export const showLocalSosNotification = async (alertId) => {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

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
