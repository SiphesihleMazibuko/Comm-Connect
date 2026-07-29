import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import colors from '../../Utils/colors';
import SignupLocationSelector from './SignupLocationSelector';
import { inputStyle, labelStyle } from './styles';

export default function SignupDetailsStep({
  roles,
  selectedRole,
  setSelectedRole,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phoneNumber,
  setPhoneNumber,
  selectedCountry,
  showCountryPicker,
  loadingCountryCodes,
  countrySearch,
  setCountrySearch,
  filteredCountryCodes,
  toggleCountryPicker,
  handleCountrySelect,
  idNumber,
  setIdNumber,
  location,
  setLocation,
  organizationName,
  setOrganizationName,
  responderType,
  setResponderType,
  loading,
  onSendOtp,
  locationSelectorProps,
}) {
  return (
    <>
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
              borderColor: selectedRole === role.id ? colors.accent : colors.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: selectedRole === role.id ? '#fff' : colors.text }}>
              {role.title}
            </Text>
            <Text style={{ fontSize: 13, marginTop: 4, color: selectedRole === role.id ? '#fff' : colors.textLight }}>
              {role.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRole !== '' && (
        <>
          <View style={{ marginBottom: 12 }}>
            <Text style={labelStyle}>First Name</Text>
            <TextInput style={inputStyle} placeholder="John" placeholderTextColor={colors.textLight} selectionColor={colors.accent} value={firstName} onChangeText={setFirstName} />
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={labelStyle}>Last Name</Text>
            <TextInput style={inputStyle} placeholder="Doe" placeholderTextColor={colors.textLight} selectionColor={colors.accent} value={lastName} onChangeText={setLastName} />
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={labelStyle}>Email</Text>
            <TextInput
              style={inputStyle}
              placeholder="john@example.com"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={labelStyle}>Phone Number</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={toggleCountryPicker}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{selectedCountry.code}</Text>
                {loadingCountryCodes ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textLight }}>v</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder="81 234 5678"
                placeholderTextColor={colors.textLight}
                selectionColor={colors.accent}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
          </View>

          {showCountryPicker && (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 12,
              overflow: 'hidden',
            }}>
              <TextInput
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: 10,
                  padding: 12,
                  margin: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                placeholder="Search country or code"
                placeholderTextColor={colors.textLight}
                selectionColor={colors.accent}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />

              {filteredCountryCodes.length === 0 ? (
                <Text style={{ color: colors.textLight, padding: 14, textAlign: 'center' }}>
                  No countries found
                </Text>
              ) : filteredCountryCodes.map((country) => (
                <TouchableOpacity
                  key={`${country.name}-${country.code}`}
                  onPress={() => handleCountrySelect(country)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: selectedCountry.code === country.code && selectedCountry.name === country.name ? colors.background : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                  <Text style={{ fontSize: 15, color: colors.text }}>{country.countryName || country.name}</Text>
                  <Text style={{ fontSize: 15, color: colors.textLight, marginLeft: 'auto' }}>{country.code}</Text>
                  {selectedCountry.code === country.code && selectedCountry.name === country.name && (
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: 'bold' }}>Selected</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 16 }}>
            Don&apos;t include the country code or leading zero
          </Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={labelStyle}>ID Number</Text>
            <TextInput
              style={inputStyle}
              placeholder="000000 0000 000"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              value={idNumber}
              onChangeText={setIdNumber}
              keyboardType="numeric"
            />
          </View>

          <SignupLocationSelector {...locationSelectorProps} />

          <View style={{ marginBottom: 12 }}>
            <Text style={labelStyle}>Address Details</Text>
            <TextInput
              style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
              placeholder="e.g., 12 Melle Street, Braamfontein"
              placeholderTextColor={colors.textLight}
              selectionColor={colors.accent}
              value={location}
              onChangeText={setLocation}
              multiline
            />
            <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 4 }}>
              Help emergency responders find you
            </Text>
          </View>

          {selectedRole === 'community_leader' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={labelStyle}>Community / Organisation Name</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. Soweto Community Forum"
                placeholderTextColor={colors.textLight}
                selectionColor={colors.accent}
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
                placeholderTextColor={colors.textLight}
                selectionColor={colors.accent}
                value={responderType}
                onChangeText={setResponderType}
              />
            </View>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 12,
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={onSendOtp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Send OTP</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </>
  );
}
