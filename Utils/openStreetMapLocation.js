const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_EMAIL = process.env.EXPO_PUBLIC_NOMINATIM_EMAIL;

const getFirstValue = (values) => values.find((value) => typeof value === 'string' && value.trim()) || '';

export const reverseGeocodeWithOpenStreetMap = async (latitude, longitude) => {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'en',
  });

  if (NOMINATIM_EMAIL) {
    params.append('email', NOMINATIM_EMAIL);
  }

  const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Pinpoint/1.0 contact:pinpoint-app',
      Referer: 'pinpoint://signup',
    },
  });

  if (!response.ok) {
    throw new Error('Could not fetch OpenStreetMap location details.');
  }

  const data = await response.json();
  const address = data.address || {};

  return {
    displayName: data.display_name || '',
    province: getFirstValue([address.state, address.province, address.region]),
    cityTown: getFirstValue([
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.county,
      address.state_district,
    ]),
    suburb: getFirstValue([
      address.suburb,
      address.neighbourhood,
      address.quarter,
      address.city_district,
      address.hamlet,
      address.village,
    ]),
    district: getFirstValue([address.county, address.state_district, address.municipality]),
    road: address.road || '',
    postcode: address.postcode || '',
    country: address.country || '',
    rawAddress: address,
  };
};

export const searchOpenStreetMapAddress = async (query) => {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) throw new Error('Enter an address to search.');
  const params = new URLSearchParams({ format: 'jsonv2', q: trimmedQuery, limit: '1', addressdetails: '1' });
  if (NOMINATIM_EMAIL) params.append('email', NOMINATIM_EMAIL);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Pinpoint/1.0 contact:pinpoint-app', Referer: 'pinpoint://walkwithme' },
  });
  if (!response.ok) throw new Error('Address search is unavailable. Enter coordinates manually.');
  const results = await response.json();
  const result = results?.[0];
  if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) throw new Error('No coordinates found. Try a more specific address or enter coordinates manually.');
  return { label: result.display_name || trimmedQuery, latitude: String(result.lat), longitude: String(result.lon) };
};

export const buildOpenStreetMapAddressLabel = (locationDetails, fallback) => {
  const address = locationDetails?.rawAddress || {};

  return [
    address.house_number,
    locationDetails?.road,
    locationDetails?.suburb,
    locationDetails?.cityTown,
    locationDetails?.district,
    locationDetails?.province,
    locationDetails?.country,
  ].filter(Boolean).join(', ') || locationDetails?.displayName || fallback;
};
