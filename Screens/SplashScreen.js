import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import Onboarding from 'react-native-onboarding-swiper';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import colors from '../Utils/colors';

const makePulseAnimation = (primaryColor, secondaryColor) => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 260,
  h: 260,
  nm: 'PinPoint onboarding animation',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Outer pulse',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [20] }, { t: 45, s: [45] }, { t: 90, s: [20] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [130, 130, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [80, 80, 100] }, { t: 45, s: [150, 150, 100] }, { t: 90, s: [80, 80, 100] }] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] } },
        { ty: 'fl', c: { a: 0, k: secondaryColor }, o: { a: 0, k: 100 } },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Core',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 90, s: [360] }] },
        p: { a: 0, k: [130, 130, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [95, 95, 100] }, { t: 45, s: [108, 108, 100] }, { t: 90, s: [95, 95, 100] }] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [82, 82] } },
        { ty: 'fl', c: { a: 0, k: primaryColor }, o: { a: 0, k: 100 } },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
});

const globalGif = require('../assets/global-connection.gif');
const sosGif = require('../assets/sos.gif');
const pinGif = require('../assets/pin.gif');

const AnimationFrame = ({ source }) => (
  <View style={{
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <LottieView
      source={source}
      autoPlay
      loop
      style={{ width: 240, height: 240 }}
    />
  </View>
);

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

const ControlButton = ({ children, onPress, primary = false }) => (
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
      backgroundColor: primary ? colors.accent : 'transparent',
      borderWidth: primary ? 0 : 1,
      borderColor: 'rgba(255,255,255,0.18)',
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
  const goToLogin = () => router.replace('/login');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <Onboarding
        onDone={goToLogin}
        onSkip={goToLogin}
        bottomBarColor={colors.background}
        bottomBarHighlight={false}
        containerStyles={{ paddingHorizontal: 22 }}
        titleStyles={{ color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center' }}
        subTitleStyles={{ color: colors.textLight, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 }}
        SkipButtonComponent={(props) => <ControlButton {...props}>Skip</ControlButton>}
        NextButtonComponent={(props) => <ControlButton {...props} primary>Next</ControlButton>}
        DoneButtonComponent={(props) => <ControlButton {...props} primary>Start</ControlButton>}
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
    </View>
  );
}
