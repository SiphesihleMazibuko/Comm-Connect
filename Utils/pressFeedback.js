import * as Haptics from 'expo-haptics';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

const TAP_SOUND_URI = 'data:audio/wav;base64,UklGRvQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YdACAAAAAKol+SsxDjLltdKQ5c4NMiqmIwAA19zz1sHyBhlIKq8YHfOc2LneAADTIFMmXgyj6IfY9egIDMYkER8AAFvhOdx09M8V2iSDFcX0q93/4gAAnBxmIccKpOuZ3evrfAoNIBQbAABL5dLg8PUCEx4gwBI29hTiueYAAO8YHB1lCUHuBeJ/7iMJ7xuZFwAAuejT5Dv3kRD+G1cQePfs5fjpAAC7FV8ZMAiJ8N/lv/D3B1gYkRQAALfrUehb+HAOZRg+DpH4RunN7AAA8BIcFiMHhvI66bXy8QY4Fe0RAABS7lzrV/mVDEMVaQyF+THsRO8AAIEQRRM4BkH0J+xq9A0GfhKfDwAAl/AD7jL69wqIEtEKWvq97mrxAABjDssQawXD9bTu5/VGBR4QnQ0AAJLyUvDx+o8JJhBtCRT79PBK8wAAiQyjDrkEFPft8DP3mAQMDt4LAABM9Fbyl/tUCBMONwi2++Py7PQAAO0KwgweBDn43PJU+AEEPgxXCgAAzfUX9Cj8QgdEDCkHQ/yS9Fj2AACGCR4LlgM5+Yz0Ufl+A6sKAwkAABz3n/Wn/FQGsQo+Br78CvaW9wAATQixCSADGPoF9i36CwNMCdsHAABB+PT2Ff2EBVEJcAUp/VL3q/gAADwHcgi6Atr6Tffs+qcCGwjZBgAAP/ke+HX9zgQfCL4Ehv1v+Jz5AABOBlwHYAKD+2v4k/tQAhAH9wUAAB36IfnI/TAEFAciBNj9aPlu+gAAfgVqBhICF/xl+SX8BAIoBjMFAADf+gP6Ef6nAysGmgMf/kH6JfsAAMoElwXOAZj8Pvqj/MEBXQWIBAAAiPvI+lH+LgNgBSMDXf7++sX7AAAsBN8EkgEI/fv6Ev2IAa0E8wMAABv8dPuI/sYCrwS8ApL+o/tQ/AAAowM/BF8Baf2g+3L9VQETBHEDAACb/An8uf5rAhUEYgLB/jL8yfw=';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

let lastFeedbackAt = 0;
let audioPlayerPromise = null;
let nativeHaptics = null;
let didResolveNativeHaptics = false;

const hasNativeHapticModule = () => {
  if (NativeModules?.RNHapticFeedback) return true;

  try {
    return Boolean(TurboModuleRegistry?.get?.('RNHapticFeedback'));
  } catch (error) {
    return false;
  }
};

const getNativeHaptics = () => {
  if (Platform.OS === 'web') return null;
  if (didResolveNativeHaptics) return nativeHaptics;

  didResolveNativeHaptics = true;

  if (!hasNativeHapticModule()) return null;

  try {
    const hapticsModule = require('react-native-haptic-feedback');
    nativeHaptics = hapticsModule?.default ?? hapticsModule;
  } catch (error) {
    nativeHaptics = null;
  }

  return nativeHaptics;
};

const triggerHapticFeedback = () => {
  const haptics = getNativeHaptics();

  if (haptics?.trigger) {
    try {
      haptics.trigger('impactLight', HAPTIC_OPTIONS);
      return;
    } catch (error) {
      console.warn('[PressFeedback] Native haptic feedback is unavailable:', error);
    }
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

const getAudioPlayer = async () => {
  if (Platform.OS === 'web') return null;

  if (!audioPlayerPromise) {
    audioPlayerPromise = Promise.resolve()
      .then(async () => {
        // Resolve locally so tapping SOS never downloads a development bundle.
        const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
        await setAudioModeAsync({
          playsInSilentMode: false,
          interruptionMode: 'mixWithOthers',
          allowsRecording: false,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });

        return createAudioPlayer({ uri: TAP_SOUND_URI }, { updateInterval: 1000 });
      })
      .catch((error) => {
        console.warn('[PressFeedback] Sound feedback is unavailable:', error);
        return null;
      });
  }

  return audioPlayerPromise;
};

const playPressSound = async () => {
  const player = await getAudioPlayer();
  if (!player) return;

  try {
    await player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('[PressFeedback] Could not play tap sound:', error);
  }
};

export const triggerPressFeedback = () => {
  const now = Date.now();
  if (now - lastFeedbackAt < 70) return;
  lastFeedbackAt = now;

  triggerHapticFeedback();
  playPressSound();
};
