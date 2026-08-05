const COUNTRY_CODES_API_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,flag,idd';

export const FALLBACK_COUNTRY_CODES = [
  { code: '+27', flag: '', name: 'ZA', countryName: 'South Africa' },
  { code: '+1', flag: '', name: 'US', countryName: 'United States' },
  { code: '+44', flag: '', name: 'GB', countryName: 'United Kingdom' },
  { code: '+91', flag: '', name: 'IN', countryName: 'India' },
  { code: '+61', flag: '', name: 'AU', countryName: 'Australia' },
  { code: '+234', flag: '', name: 'NG', countryName: 'Nigeria' },
  { code: '+254', flag: '', name: 'KE', countryName: 'Kenya' },
  { code: '+233', flag: '', name: 'GH', countryName: 'Ghana' },
  { code: '+263', flag: '', name: 'ZW', countryName: 'Zimbabwe' },
  { code: '+267', flag: '', name: 'BW', countryName: 'Botswana' },
  { code: '+264', flag: '', name: 'NA', countryName: 'Namibia' },
  { code: '+266', flag: '', name: 'LS', countryName: 'Lesotho' },
  { code: '+268', flag: '', name: 'SZ', countryName: 'Eswatini' },
  { code: '+258', flag: '', name: 'MZ', countryName: 'Mozambique' },
];

export const getDefaultCountryCode = (countryCodes = FALLBACK_COUNTRY_CODES) => {
  return countryCodes.find((country) => country.name === 'ZA') || countryCodes[0] || FALLBACK_COUNTRY_CODES[0];
};

export const searchCountryCodes = (countryCodes, query) => {
  const searchTerm = query.trim().toLowerCase();

  if (!searchTerm) return countryCodes;

  return countryCodes.filter((country) => (
    [
      country.countryName,
      country.name,
      country.code,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(searchTerm))
  ));
};

export const fetchCountryCodes = async () => {
  try {
    const response = await fetch(COUNTRY_CODES_API_URL);

    if (!response.ok) {
      throw new Error('Could not fetch country calling codes.');
    }

    const responseBody = await response.json();
    const countries = Array.isArray(responseBody) ? responseBody : [];

    const countryCodes = countries.flatMap((country) => {
      const root = country.idd?.root;
      const suffixes = Array.isArray(country.idd?.suffixes) ? country.idd.suffixes : [];

      if (!root || suffixes.length === 0) return [];

      return suffixes.map((suffix) => ({
        code: `${root}${suffix}`,
        flag: country.flag || '',
        name: country.cca2 || country.name?.common || 'Unknown',
        countryName: country.name?.common || country.cca2 || 'Unknown',
      }));
    });

    const uniqueCountryCodes = Array.from(
      new Map(countryCodes.map((country) => [`${country.name}-${country.code}`, country])).values()
    );

    if (uniqueCountryCodes.length === 0) return FALLBACK_COUNTRY_CODES;

    return uniqueCountryCodes.sort((first, second) => {
      if (first.name === 'ZA') return -1;
      if (second.name === 'ZA') return 1;
      return first.countryName.localeCompare(second.countryName);
    });
  } catch (error) {
    return FALLBACK_COUNTRY_CODES;
  }
};
