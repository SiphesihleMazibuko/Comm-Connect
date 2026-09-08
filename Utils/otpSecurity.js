import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'comm-connect:otp-attempts';
export const MAX_OTP_ATTEMPTS = 3;
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;

const normalisePhone = (phone) => String(phone || '').replace(/\s/g, '');

const readAttempts = async () => {
  try {
    return JSON.parse(await AsyncStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const writeAttempts = (attempts) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));

export const getOtpAttemptState = async (phone) => {
  const key = normalisePhone(phone);
  const attempts = await readAttempts();
  const state = attempts[key] || { failures: 0, lockedUntil: 0 };

  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    delete attempts[key];
    await writeAttempts(attempts);
    return { failures: 0, remaining: MAX_OTP_ATTEMPTS, locked: false, lockedUntil: 0 };
  }

  return {
    failures: state.failures || 0,
    remaining: Math.max(0, MAX_OTP_ATTEMPTS - (state.failures || 0)),
    locked: state.lockedUntil > Date.now(),
    lockedUntil: state.lockedUntil || 0,
  };
};

export const recordFailedOtpAttempt = async (phone) => {
  const key = normalisePhone(phone);
  const attempts = await readAttempts();
  const current = attempts[key] || { failures: 0, lockedUntil: 0 };
  const failures = (current.failures || 0) + 1;
  const lockedUntil = failures >= MAX_OTP_ATTEMPTS ? Date.now() + OTP_LOCKOUT_MS : 0;

  attempts[key] = { failures, lockedUntil };
  await writeAttempts(attempts);
  return getOtpAttemptState(phone);
};

export const clearOtpAttempts = async (phone) => {
  const key = normalisePhone(phone);
  const attempts = await readAttempts();
  delete attempts[key];
  await writeAttempts(attempts);
};

export const isInvalidOtpError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('invalid otp')
    || message.includes('token is invalid')
    || message.includes('expired or is invalid');
};

export const formatLockoutTime = (lockedUntil) => {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};
