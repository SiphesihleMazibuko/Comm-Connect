import { router } from 'expo-router'; // ← Change this import
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import colors from '../Utils/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home'); 
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{ width: 80, height: 80, backgroundColor: colors.primary, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 40 }}>🤝</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>Welcome Back</Text>
          <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>Sign in to continue to Comm-Connect</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Email</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: colors.border }}
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Password</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: colors.border }}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 }}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Login</Text>}
        </TouchableOpacity>

        
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 14 }}>
            Don&apos;t have an account? 
          </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={{ fontWeight: 'bold', color: colors.accent }}>Sign Up</Text>
            </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}