import { View, Text, TouchableOpacity } from 'react-native';
import BackIconButton from '../components/BackIconButton';
import colors from '../Utils/colors';

export default function ErrorBoundary({ error, reset }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 20 }}>
      <BackIconButton />
      <Text style={{ fontSize: 24, color: colors.error, marginBottom: 20 }}>⚠️ Something went wrong</Text>
      <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 20 }}>{error?.message}</Text>
      <TouchableOpacity onPress={reset} style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
