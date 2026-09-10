import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const validateEmail = (input = '') => {
  const value = input.trim();
  if (!value) return 'Enter your email address.';
  const parts = value.split('@');
  if (parts.length !== 2 || value.length > 254) return 'Enter a valid email address, such as name@example.com.';
  const [local, domain] = parts;
  const localValid = local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
  const labels = domain.split('.');
  const domainValid = labels.length >= 2 && labels.every((label) =>
    label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)) &&
    /^[A-Za-z]{2,}$/.test(labels.at(-1));
  return localValid && domainValid ? null : 'Enter a valid email address, such as name@example.com.';
};

export const validatePhone = (input = '', country) => {
  const value = input.trim();
  if (!value) return { error: 'Enter your phone number.' };
  if (!country?.code || !country?.name) return { error: 'Select your phone country code.' };
  if (!/^\+?[\d\s().-]+$/.test(value)) return { error: 'Use digits only, with optional spaces, brackets or hyphens.' };
  try {
    const international = value.startsWith('00') ? `+${value.slice(2)}` : value;
    const phone = parsePhoneNumberFromString(international, { defaultCountry: country.name, extract: false });
    if (!phone?.isValid() || !phone.number.startsWith(country.code) || (phone.country && phone.country !== country.name)) {
      return { error: `Enter a valid phone number for ${country.countryName || country.name}. Check the country code and number length.` };
    }
    return { value: phone.number, error: null };
  } catch {
    return { error: 'Enter a valid phone number for the selected country.' };
  }
};

// Structural validation only; this does not perform a Home Affairs identity lookup.
// Checksum specification: SARS IT3 BRS, Appendix J (ID Validation).
export const validateSouthAfricanId = (input = '', now = new Date()) => {
  const value = input.replace(/\s/g, '');
  if (!value) return 'Enter your South African ID number.';
  if (!/^\d{13}$/.test(value)) return 'Your South African ID number must contain exactly 13 digits.';
  const year = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const century = Math.floor(now.getFullYear() / 100) * 100;
  const validBirthDate = [century + year, century - 100 + year].some((fullYear) => {
    const date = new Date(fullYear, month - 1, day);
    return date.getFullYear() === fullYear && date.getMonth() === month - 1 && date.getDate() === day && date <= now;
  });
  if (!validBirthDate) return 'The date of birth in your ID number is invalid. Check the first 6 digits.';
  if (!['0', '1'].includes(value[10])) return 'The citizenship digit in your ID number is invalid. Check your ID document.';
  const sum = [...value].reduce((total, character, index) => {
    const digit = Number(character) * (index % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return sum % 10 === 0 ? null : 'Your ID number failed its checksum. Check that all 13 digits are correct.';
};

export const validateSignup = (fields) => {
  const errors = {};
  if (!['resident', 'community_leader', 'community_protection_service'].includes(fields.selectedRole)) errors.selectedRole = 'Select an account type.';
  if (!fields.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!fields.lastName.trim()) errors.lastName = 'Enter your last name.';
  const emailError = validateEmail(fields.email);
  if (emailError) errors.email = emailError;
  const phone = validatePhone(fields.phoneNumber, fields.selectedCountry);
  if (phone.error) errors.phoneNumber = phone.error;
  const idError = validateSouthAfricanId(fields.idNumber);
  if (idError) errors.idNumber = idError;
  if (fields.selectedRole === 'community_leader' && !fields.organizationName.trim()) errors.organizationName = 'Enter your community or organisation name.';
  if (fields.selectedRole === 'community_protection_service' && !fields.cpsWardName.trim()) errors.cpsWardName = 'Enter your ward name.';
  const trimmedEmail = fields.email.trim();
  const at = trimmedEmail.lastIndexOf('@');
  return {
    errors,
    values: {
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      email: at >= 0 ? `${trimmedEmail.slice(0, at)}@${trimmedEmail.slice(at + 1).toLowerCase()}` : trimmedEmail,
      phoneNumber: phone.value,
      idNumber: fields.idNumber.replace(/\s/g, ''),
      organizationName: fields.organizationName.trim(),
      cpsWardName: fields.cpsWardName.trim(),
    },
  };
};
