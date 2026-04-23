import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';
import colors from '../Utils/colors';

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [location, setLocation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !phoneNumber || !idNumber || !location || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Account created successfully');
      const user = userCredential.user;
      router.replace('/app/home.jsx');  

      await updateProfile(user, { displayName: `${firstName} ${lastName}` });

      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
        phoneNumber,
        idNumber,
        location,
        role: 'resident', // Default role
        permissions: {
          locationEnabled: false,
          notificationsEnabled: false
        },
        createdAt: new Date().toISOString()
      });

      // Navigation happens automatically via App.js auth state
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>Create Account</Text>
          <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>Join Comm-Connect today</Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>First Name</Text>
          <TextInput style={inputStyle} placeholder="John" value={firstName} onChangeText={setFirstName} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Last Name</Text>
          <TextInput style={inputStyle} placeholder="Doe" value={lastName} onChangeText={setLastName} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Email</Text>
          <TextInput style={inputStyle} placeholder="john@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Phone Number</Text>
          <TextInput style={inputStyle} placeholder="+27 XX XXX XXXX" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>ID Number</Text>
          <TextInput style={inputStyle} placeholder="000000 0000 000" value={idNumber} onChangeText={setIdNumber} keyboardType="numeric" />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Location (e.g., Soweto, Zone 1)</Text>
          <TextInput style={inputStyle} placeholder="Your area" value={location} onChangeText={setLocation} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Password</Text>
          <TextInput style={inputStyle} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Confirm Password</Text>
          <TextInput style={inputStyle} placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        </View>

        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 }}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Sign Up</Text>}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 14 }}>
            Already have an account? 
          </Text>
        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={{ fontWeight: 'bold', color: colors.accent }}>Login</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border
};