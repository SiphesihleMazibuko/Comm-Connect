import { useState } from 'react';
import { Text, View } from 'react-native';
import TouchableOpacity from './FeedbackTouchableOpacity';

export default function WalkMapPreview({ mode = 'point', point, start, destination, current, colors, onSelect }) {
  const [selected, setSelected] = useState({ latitude: Number(point?.latitude), longitude: Number(point?.longitude) });
  const style = { color: colors?.textLight || '#666', fontSize: 12, marginTop: 8 };
  if (mode === 'point') {
    const latitude = Number.isFinite(selected.latitude) ? selected.latitude : -29;
    const longitude = Number.isFinite(selected.longitude) ? selected.longitude : 24;
    const nudge = (deltaLat, deltaLng) => setSelected((value) => {
      const next = { latitude: value.latitude + deltaLat, longitude: value.longitude + deltaLng };
      onSelect?.(next);
      return next;
    });
    return <View style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors?.border || '#ccc', backgroundColor: colors?.surface || '#fff' }}>
      <Text style={style}>Interactive map is unavailable on web. Use the arrows to place the pin, or enter coordinates above.</Text>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <TouchableOpacity accessibilityLabel="Move map pin north" onPress={() => nudge(0.001, 0)} style={buttonStyle}><Text style={buttonText}>↑</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
          <TouchableOpacity accessibilityLabel="Move map pin west" onPress={() => nudge(0, -0.001)} style={buttonStyle}><Text style={buttonText}>←</Text></TouchableOpacity>
          <Text style={{ color: colors?.accent || '#26734d', fontSize: 22 }}>📍</Text>
          <TouchableOpacity accessibilityLabel="Move map pin east" onPress={() => nudge(0, 0.001)} style={buttonStyle}><Text style={buttonText}>→</Text></TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityLabel="Move map pin south" onPress={() => nudge(-0.001, 0)} style={buttonStyle}><Text style={buttonText}>↓</Text></TouchableOpacity>
      </View>
      <Text style={[style, { textAlign: 'center', marginTop: 10 }]}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
    </View>;
  }
  return <Text style={style}>Map is unavailable on web. Start: {start.latitude.toFixed(5)}, {start.longitude.toFixed(5)} · Destination: {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}{current ? ` · Current: ${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}` : ''}</Text>;
}

const buttonStyle = { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#16834a' };
const buttonText = { color: '#fff', fontSize: 20, fontWeight: '800' };
