import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../config/firebase';
import colors from '../Utils/colors';

export default function SignupScreen() {
  const [selectedRole, setSelectedRole] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [location, setLocation] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [responderType, setResponderType] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    {
      id: 'resident',
      title: 'Resident',
      description: 'Report incidents and request assistance'
    },
    {
      id: 'community_leader',
      title: 'Community Leader',
      description: 'Manage community alerts and review reports'
    },
    {
      id: 'emergency_responder',
      title: 'Emergency Responder',
      description: 'Respond to emergency requests and incidents'
    }
  ];

  const handleSignup = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select an account type');
      return;
    }

    if (!firstName || !lastName || !email || !phoneNumber || !idNumber || !location || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (selectedRole === 'community_leader' && !organizationName) {
      Alert.alert('Error', 'Please enter your community or organisation name');
      return;
    }

    if (selectedRole === 'emergency_responder' && !responderType) {
      Alert.alert('Error', 'Please enter your responder type');
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
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
        phoneNumber,
        idNumber,
        location,
        role: selectedRole,

        organizationName: selectedRole === 'community_leader' ? organizationName : null,
        responderType: selectedRole === 'emergency_responder' ? responderType : null,


        permissions: {
          locationEnabled: false,
          notificationsEnabled: false,
          canReportIncident: true,
          canRequestEmergency: true,
          canReviewReports: selectedRole === 'community_leader',
          canRespondToEmergency: selectedRole === 'emergency_responder',
          canSendCommunityAlerts: selectedRole === 'community_leader'
        },

        createdAt: new Date().toISOString()
      });

      Alert.alert(
        'Success',
        selectedRole === 'resident'
          ? 'Account created successfully'
          : 'Account created successfully. Your profile is pending approval.'
      );

      router.replace('/app/home');

    } catch (error) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRoleSelection = () => {
    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
          Select Account Type
        </Text>

        {roles.map((role) => (
          <TouchableOpacity
            key={role.id}
            onPress={() => setSelectedRole(role.id)}
            style={{
              backgroundColor: selectedRole === role.id ? colors.accent : colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: selectedRole === role.id ? colors.accent : colors.border
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: selectedRole === role.id ? '#fff' : colors.text
              }}
            >
              {role.title}
            </Text>

            <Text
              style={{
                fontSize: 13,
                marginTop: 4,
                color: selectedRole === role.id ? '#fff' : colors.textLight
              }}
            >
              {role.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>Create Account</Text>
          <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8 }}>Join Comm-Connect today</Text>
        </View>

        {renderRoleSelection()}

        {selectedRole !== '' && (
          <>
            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>First Name</Text>
              <TextInput style={inputStyle} placeholder="John" value={firstName} onChangeText={setFirstName} />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Last Name</Text>
              <TextInput style={inputStyle} placeholder="Doe" value={lastName} onChangeText={setLastName} />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Email</Text>
              <TextInput
                style={inputStyle}
                placeholder="john@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Phone Number</Text>
              <TextInput
                style={inputStyle}
                placeholder="+27 XX XXX XXXX"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>ID Number</Text>
              <TextInput
                style={inputStyle}
                placeholder="000000 0000 000"
                value={idNumber}
                onChangeText={setIdNumber}
                keyboardType="numeric"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Location</Text>
              <TextInput
                style={inputStyle}
                placeholder="Your area, e.g. Soweto, Zone 1"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {selectedRole === 'community_leader' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={labelStyle}>Community / Organisation Name</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. Soweto Community Forum"
                  value={organizationName}
                  onChangeText={setOrganizationName}
                />
              </View>
            )}

            {selectedRole === 'emergency_responder' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={labelStyle}>Responder Type</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. Police, Ambulance, Fire, Security"
                  value={responderType}
                  onChangeText={setResponderType}
                />
              </View>
            )}

            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Password</Text>
              <TextInput
                style={inputStyle}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={labelStyle}>Confirm Password</Text>
              <TextInput
                style={inputStyle}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 }}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 14 }}>
            Already have an account?
          </Text>

          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={{ fontWeight: 'bold', color: colors.accent }}> Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle = {
  fontSize: 14,
  fontWeight: '500',
  color: colors.text,
  marginBottom: 8
};

const inputStyle = {
  backgroundColor: colors.surface,
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border
};      