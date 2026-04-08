import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useTheme } from '../src/contexts/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RangeItem {
  id: number;
  radius: string;
  color: string;
  visible: boolean;
}

interface SelectedPoint {
  lat: number;
  lng: number;
}

type SelectionMode = 'geolocation' | 'map-point';
type MapView = 'osm' | 'satellite';

const MAP_BASE_URL = 'https://firefighter-helper.local';
const MAP_REFERRER_POLICY = 'strict-origin-when-cross-origin';

export default function StrefaZagrozenia() {
  const { colors } = useTheme();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  // State
  const [mode, setMode] = useState<SelectionMode>('geolocation');
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [mapView, setMapView] = useState<MapView>('osm');
  const [ranges, setRanges] = useState<RangeItem[]>([
    { id: 1, radius: '', color: '#ff0000', visible: true },
    { id: 2, radius: '', color: '#ffd600', visible: false },
    { id: 3, radius: '', color: '#0066ff', visible: false },
  ]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [, setMapReady] = useState(false);

  // Leaflet HTML content
  const leafletHTML = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="referrer" content="${MAP_REFERRER_POLICY}">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .leaflet-control-attribution {
      font-size: 10px !important;
      background: rgba(255,255,255,0.8) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map centered on Poland
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([52.0, 19.0], 6);

    // Define tile layers
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      referrerPolicy: '${MAP_REFERRER_POLICY}'
    });

    const esriSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19
    });

    // Add default layer
    osmLayer.addTo(map);
    let currentLayer = 'osm';

    // Store references
    let hazardMarker = null;
    let hazardCircles = [];

    // Switch map layer
    function switchLayer(layerType) {
      if (layerType === 'satellite' && currentLayer !== 'satellite') {
        map.removeLayer(osmLayer);
        esriSatelliteLayer.addTo(map);
        currentLayer = 'satellite';
      } else if (layerType === 'osm' && currentLayer !== 'osm') {
        map.removeLayer(esriSatelliteLayer);
        osmLayer.addTo(map);
        currentLayer = 'osm';
      }
    }

    // Clear all hazard elements
    function clearHazard() {
      if (hazardMarker) {
        map.removeLayer(hazardMarker);
        hazardMarker = null;
      }
      hazardCircles.forEach(circle => map.removeLayer(circle));
      hazardCircles = [];
    }

    // Set center point
    function setCenter(lat, lng) {
      clearHazard();
      hazardMarker = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 15);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pointSelected',
        lat: lat,
        lng: lng
      }));
    }

    // Draw circles
    function drawCircles(lat, lng, radii) {
      // Clear existing circles
      hazardCircles.forEach(circle => map.removeLayer(circle));
      hazardCircles = [];

      // Sort radii descending (largest first, so it's drawn at bottom)
      const sortedRadii = [...radii].sort((a, b) => b.radius - a.radius);

      sortedRadii.forEach((item, index) => {
        const circle = L.circle([lat, lng], {
          radius: item.radius,
          color: item.color,
          fillColor: item.color,
          fillOpacity: 0.2,
          weight: 3
        }).addTo(map);
        hazardCircles.push(circle);
      });

      // Update marker to be on top
      if (hazardMarker) {
        hazardMarker.bringToFront();
      }

      // Fit map to largest circle
      if (sortedRadii.length > 0) {
        const largestRadius = sortedRadii[0].radius;
        const bounds = L.latLng(lat, lng).toBounds(largestRadius * 2.5);
        map.fitBounds(bounds);
      }
    }

    // Handle map click
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapClick',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }));
    });

    // Notify React Native that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>
  `, []);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'mapClick') {
        if (mode === 'map-point') {
          setSelectedPoint({ lat: data.lat, lng: data.lng });
          webViewRef.current?.injectJavaScript(`setCenter(${data.lat}, ${data.lng}); true;`);
          setErrors({});
        }
      } else if (data.type === 'pointSelected') {
        setSelectedPoint({ lat: data.lat, lng: data.lng });
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  }, [mode]);

  // Switch map layer
  const switchMapLayer = (layer: MapView) => {
    setMapView(layer);
    webViewRef.current?.injectJavaScript(`switchLayer('${layer}'); true;`);
  };

  // Add new range
  const addRange = () => {
    const nextRange = ranges.find(r => !r.visible);
    if (nextRange) {
      setRanges(ranges.map(r => 
        r.id === nextRange.id ? { ...r, visible: true } : r
      ));
    }
  };

  // Update range value
  const updateRange = (id: number, value: string) => {
    setRanges(ranges.map(r => 
      r.id === id ? { ...r, radius: value } : r
    ));
    // Clear error for this field
    setErrors(prev => ({ ...prev, [`range${id}`]: '' }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Check if first range is filled
    if (!ranges[0].radius || parseFloat(ranges[0].radius) < 1) {
      newErrors.range1 = 'Promień 1 jest wymagany (min. 1m)';
    }

    // Check other visible ranges
    ranges.filter(r => r.visible && r.radius).forEach(r => {
      const value = parseFloat(r.radius);
      if (isNaN(value) || value < 1) {
        newErrors[`range${r.id}`] = 'Wartość musi być liczbą dodatnią (min. 1m)';
      }
    });

    // Check center point
    if (mode === 'map-point' && !selectedPoint) {
      newErrors.center = 'Najpierw wskaż punkt na mapie';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Get current location
  const getCurrentLocation = async (): Promise<SelectedPoint | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors({ center: 'Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.' });
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch {
      setErrors({ center: 'Nie udało się pobrać lokalizacji. Spróbuj ponownie.' });
      return null;
    }
  };

  // Create hazard zone
  const createHazardZone = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    let centerPoint = selectedPoint;

    // If using geolocation, get current position
    if (mode === 'geolocation') {
      centerPoint = await getCurrentLocation();
      if (!centerPoint) {
        setIsLoading(false);
        return;
      }
      setSelectedPoint(centerPoint);
    }

    if (!centerPoint) {
      setErrors({ center: 'Brak punktu środka strefy' });
      setIsLoading(false);
      return;
    }

    // Get active radii
    const activeRadii = ranges
      .filter(r => r.visible && r.radius && parseFloat(r.radius) >= 1)
      .map(r => ({
        radius: parseFloat(r.radius),
        color: r.color,
      }));

    if (activeRadii.length === 0) {
      setErrors({ range1: 'Podaj przynajmniej jeden promień' });
      setIsLoading(false);
      return;
    }

    // Set center and draw circles
    webViewRef.current?.injectJavaScript(`
      setCenter(${centerPoint.lat}, ${centerPoint.lng});
      drawCircles(${centerPoint.lat}, ${centerPoint.lng}, ${JSON.stringify(activeRadii)});
      true;
    `);

    setIsLoading(false);
  };

  // Clear everything
  const clearAll = () => {
    webViewRef.current?.injectJavaScript('clearHazard(); true;');
    setSelectedPoint(null);
    setRanges([
      { id: 1, radius: '', color: '#ff0000', visible: true },
      { id: 2, radius: '', color: '#ffd600', visible: false },
      { id: 3, radius: '', color: '#0066ff', visible: false },
    ]);
    setErrors({});
  };

  const visibleRangesCount = ranges.filter(r => r.visible).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tworzenie strefy zagrożenia</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHTML, baseUrl: MAP_BASE_URL }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          mixedContentMode="always"
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
      </View>

      {/* Control Panel */}
      <ScrollView 
        style={[styles.controlPanel, { backgroundColor: colors.card }]}
        contentContainerStyle={[styles.controlPanelContent, { paddingBottom: 20 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selection */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Wybór środka strefy</Text>
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: colors.border },
              mode === 'geolocation' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => {
              setMode('geolocation');
            }}
          >
            <Ionicons 
              name="locate" 
              size={20} 
              color={mode === 'geolocation' ? '#FFFFFF' : colors.text} 
            />
            <Text style={[
              styles.modeButtonText,
              { color: mode === 'geolocation' ? '#FFFFFF' : colors.text },
            ]}>
              Moja lokalizacja
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: colors.border },
              mode === 'map-point' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => {
              setMode('map-point');
            }}
          >
            <Ionicons 
              name="location" 
              size={20} 
              color={mode === 'map-point' ? '#FFFFFF' : colors.text} 
            />
            <Text style={[
              styles.modeButtonText,
              { color: mode === 'map-point' ? '#FFFFFF' : colors.text },
            ]}>
              Wskaż na mapie
            </Text>
          </TouchableOpacity>
        </View>

        {errors.center && (
          <Text style={styles.errorText}>{errors.center}</Text>
        )}

        {/* Map View Toggle */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Widok mapy</Text>
        <View style={styles.mapViewButtons}>
          <TouchableOpacity
            style={[
              styles.mapViewButton,
              { borderColor: colors.border },
              mapView === 'osm' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => switchMapLayer('osm')}
          >
            <Text style={[
              styles.mapViewButtonText,
              { color: mapView === 'osm' ? '#FFFFFF' : colors.text },
            ]}>
              Domyślny
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapViewButton,
              { borderColor: colors.border },
              mapView === 'satellite' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => switchMapLayer('satellite')}
          >
            <Text style={[
              styles.mapViewButtonText,
              { color: mapView === 'satellite' ? '#FFFFFF' : colors.text },
            ]}>
              Satelitarny
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ranges */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Zakresy strefy</Text>
        
        {ranges.filter(r => r.visible).map((range) => (
          <View key={range.id} style={styles.rangeRow}>
            <View style={[styles.rangeColorDot, { backgroundColor: range.color }]} />
            <Text style={[styles.rangeLabel, { color: colors.text }]}>
              Promień {range.id}
            </Text>
            <TextInput
              style={[
                styles.rangeInput,
                { 
                  backgroundColor: colors.surface, 
                  color: colors.text,
                  borderColor: errors[`range${range.id}`] ? '#ff0000' : colors.border,
                },
              ]}
              placeholder="metry"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={range.radius}
              onChangeText={(value) => updateRange(range.id, value)}
            />
            <Text style={[styles.rangeUnit, { color: colors.textSecondary }]}>m</Text>
          </View>
        ))}

        {ranges.filter(r => r.visible).map((range) => (
          errors[`range${range.id}`] ? (
            <Text key={`error-${range.id}`} style={styles.errorText}>
              {errors[`range${range.id}`]}
            </Text>
          ) : null
        ))}

        {/* Add Range Button */}
        {visibleRangesCount < 3 && (
          <TouchableOpacity
            style={[styles.addRangeButton, { borderColor: colors.border }]}
            onPress={addRange}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={[styles.addRangeText, { color: colors.primary }]}>
              Dodaj kolejny zakres
            </Text>
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={createHazardZone}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="radio-button-on" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Wyznacz strefę</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={clearAll}
          >
            <Ionicons name="trash-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Wyczyść</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.4,
    minHeight: 250,
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  controlPanel: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  controlPanelContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapViewButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mapViewButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  mapViewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  rangeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 80,
  },
  rangeInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  rangeUnit: {
    fontSize: 14,
    width: 20,
  },
  addRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  addRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dataPreview: {
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  dataPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  dataPreviewText: {
    fontSize: 13,
    marginBottom: 4,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 26,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
