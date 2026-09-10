export const normalizeWhatsAppPhone = (value = '') => {
  let phone = String(value).replace(/[^\d+]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  else if (phone.startsWith('+')) phone = phone.slice(1);
  else if (/^0\d{9}$/.test(phone)) phone = `27${phone.slice(1)}`;
  return /^[1-9]\d{6,14}$/.test(phone) ? phone : null;
};

export const buildSosMessage = ({ alert, trackingUrl }) => {
  const location = alert.location?.currentLocation || alert.location || {};
  const hasCoordinates = location.latitude != null && location.longitude != null &&
    Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${Number(location.latitude)},${Number(location.longitude)}`
    : null;
  return [
    `SOS ALERT: ${alert.userName || 'Your emergency contact'} needs help.`,
    mapsUrl ? `Location at time of sharing:\n${mapsUrl}` : 'Location is currently unavailable.',
    /^https:\/\//i.test(trackingUrl || '') ? `Live tracking:\n${trackingUrl}` : null,
    'This SOS remains active in Comm-Connect until the resident or a CPF member stops it.',
  ].filter(Boolean).join('\n\n');
};

export const buildWhatsAppSosUrl = ({ contact, alert, trackingUrl, platform = 'web' }) => {
  const phone = normalizeWhatsAppPhone(contact?.phone);
  if (!phone) throw new Error('This contact needs a valid phone number with country code.');
  const text = encodeURIComponent(buildSosMessage({ alert, trackingUrl }));
  return platform === 'web'
    ? `https://wa.me/${phone}?text=${text}`
    : `whatsapp://send?phone=${phone}&text=${text}`;
};
