const COUNTRY_CODES_API_URL = 'https://api.restcountries.com/countries/v5';
const COUNTRY_CODES_API_PAGE_SIZE = 100;
const REST_COUNTRIES_API_KEY = process.env.EXPO_PUBLIC_RESTCOUNTRIES_API_KEY;

export const FALLBACK_COUNTRY_CODES = [
  { code: '+27', flag: '🇿🇦', name: 'ZA', countryName: 'South Africa' },
  { code: '+1', flag: '🇺🇸', name: 'US', countryName: 'United States' },
  { code: '+44', flag: '🇬🇧', name: 'GB', countryName: 'United Kingdom' },
  { code: '+91', flag: '🇮🇳', name: 'IN', countryName: 'India' },
  { code: '+61', flag: '🇦🇺', name: 'AU', countryName: 'Australia' },
];

export const getDefaultCountryCode = (countryCodes = FALLBACK_COUNTRY_CODES) => {
  return countryCodes.find((country) => country.name === 'ZA') || countryCodes[0] || FALLBACK_COUNTRY_CODES[0];
};

export const fetchCountryCodes = async () => {
  if (!REST_COUNTRIES_API_KEY) {
    throw new Error('Missing Rest Countries API key.');
  }

  const countries = [];
  let offset = 0;
  let hasMoreCountries = true;

  while (hasMoreCountries) {
    const response = await fetch(
      `${COUNTRY_CODES_API_URL}?limit=${COUNTRY_CODES_API_PAGE_SIZE}&offset=${offset}&response_fields=names.common,codes.alpha_2,flag.emoji,calling_codes`,
      {
        headers: {
          Authorization: `Bearer ${REST_COUNTRIES_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Could not fetch country calling codes.');
    }

    const responseBody = await response.json();
    const pageCountries = responseBody.data?.objects || [];

    countries.push(...pageCountries);
    hasMoreCountries = Boolean(responseBody.data?.meta?.more);
    offset += COUNTRY_CODES_API_PAGE_SIZE;
  }

  const countryCodes = countries.flatMap((country) => {
    const callingCodes = Array.isArray(country.calling_codes) ? country.calling_codes : [];

    if (callingCodes.length === 0) return [];

    return callingCodes.map((callingCode) => {
      const code = String(callingCode).startsWith('+') ? String(callingCode) : `+${callingCode}`;

      return {
        code,
        flag: country.flag?.emoji || '',
        name: country.codes?.alpha_2 || country.names?.common || 'Unknown',
        countryName: country.names?.common || country.codes?.alpha_2 || 'Unknown',
      };
    });
  });

  const uniqueCountryCodes = Array.from(
    new Map(countryCodes.map((country) => [`${country.name}-${country.code}`, country])).values()
  );

  return uniqueCountryCodes.sort((first, second) => {
    if (first.name === 'ZA') return -1;
    if (second.name === 'ZA') return 1;
    return first.countryName.localeCompare(second.countryName);
  });
};
