import { Image, Text, View } from 'react-native';
import colors from '../../Utils/colors';

export default function SignupHeader({ step }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 32 }}>
      <View style={{
        width: 80,
        height: 80,
        backgroundColor: colors.primary,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <Image source={require('../../assets/signup-removebg-preview.png')} style={{ width: 60, height: 60, top: 8 }} resizeMode="contain" />
      </View>

      <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>
        {step === 'details' ? 'Create Account' : 'Verify Phone'}
      </Text>
      <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>
        {step === 'details'
          ? 'Join Comm-Connect today'
          : 'Enter the code sent to your phone'}
      </Text>
    </View>
  );
}
