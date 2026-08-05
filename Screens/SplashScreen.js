import {
  Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar,
  Text,
  View
} from 'react-native';
import TouchableOpacity from '../components/FeedbackTouchableOpacity';
import Onboarding from 'react-native-onboarding-swiper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../Utils/colors';

const globalGif = require('../assets/global-connection.gif');
const sosGif = require('../assets/sos.gif');
const pinGif = require('../assets/pin.gif');

const GifFrame = ({ source }) => (
  <View style={{
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Image
      source={source}
      contentFit="contain"
      style={{ width: 220, height: 220 }}
    />
  </View>
);

const ControlButton = ({ children, onPress, primary = false, bottomInset = 0 }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      minWidth: primary ? 96 : 72,
      minHeight: 44,
      borderRadius: 22,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primary ? colors.accent : 'rgba(255,255,255,0)',
      borderWidth: primary ? 0 : 1,
      borderColor: 'rgba(255,255,255,0.18)',
      marginHorizontal: 12,
      marginBottom: Math.max(8, Math.floor(bottomInset / 2)),
    }}
  >
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{children}</Text>
  </TouchableOpacity>
);

const Dot = ({ selected }) => (
  <View style={{
    width: selected ? 24 : 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: selected ? colors.accent : 'rgba(255,255,255,0.28)',
  }} />
);

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goToLogin = () => router.replace('/login');
  const bottomPadding = Math.max(insets.bottom, 24);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <Onboarding
        onDone={goToLogin}
        onSkip={goToLogin}
        bottomBarColor={colors.background}
        bottomBarHighlight={false}
        bottomBarHeight={76 + bottomPadding}
        containerStyles={{ paddingHorizontal: 22 }}
        titleStyles={{ color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center' }}
        subTitleStyles={{ color: colors.textLight, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 }}
        SkipButtonComponent={(props) => <ControlButton {...props} bottomInset={bottomPadding}>Skip</ControlButton>}
        NextButtonComponent={(props) => <ControlButton {...props} primary bottomInset={bottomPadding}>Next</ControlButton>}
        DoneButtonComponent={(props) => <ControlButton {...props} primary bottomInset={bottomPadding}>Start</ControlButton>}
        DotComponent={Dot}
        pages={[
          {
            backgroundColor: colors.background,
            image: <GifFrame source={globalGif} />,
            title: 'Stay connected',
            subtitle: 'See trusted community updates, local alerts, and reports from people around you.',
          },
          {
            backgroundColor: colors.surface,
            image: <GifFrame source={pinGif} />,
            title: 'Create a PinPoint address',
            subtitle: 'Use your phone location to create a simple digital address that helps others find you.',
          },
          {
            backgroundColor: colors.background,
            image: <GifFrame source={sosGif} />,
            title: 'Request help faster',
            subtitle: 'Share your saved location during emergencies so responders and contacts know where to go.',
          },
        ]}
      />
    </SafeAreaView>
  );
}
