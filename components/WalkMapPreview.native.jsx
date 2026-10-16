import MapView, { Marker } from 'react-native-maps';

export default function WalkMapPreview({ mode = 'point', point, start, destination, current, onSelect }) {
  if (mode === 'point') {
    const coordinate = { latitude: Number(point.latitude), longitude: Number(point.longitude) };
    return <MapView style={{ height: 150, borderRadius: 12, marginTop: 7 }} initialRegion={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }} onPress={(event) => onSelect?.(event.nativeEvent.coordinate)}><Marker coordinate={coordinate}/></MapView>;
  }
  const center = current || start;
  return <MapView style={{ height: 190, marginTop: 10, borderRadius: 10 }} region={{ ...center, latitudeDelta: 0.04, longitudeDelta: 0.04 }}><Marker coordinate={start} title="Start" pinColor="green"/><Marker coordinate={destination} title="Destination"/>{current && <Marker coordinate={current} title="CPF member"/>}</MapView>;
}
