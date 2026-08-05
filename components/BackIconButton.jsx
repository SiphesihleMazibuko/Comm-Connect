import {
  Ionicons } from '@expo/vector-icons';
import { useNavigation,
  useRouter } from 'expo-router';
import { Platform,
  StatusBar
} from 'react-native';
import TouchableOpacity from './FeedbackTouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../Utils/colors';

export default function BackIconButton({ fallbackHref = '/(tabs)/communityfeed' }) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const topOffset = Math.max(insets.top, statusBarHeight) + 8;

  const handleBack = () => {
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
    } catch (error) {
      console.warn('Navigation back failed:', error);
    }

    try {
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
    } catch (error) {
      console.warn('Router back failed:', error);
    }

    router.replace(fallbackHref);
  };

  return (
    <TouchableOpacity
      onPress={handleBack}
      activeOpacity={0.85}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      style={{
        position: 'absolute',
        top: topOffset,
        left: 12,
        zIndex: 999,
        elevation: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="arrow-back" size={22} color={colors.accent} />
    </TouchableOpacity>
  );
}
