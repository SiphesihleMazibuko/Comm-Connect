import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar, View } from 'react-native';

export default function SplashScreen() {
  const router = useRouter();

  const goToLogin = () => {
    router.replace('/login');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <StatusBar barStyle="dark-content" />

      <Image
        source={require('../assets/images/COMM-CON.png')}
        contentFit="contain"
        style={{
          width: 250,
          height: 250,
        }}
        onLoadEnd={goToLogin}
      />
    </View>
  );
}