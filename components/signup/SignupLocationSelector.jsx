import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from 'react-native';

import { useTheme } from '../../app/context/ThemeContext';
import { inputStyle, labelStyle, subLabelStyle } from './styles';

const OptionPill = ({ label, selected, onPress, colors }) => (
  <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, borderRadius: 20, backgroundColor: selected ? colors.accent : colors.surface, borderWidth: 1, borderColor: selected ? colors.accent : colors.border }}>
    <Text style={{ color: selected ? colors.textInverse : colors.text, fontWeight: selected ? 'bold' : 'normal' }}>{label}</Text>
  </TouchableOpacity>
);

const HorizontalOptions = ({ items, selectedId, getLabel, onSelect, colors }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
    {items.map((item) => (
      <OptionPill key={item.id} label={getLabel(item)} selected={selectedId === item.id} onPress={() => onSelect(item)} colors={colors} />
    ))}
  </ScrollView>
);

export default function SignupLocationSelector({
  detectingLocation,
  pinpointLocation,
  locationLookupStatus,
  loadingLocations,
  provinces,
  cities,
  suburbs,
  zones,
  wards,
  selectedProvince,
  selectedCity,
  selectedSuburb,
  selectedZone,
  selectedWard,
  locationErrors,
  manualWardNumber,
  onUseCurrentLocation,
  onProvinceSelect,
  onCitySelect,
  onSuburbSelect,
  onZoneSelect,
  onWardSelect,
  onManualWardNumberChange,
}) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={labelStyle}>Your Location</Text>

      <TouchableOpacity onPress={onUseCurrentLocation} disabled={detectingLocation} style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12, opacity: detectingLocation ? 0.7 : 1 }}>
        {detectingLocation ? <ActivityIndicator color={colors.textInverse} /> : <Text style={{ color: colors.textInverse, fontWeight: 'bold' }}>Use My Current Location</Text>}
      </TouchableOpacity>

      {pinpointLocation && (
        <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 4 }}>PinPoint Address</Text>
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{pinpointLocation.digitalAddress}</Text>
        </View>
      )}

      {locationLookupStatus ? <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 12 }}>{locationLookupStatus}</Text> : null}

      <Text style={{ color: colors.textLight, fontSize: 11, marginBottom: 12 }}>Area details from OpenStreetMap. Ward number is selected or entered by you.</Text>

      <View style={{ marginBottom: 12 }}>
        <Text style={subLabelStyle}>Province (Optional)</Text>
        {loadingLocations && provinces.length === 0 ? <ActivityIndicator color={colors.accent} /> : <HorizontalOptions items={provinces} selectedId={selectedProvince?.id} getLabel={(province) => province.name} onSelect={onProvinceSelect} colors={colors} />}
        {locationErrors.province && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.province}</Text>}
      </View>

      {selectedProvince && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>City / Town (Optional)</Text>
          {loadingLocations ? <ActivityIndicator color={colors.accent} /> : cities.length === 0 ? <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No cities available</Text> : <HorizontalOptions items={cities} selectedId={selectedCity?.id} getLabel={(city) => city.name} onSelect={onCitySelect} colors={colors} />}
          {locationErrors.city && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.city}</Text>}
        </View>
      )}

      {selectedCity && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Suburb (Optional)</Text>
          {loadingLocations ? <ActivityIndicator color={colors.accent} /> : suburbs.length === 0 ? <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No suburbs available</Text> : <HorizontalOptions items={suburbs} selectedId={selectedSuburb?.id} getLabel={(suburb) => suburb.name} onSelect={onSuburbSelect} colors={colors} />}
          {locationErrors.suburb && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.suburb}</Text>}
        </View>
      )}

      {selectedSuburb && zones.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Zone (Optional)</Text>
          <HorizontalOptions items={zones} selectedId={selectedZone?.id} getLabel={(zone) => zone.name} onSelect={onZoneSelect} colors={colors} />
        </View>
      )}

      {selectedSuburb && (
        <View style={{ marginBottom: 12 }}>
          <Text style={subLabelStyle}>Ward Number (Optional)</Text>
          {loadingLocations ? <ActivityIndicator color={colors.accent} /> : wards.length === 0 ? <Text style={{ color: colors.textLight, fontSize: 14, paddingVertical: 8 }}>No wards available</Text> : <HorizontalOptions items={wards} selectedId={selectedWard?.id} getLabel={(ward) => `Ward ${ward.ward_number}`} onSelect={onWardSelect} colors={colors} />}
          {locationErrors.ward && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{locationErrors.ward}</Text>}
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <Text style={subLabelStyle}>Enter Ward Number (Optional)</Text>
        <TextInput style={inputStyle} placeholder="e.g. 12" placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.accent} value={manualWardNumber} onChangeText={onManualWardNumberChange} keyboardType="numeric" />
      </View>

      {loadingLocations && (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4 }}>Loading locations...</Text>
        </View>
      )}
    </View>
  );
}