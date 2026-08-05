import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import TouchableOpacity from '../FeedbackTouchableOpacity';
import colors from '../../Utils/colors';

export default function SignupOtpStep({
  otp,
  otpRefs,
  loading,
  onOtpChange,
  onOtpKeyPress,
  onBack,
  onVerify,
}) {
  return (
    <>
      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
        Enter verification code
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpRefs.current[index] = ref)}
            style={{
              width: 46,
              height: 56,
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: digit ? 2 : 1,
              borderColor: digit ? colors.accent : colors.border,
              fontSize: 22,
              fontWeight: 'bold',
              textAlign: 'center',
              color: colors.text,
            }}
            value={digit}
            onChangeText={(val) => onOtpChange(val, index)}
            onKeyPress={(event) => onOtpKeyPress(event, index)}
            keyboardType="number-pad"
            selectionColor={colors.accent}
            maxLength={6}
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </View>

      <TouchableOpacity onPress={onBack} style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ color: colors.accent, fontSize: 13 }}>Back to details</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: colors.accent,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
          marginBottom: 16,
          opacity: loading ? 0.7 : 1,
        }}
        onPress={onVerify}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Verify & Create Account</Text>
        }
      </TouchableOpacity>
    </>
  );
}
