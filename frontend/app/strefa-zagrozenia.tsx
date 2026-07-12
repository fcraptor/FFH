import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useTheme } from '../src/contexts/ThemeContext';
import {
  BBox,
  Hydrant,
  HydrantWithDistance,
  MIN_ZOOM_FOR_HYDRANTS,
  OverpassError,
  ReferencePoint,
  fetchHydrantsForBounds,
  formatDistance,
  getHydrantDescription,
  getHydrantLabel,
  getNearestHydrants,
  resolveCountyFromLocation,
  ensurePowiatDataExists,
  loadHydrantsFromPowiatGeoJSON,
  findPowiatEntry,
  PowiatEntry,
} from '../src/utils/hydrants';
import { HydrantManagementPanel, HydrantSelectionMode } from '../src/components/HydrantManagementPanel';
import { CountySelectionModal } from '../src/components/CountySelectionModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const WIND_CACHE_DURATION_MS = 10 * 60 * 1000;
const HYDRANTS_DEBOUNCE_MS = 900;
const HYDRANTS_MAX_RESULTS = 500;
const HYDRANTS_CACHE_KEY = 'ffh_hydrants_cache';

interface CachedHydrant extends Hydrant {
  cachedAt: number;
}

interface HydrantsCache {
  hydrants: CachedHydrant[];
  lastUpdated: number;
}

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

interface WindState {
  directionDegrees: number | null;
  directionLabel: string;
  error: string;
  loading: boolean;
  speedKmh: number | null;
}

type SelectionMode = 'geolocation' | 'map-point';
type MapView = 'osm' | 'satellite';
type ActiveMapMode = 'hazardZone' | 'hydrants';

const MAP_BASE_URL = 'https://firefighter-helper.local';
const MAP_REFERRER_POLICY = 'strict-origin-when-cross-origin';

const getWindDirectionCardinal = (degrees: number): string => {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized < 67.5) return 'NE';
  if (normalized < 112.5) return 'E';
  if (normalized < 157.5) return 'SE';
  if (normalized < 202.5) return 'S';
  if (normalized < 247.5) return 'SW';
  if (normalized < 292.5) return 'W';
  return 'NW';
};

const buildWindCacheKey = (lat: number, lng: number): string => `${lat.toFixed(3)}:${lng.toFixed(3)}`;

export default function StrefaZagrozenia() {
  const { colors } = useTheme();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  // ========================== HAZARD ZONE STATE ==========================
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapReadyRef = useRef(false);
  const pendingWebViewScriptsRef = useRef<string[]>([]);
  
  const [windState, setWindState] = useState<WindState>({
    directionDegrees: null,
    directionLabel: '—',
    error: '',
    loading: false,
    speedKmh: null,
  });
  const windCacheRef = useRef<Map<string, { timestamp: number; value: Omit<WindState, 'loading' | 'error'> }>>(new Map());
  const windDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ========================== HYDRANT MODE STATE ==========================
  const [activeMapMode, setActiveMapMode] = useState<ActiveMapMode>('hydrants');
  const [hydrantSelectionMode, setHydrantSelectionMode] = useState<HydrantSelectionMode>('geolocation');
  const [referencePoint, setReferencePoint] = useState<ReferencePoint | null>(null);
  const [hydrants, setHydrants] = useState<Hydrant[]>([]);
  const [selectedHydrantId, setSelectedHydrantId] = useState<string | null>(null);
  const [hydrantsLoading, setHydrantsLoading] = useState(false);
  const [hydrantsError, setHydrantsError] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [countyModalVisible, setCountyModalVisible] = useState<boolean>(false);
  const [currentPowiat, setCurrentPowiat] = useState<PowiatEntry | null>(null);
  
  const currentBoundsRef = useRef<BBox | null>(null);
  const currentZoomRef = useRef<number>(6);
  const hydrantsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrantsRequestIdRef = useRef(0);
  const hydrantAutoStartRef = useRef(false);

  const activeMapModeRef = useRef<ActiveMapMode>('hydrants');
  const hydrantSelectionModeRef = useRef<HydrantSelectionMode>('geolocation');
  const referencePointRef = useRef<ReferencePoint | null>(null);

  useEffect(() => { activeMapModeRef.current = activeMapMode; }, [activeMapMode]);
  useEffect(() => { hydrantSelectionModeRef.current = hydrantSelectionMode; }, [hydrantSelectionMode]);
  useEffect(() => { referencePointRef.current = referencePoint; }, [referencePoint]);

  const flushPendingWebViewScripts = useCallback(() => {
    if (!webViewRef.current || pendingWebViewScriptsRef.current.length === 0) return;
    const scripts = pendingWebViewScriptsRef.current.splice(0);
    webViewRef.current.injectJavaScript(`${scripts.join('\n')} true;`);
  }, []);

  const injectWebViewScript = useCallback((script: string) => {
    if (mapReadyRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(`${script} true;`);
      return;
    }
    pendingWebViewScriptsRef.current.push(script);
  }, []);

  const markMapReady = useCallback((ready: boolean) => {
    mapReadyRef.current = ready;
    setMapReady(ready);
    if (ready) {
      flushPendingWebViewScripts();
    }
  }, [flushPendingWebViewScripts]);

  // ========================== MEMOIZED DATA ==========================
  const hydrantsById = useMemo(() => {
    const map: Record<string, { hydrant: Hydrant; label: string }> = {};
    hydrants.forEach((h, idx) => {
      map[h.id] = { hydrant: h, label: getHydrantLabel(h, idx) };
    });
    return map;
  }, [hydrants]);

  const nearestHydrants: HydrantWithDistance[] = useMemo(() => {
    if (!referencePoint) return [];
    return getNearestHydrants(hydrants, referencePoint, 5);
  }, [hydrants, referencePoint]);

  // ========================== POWIAT LOGIC ==========================
  const loadHydrantsByCounty = async (powiat: PowiatEntry) => {
    setHydrantsLoading(true);
    setStatusMessage(`Pobieranie: ${powiat.displayName}...`);
    try {
      const localPath = await ensurePowiatDataExists(powiat.fileNameGeoJSON);
      if (localPath) {
        const loadedHydrants = await loadHydrantsFromPowiatGeoJSON(localPath);
        setHydrants(loadedHydrants);
        setCurrentPowiat(powiat);

        const payload = loadedHydrants.map(h => ({ id: h.id, lat: h.lat, lng: h.lng }));
        injectWebViewScript(`renderHydrants(${JSON.stringify(payload)});`);
        setHydrantsError('');
      } else {
        await fetchHydrantsForCurrentBounds({ force: true });
        setHydrantsError('Nie udało się pobrać paczki GeoJSON, więc pokazano dane z OSM dla bieżącego obszaru.');
      }
    } catch (err) {
      console.error(err);
      setHydrantsError('Nie udało się załadować danych powiatu.');
    } finally {
      setStatusMessage('');
      setHydrantsLoading(false);
    }
  };

  const startAutomatedCountySequence = async () => {
    setHydrantsLoading(true);
    setStatusMessage('Ustalanie lokalizacji...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await fetchHydrantsForCurrentBounds({ force: true });
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;

      setReferencePoint({ lat: latitude, lng: longitude, source: 'gps' });
      injectWebViewScript(`setHydrantReference(${latitude}, ${longitude});`);

      setStatusMessage('Rozpoznawanie powiatu...');
      const countyName = await resolveCountyFromLocation(latitude, longitude);
      
      if (!countyName) {
        await fetchHydrantsForCurrentBounds({ force: true });
        return;
      }

      const entry = findPowiatEntry(countyName);
      if (entry) {
        await loadHydrantsByCounty(entry);
      } else {
        await fetchHydrantsForCurrentBounds({ force: true });
      }
    } catch (err: any) {
      setHydrantsLoading(false);
      setStatusMessage('');
      if (err.message === 'MISSING_PERMISSIONS') {
        Alert.alert('Błąd', 'Brak uprawnień do lokalizacji. Wybierz powiat ręcznie.');
      }
      await fetchHydrantsForCurrentBounds({ force: true });
      setCountyModalVisible(true);
    }
  };

  const handleManualCountySelect = async (powiat: PowiatEntry) => {
    setCountyModalVisible(false);
    await loadHydrantsByCounty(powiat);
  };

  // ========================== HYDRANT DATA LOGIC ==========================
  const saveHydrantsToCache = useCallback(async (newHydrants: Hydrant[]) => {
    try {
      const existingRaw = await AsyncStorage.getItem(HYDRANTS_CACHE_KEY);
      let existingMap: Map<string, CachedHydrant> = new Map();
      
      if (existingRaw) {
        const existing: HydrantsCache = JSON.parse(existingRaw);
        existing.hydrants.forEach(h => existingMap.set(h.id, h));
      }
      
      const now = Date.now();
      newHydrants.forEach(h => {
        existingMap.set(h.id, { ...h, cachedAt: now });
      });
      
      const merged = Array.from(existingMap.values());
      const cacheData: HydrantsCache = {
        hydrants: merged,
        lastUpdated: now,
      };
      
      await AsyncStorage.setItem(HYDRANTS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.error('[Hydranty] Błąd zapisu cache:', e);
    }
  }, []);

  const fetchHydrantsForCurrentBounds = useCallback(async (options?: { force?: boolean }) => {
    const bbox = currentBoundsRef.current;
    const zoom = currentZoomRef.current;
    if (!bbox) return;

    if (!options?.force && zoom < MIN_ZOOM_FOR_HYDRANTS) {
      setHydrantsLoading(false);
      setHydrantsError(`Przybliż mapę, aby pobrać nowe hydranty (zoom ${zoom} < ${MIN_ZOOM_FOR_HYDRANTS}).`);
      return;
    }

    const requestId = ++hydrantsRequestIdRef.current;
    setHydrantsLoading(true);
    setHydrantsError('');

    try {
      const fetched = await fetchHydrantsForBounds(bbox);
      if (requestId !== hydrantsRequestIdRef.current) return;

      const limited = fetched.slice(0, HYDRANTS_MAX_RESULTS);
      setHydrants(prev => {
        const existingMap = new Map(prev.map(h => [h.id, h]));
        limited.forEach(h => existingMap.set(h.id, h));
        const merged = Array.from(existingMap.values());
        saveHydrantsToCache(limited);
        return merged;
      });

      setHydrants(current => {
        const payload = current.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng }));
        injectWebViewScript(`renderHydrants(${JSON.stringify(payload)});`);
        return current;
      });
    } catch (error) {
      if (requestId === hydrantsRequestIdRef.current) {
        const overpassError = error instanceof OverpassError ? error : null;
        let message = 'Nie udało się pobrać hydrantów z OpenStreetMap.';
        if (overpassError) {
          if (overpassError.code === 'timeout') message = 'Serwer OpenStreetMap jest przeciążony.';
          else if (overpassError.code === 'network') message = 'Brak połączenia z internetem.';
          else if (overpassError.code === 'parse') message = 'Nieoczekiwana odpowiedź serwera OSM.';
        }
        setHydrantsError(message);
      }
    } finally {
      if (requestId === hydrantsRequestIdRef.current) {
        setHydrantsLoading(false);
      }
    }
  }, [saveHydrantsToCache]);

  const scheduleFetchHydrants = useCallback(() => {
    if (activeMapModeRef.current !== 'hydrants') return;
    if (hydrantsDebounceRef.current) clearTimeout(hydrantsDebounceRef.current);
    hydrantsDebounceRef.current = setTimeout(() => {
      fetchHydrantsForCurrentBounds();
    }, HYDRANTS_DEBOUNCE_MS);
  }, [fetchHydrantsForCurrentBounds]);

  const setReferencePointFromGeolocation = useCallback(async () => {
    setHydrantsError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHydrantsError('Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next: ReferencePoint = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        source: 'gps',
      };

      setReferencePoint(next);
      setSelectedHydrantId(null);

      injectWebViewScript(
        `setHydrantReference(${next.lat}, ${next.lng});
         clearHydrantSelection();
         try { map.flyTo([${next.lat}, ${next.lng}], 16, { duration: 0.7 }); }
         catch (e) { map.setView([${next.lat}, ${next.lng}], 16); }`
      );
    } catch {
      setHydrantsError('Nie udało się pobrać lokalizacji. Spróbuj ponownie.');
    }
  }, []);

  const selectHydrant = useCallback((hydrant: Hydrant, centerOnHydrant: boolean) => {
    setSelectedHydrantId(hydrant.id);
    const currentRefPoint = referencePointRef.current;

    let popupHtml = `<b>${getHydrantLabel(hydrant, hydrants.findIndex((h) => h.id === hydrant.id))}</b>`;
    const description = getHydrantDescription(hydrant);
    if (description) popupHtml += `<br/>${description}`;
    popupHtml += `<br/>${hydrant.lat.toFixed(5)}, ${hydrant.lng.toFixed(5)}`;

    if (currentRefPoint) {
      const distance = formatDistance(getNearestHydrants([hydrant], currentRefPoint, 1)[0]?.distanceMeters ?? 0);
      popupHtml += `<br/><b>Odległość: ${distance}</b>`;
    } else {
      popupHtml += `<br/><i>Brak punktu odniesienia</i>`;
    }

    const refLat = currentRefPoint ? currentRefPoint.lat : 'null';
    const refLng = currentRefPoint ? currentRefPoint.lng : 'null';
    const escapedPopup = popupHtml.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    injectWebViewScript(
      `focusHydrant('${hydrant.id}', ${refLat}, ${refLng}, '${escapedPopup}', ${centerOnHydrant ? 'true' : 'false'});`
    );
  }, [hydrants]);

  const clearHydrantSelection = useCallback(() => {
    setSelectedHydrantId(null);
    injectWebViewScript('clearHydrantSelection();');
  }, []);

  const clearHydrantMode = useCallback(() => {
    if (hydrantsDebounceRef.current) clearTimeout(hydrantsDebounceRef.current);
    setReferencePoint(null);
    setSelectedHydrantId(null);
    setHydrantsError('');
    setHydrantsLoading(false);
    injectWebViewScript('setHydrantModeActive(false);');
  }, []);

  // ========================== WEBVIEW MESSAGE HANDLER ==========================
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        markMapReady(true);
        if (activeMapModeRef.current === 'hydrants') {
          injectWebViewScript('setHydrantModeActive(true);');
          setReferencePointFromGeolocation();
          if (!hydrantAutoStartRef.current) {
            hydrantAutoStartRef.current = true;
            startAutomatedCountySequence();
          }
        }
        return;
      }

      if (data.type === 'mapClick') {
        if (activeMapModeRef.current === 'hazardZone') {
          if (mode === 'map-point') {
            setSelectedPoint({ lat: data.lat, lng: data.lng });
            injectWebViewScript(`setCenter(${data.lat}, ${data.lng});`);
            setErrors({});
          }
          return;
        }

        if (activeMapModeRef.current === 'hydrants' && hydrantSelectionModeRef.current === 'map-point') {
          const next: ReferencePoint = { lat: data.lat, lng: data.lng, source: 'map' };
          setReferencePoint(next);
          setSelectedHydrantId(null);
          injectWebViewScript(`setHydrantReference(${data.lat}, ${data.lng}); clearHydrantSelection();`);
        }
        return;
      }

      if (data.type === 'pointSelected') {
        setSelectedPoint({ lat: data.lat, lng: data.lng });
        return;
      }

      if (data.type === 'boundsChanged') {
        currentBoundsRef.current = { south: data.south, west: data.west, north: data.north, east: data.east };
        if (typeof data.zoom === 'number') currentZoomRef.current = data.zoom;
        scheduleFetchHydrants();
        return;
      }

      if (data.type === 'hydrantClick') {
        const entry = hydrantsById[data.id];
        if (entry) selectHydrant(entry.hydrant, false);
        return;
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  }, [mode, hydrantsById, selectHydrant, scheduleFetchHydrants, setReferencePointFromGeolocation]);

  // ========================== WIND AND HAZARD LOGIC ==========================
  const fetchWindData = useCallback(async (lat: number, lng: number) => {
    const cacheKey = buildWindCacheKey(lat, lng);
    const cached = windCacheRef.current.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < WIND_CACHE_DURATION_MS) {
      setWindState({ ...cached.value, error: '', loading: false });
      return;
    }

    setWindState((prev) => ({ ...prev, error: '', loading: true }));

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      if (!response.ok) throw new Error('WIND_REQUEST_FAILED');

      const payload = await response.json();
      const currentWeather = payload?.current_weather;

      if (!currentWeather || typeof currentWeather.windspeed !== 'number' || typeof currentWeather.winddirection !== 'number') {
        throw new Error('WIND_DATA_UNAVAILABLE');
      }

      const nextValue = {
        directionDegrees: currentWeather.winddirection,
        directionLabel: getWindDirectionCardinal(currentWeather.winddirection),
        speedKmh: Math.round(currentWeather.windspeed),
      };
      
      windCacheRef.current.set(cacheKey, { timestamp: Date.now(), value: nextValue });
      setWindState({ ...nextValue, error: '', loading: false });
    } catch {
      setWindState({ directionDegrees: null, directionLabel: '—', error: 'Brak danych o wietrze', loading: false, speedKmh: null });
    }
  }, []);

  const scheduleWindFetch = useCallback((lat: number, lng: number) => {
    if (windDebounceRef.current) clearTimeout(windDebounceRef.current);
    windDebounceRef.current = setTimeout(() => {
      fetchWindData(lat, lng);
    }, 500);
  }, [fetchWindData]);

  const updateWindFromCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWindState(prev => ({ ...prev, error: 'Brak dostępu do lokalizacji', loading: false }));
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      scheduleWindFetch(location.coords.latitude, location.coords.longitude);
    } catch {
      setWindState(prev => ({ ...prev, error: 'Brak internetu lub danych', loading: false }));
    }
  }, [scheduleWindFetch]);

  const enterHydrantMode = useCallback(() => {
    activeMapModeRef.current = 'hydrants';
    setActiveMapMode('hydrants');
    setSelectedPoint(null);
    injectWebViewScript('setHydrantModeActive(true);');
    
    setHydrants((current) => {
      if (current.length > 0) {
        const payload = current.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng }));
        injectWebViewScript(`renderHydrants(${JSON.stringify(payload)});`);
      }
      return current;
    });
    
    startAutomatedCountySequence();
  }, [injectWebViewScript]);

  const exitHydrantMode = useCallback(async () => {
    activeMapModeRef.current = 'hazardZone';
    clearHydrantMode();
    setActiveMapMode('hazardZone');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors({ center: 'Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.' });
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point: SelectedPoint = { lat: location.coords.latitude, lng: location.coords.longitude };
      
      setSelectedPoint(point);
      setMode('geolocation');
      setErrors({});
      injectWebViewScript(
        `setCenter(${point.lat}, ${point.lng});
         try { map.flyTo([${point.lat}, ${point.lng}], 15, { duration: 0.7 }); }
         catch (e) { map.setView([${point.lat}, ${point.lng}], 15); }`
      );
      scheduleWindFetch(point.lat, point.lng);
    } catch {
      setErrors({ center: 'Nie udało się pobrać lokalizacji. Spróbuj ponownie.' });
    }
  }, [clearHydrantMode, scheduleWindFetch]);

  const toggleMapMode = useCallback(() => {
    if (activeMapMode === 'hazardZone') enterHydrantMode();
    else exitHydrantMode();
  }, [activeMapMode, enterHydrantMode, exitHydrantMode]);

  const handleHydrantListPress = useCallback((hydrant: HydrantWithDistance) => {
    selectHydrant(hydrant, false);
  }, [selectHydrant]);

  const switchMapLayer = (layer: MapView) => {
    setMapView(layer);
    webViewRef.current?.injectJavaScript(`switchLayer('${layer}'); true;`);
  };

  const addRange = () => {
    const nextRange = ranges.find(r => !r.visible);
    if (nextRange) setRanges(ranges.map(r => r.id === nextRange.id ? { ...r, visible: true } : r));
  };

  const updateRange = (id: number, value: string) => {
    setRanges(ranges.map(r => r.id === id ? { ...r, radius: value } : r));
    setErrors(prev => ({ ...prev, [`range${id}`]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!ranges[0].radius || parseFloat(ranges[0].radius) < 1) newErrors.range1 = 'Promień 1 jest wymagany (min. 1m)';

    ranges.filter(r => r.visible && r.radius).forEach(r => {
      const value = parseFloat(r.radius);
      if (isNaN(value) || value < 1) newErrors[`range${r.id}`] = 'Wartość musi być liczbą dodatnią (min. 1m)';
    });

    if (mode === 'map-point' && !selectedPoint) newErrors.center = 'Najpierw wskaż punkt na mapie';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getCurrentLocation = async (): Promise<SelectedPoint | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors({ center: 'Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.' });
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { lat: location.coords.latitude, lng: location.coords.longitude };
    } catch {
      setErrors({ center: 'Nie udało się pobrać lokalizacji. Spróbuj ponownie.' });
      return null;
    }
  };

  const createHazardZone = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    let centerPoint = selectedPoint;

    if (mode === 'geolocation') {
      centerPoint = await getCurrentLocation();
      if (!centerPoint) {
        setIsLoading(false);
        return;
      }
      setSelectedPoint(centerPoint);
      scheduleWindFetch(centerPoint.lat, centerPoint.lng);
    }

    if (!centerPoint) {
      setErrors({ center: 'Brak punktu środka strefy' });
      setIsLoading(false);
      return;
    }

    const activeRadii = ranges.filter(r => r.visible && r.radius && parseFloat(r.radius) >= 1)
      .map(r => ({ radius: parseFloat(r.radius), color: r.color }));

    if (activeRadii.length === 0) {
      setErrors({ range1: 'Podaj przynajmniej jeden promień' });
      setIsLoading(false);
      return;
    }

    webViewRef.current?.injectJavaScript(`
      setCenter(${centerPoint.lat}, ${centerPoint.lng});
      drawCircles(${centerPoint.lat}, ${centerPoint.lng}, ${JSON.stringify(activeRadii)});
      true;
    `);
    setIsLoading(false);
  };

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

  // ========================== EFFECTS ==========================
  useEffect(() => {
    const loadCachedHydrants = async () => {
      try {
        const cached = await AsyncStorage.getItem(HYDRANTS_CACHE_KEY);
        if (cached) {
          const data: HydrantsCache = JSON.parse(cached);
          if (data.hydrants && data.hydrants.length > 0) {
            const hydrantsList: Hydrant[] = data.hydrants.map(({ cachedAt, ...rest }) => rest);
            setHydrants(hydrantsList);
          }
        }
      } catch (e) {
        console.error('[Hydranty] Błąd ładowania cache:', e);
      }
    };
    loadCachedHydrants();
  }, []);

  useEffect(() => {
    if (mode === 'geolocation') updateWindFromCurrentLocation();
    else if (mode === 'map-point' && selectedPoint) scheduleWindFetch(selectedPoint.lat, selectedPoint.lng);
  }, [mode, scheduleWindFetch, selectedPoint, updateWindFromCurrentLocation]);

  useEffect(() => {
    if (activeMapMode === 'hydrants' && referencePoint) scheduleWindFetch(referencePoint.lat, referencePoint.lng);
  }, [activeMapMode, referencePoint, scheduleWindFetch]);

  useEffect(() => {
    return () => {
      if (windDebounceRef.current) clearTimeout(windDebounceRef.current);
      if (hydrantsDebounceRef.current) clearTimeout(hydrantsDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeMapMode !== 'hydrants' || !selectedHydrantId) return;
    const entry = hydrantsById[selectedHydrantId];
    if (entry) selectHydrant(entry.hydrant, false);
  }, [referencePoint]);

  // ========================== LEAFLET HTML ==========================
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
    .leaflet-control-attribution { font-size: 10px !important; background: rgba(255,255,255,0.8) !important; }
    .hydrant-popup { font-size: 13px; line-height: 1.4; }
    .hydrant-popup b { color: #C8102E; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([52.0, 19.0], 6);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      referrerPolicy: '${MAP_REFERRER_POLICY}'
    });
    var esriSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri',
      maxZoom: 19
    });
    osmLayer.addTo(map);
    var currentLayer = 'osm';

    var hazardMarker = null;
    var hazardCircles = [];
    var hydrantLayer = L.layerGroup();
    var hydrantMarkersById = {};
    var referenceMarker = null;
    var activeDashedLine = null;
    var hydrantsVisible = false;

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

    function clearHazard() {
      if (hazardMarker) { map.removeLayer(hazardMarker); hazardMarker = null; }
      hazardCircles.forEach(function(c) { map.removeLayer(c); });
      hazardCircles = [];
    }

    function setCenter(lat, lng) {
      clearHazard();
      hazardMarker = L.marker([lat, lng]).addTo(map);
      map.setView([lat, lng], 15);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pointSelected', lat: lat, lng: lng }));
    }

    function drawCircles(lat, lng, radii) {
      hazardCircles.forEach(function(c) { map.removeLayer(c); });
      hazardCircles = [];
      var sortedRadii = radii.slice().sort(function(a, b) { return b.radius - a.radius; });
      sortedRadii.forEach(function(item) {
        var circle = L.circle([lat, lng], { radius: item.radius, color: item.color, fillColor: item.color, fillOpacity: 0.2, weight: 3 }).addTo(map);
        hazardCircles.push(circle);
      });
      if (hazardMarker) hazardMarker.bringToFront();
      if (sortedRadii.length > 0) {
        var bounds = L.latLng(lat, lng).toBounds(sortedRadii[0].radius * 2.5);
        map.fitBounds(bounds);
      }
    }

    function emitBounds() {
      var b = map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'boundsChanged', south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom: map.getZoom()
      }));
    }

    function setHydrantModeActive(active) {
      hydrantsVisible = !!active;
      if (active) {
        clearHazard();
        if (!map.hasLayer(hydrantLayer)) map.addLayer(hydrantLayer);
        emitBounds();
      } else {
        if (map.hasLayer(hydrantLayer)) map.removeLayer(hydrantLayer);
        hydrantLayer.clearLayers();
        hydrantMarkersById = {};
        clearReferenceMarker();
        clearActiveLine();
        map.closePopup();
      }
    }

    function renderHydrants(items) {
      if (!map.hasLayer(hydrantLayer)) map.addLayer(hydrantLayer);
      hydrantsVisible = true;
      hydrantLayer.clearLayers();
      hydrantMarkersById = {};
      items.forEach(function(h) {
        var m = L.circleMarker([h.lat, h.lng], { radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#C8102E', fillOpacity: 1 });
        m._hydrantId = h.id;
        m.on('click', function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hydrantClick', id: h.id })); });
        m.addTo(hydrantLayer);
        hydrantMarkersById[h.id] = m;
      });
    }

    function setHydrantReference(lat, lng) {
      if (referenceMarker) map.removeLayer(referenceMarker);
      referenceMarker = L.circleMarker([lat, lng], { radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#FFD600', fillOpacity: 1 }).addTo(map);
      referenceMarker.bindPopup('Punkt odniesienia');
    }

    function clearReferenceMarker() {
      if (referenceMarker) { map.removeLayer(referenceMarker); referenceMarker = null; }
    }

    function clearActiveLine() {
      if (activeDashedLine) { map.removeLayer(activeDashedLine); activeDashedLine = null; }
    }

    function resetHydrantStyles() {
      Object.keys(hydrantMarkersById).forEach(function(k) {
        hydrantMarkersById[k].setStyle({ radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#C8102E', fillOpacity: 1 });
      });
    }

    function focusHydrant(id, refLat, refLng, popupHtml, centerOnHydrant) {
      clearActiveLine();
      resetHydrantStyles();
      map.closePopup();
      var m = hydrantMarkersById[id];
      if (!m) return;
      m.setStyle({ radius: 11, color: '#FFFFFF', weight: 3, fillColor: '#1565C0', fillOpacity: 1 });
      m.bringToFront();
      if (popupHtml) { m.bindPopup(popupHtml, { className: 'hydrant-popup' }); m.openPopup(); }
      if (centerOnHydrant) map.panTo(m.getLatLng());
      if (typeof refLat === 'number' && typeof refLng === 'number') {
        var ll = m.getLatLng();
        activeDashedLine = L.polyline([[refLat, refLng], [ll.lat, ll.lng]], { color: '#C8102E', weight: 4, dashArray: '8, 8', opacity: 0.95 }).addTo(map);
      }
    }

    function clearHydrantSelection() {
      clearActiveLine();
      resetHydrantStyles();
      map.closePopup();
    }

    map.on('click', function(e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick', lat: e.latlng.lat, lng: e.latlng.lng })); });
    map.on('moveend', function() { if (hydrantsVisible) emitBounds(); });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>
  `, []);

  const visibleRangesCount = ranges.filter(r => r.visible).length;
  const isHydrants = activeMapMode === 'hydrants';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isHydrants ? 'Hydranty' : 'Tworzenie strefy zagrożenia'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.mapContainer, isPanelCollapsed ? styles.mapContainerCollapsed : styles.mapContainerExpanded]}>
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

        <View style={[styles.mapViewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.mapViewToggleBtn, mapView === 'osm' && { backgroundColor: colors.primary }]} onPress={() => switchMapLayer('osm')}>
            <Ionicons name="map" size={14} color={mapView === 'osm' ? '#FFFFFF' : colors.text} />
            <Text style={[styles.mapViewToggleText, { color: mapView === 'osm' ? '#FFFFFF' : colors.text }]}>Domyślny</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapViewToggleBtn, mapView === 'satellite' && { backgroundColor: colors.primary }]} onPress={() => switchMapLayer('satellite')}>
            <Ionicons name="globe" size={14} color={mapView === 'satellite' ? '#FFFFFF' : colors.text} />
            <Text style={[styles.mapViewToggleText, { color: mapView === 'satellite' ? '#FFFFFF' : colors.text }]}>Satelitarny</Text>
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={[styles.windOverlay, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {windState.loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="arrow-up" size={18} color={colors.primary} style={{ transform: [{ rotate: `${windState.directionDegrees ?? 0}deg` }] }} />
              <Text style={[styles.windSpeed, { color: colors.text }]}>{windState.speedKmh !== null ? `${windState.speedKmh} km/h` : '—'}</Text>
              <Text style={[styles.windDirection, { color: colors.textSecondary }]}>{windState.directionLabel}</Text>
              {windState.error ? <Text style={[styles.windError, { color: colors.error }]}>{windState.error}</Text> : null}
            </>
          )}
        </View>

        <TouchableOpacity onPress={toggleMapMode} activeOpacity={0.85} style={[styles.mapModeFab, { backgroundColor: isHydrants ? '#FFD600' : '#C8102E', borderColor: isHydrants ? '#FFD600' : '#C8102E' }]}>
          <Ionicons name={isHydrants ? 'warning' : 'water'} size={18} color={isHydrants ? '#1a1a1a' : '#FFFFFF'} />
          <Text style={[styles.mapModeFabText, { color: isHydrants ? '#1a1a1a' : '#FFFFFF' }]}>{isHydrants ? 'Strefa' : 'Hydranty'}</Text>
        </TouchableOpacity>

        {isHydrants && hydrantsLoading ? (
          <View pointerEvents="none" style={[styles.hydrantsLoadingBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.hydrantsLoadingText, { color: colors.text }]}>{statusMessage || 'Pobieranie…'}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.controlPanel, isPanelCollapsed ? styles.controlPanelCollapsed : styles.controlPanelExpanded, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => setIsPanelCollapsed((prev) => !prev)} style={[styles.panelToggleHandle, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name={isPanelCollapsed ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {!isPanelCollapsed ? (
          isHydrants ? (
            <View style={styles.controlPanelHydrantWrap}>
              <HydrantManagementPanel
                colors={colors}
                selectionMode={hydrantSelectionMode}
                referencePoint={referencePoint}
                nearestHydrants={nearestHydrants}
                selectedHydrantId={selectedHydrantId}
                loading={hydrantsLoading}
                errorMessage={hydrantsError}
                totalCount={hydrants.length}
                onSelectGeolocation={() => {
                  hydrantSelectionModeRef.current = 'geolocation';
                  setHydrantSelectionMode('geolocation');
                  setReferencePointFromGeolocation();
                }}
                onSelectMapPoint={() => {
                  hydrantSelectionModeRef.current = 'map-point';
                  setHydrantSelectionMode('map-point');
                  setHydrantsError('');
                }}
                onHydrantPress={handleHydrantListPress}
                onRetryFetch={() => fetchHydrantsForCurrentBounds()}
              />
              <View style={{ height: insets.bottom + 12 }} />
            </View>
          ) : (
            <ScrollView style={styles.controlPanelScroll} contentContainerStyle={[styles.controlPanelContent, { paddingBottom: 20 + insets.bottom }]} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Wybór środka strefy</Text>
              <View style={styles.modeButtons}>
                <TouchableOpacity style={[styles.modeButton, { borderColor: colors.border }, mode === 'geolocation' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setMode('geolocation')}>
                  <Ionicons name="locate" size={20} color={mode === 'geolocation' ? '#FFFFFF' : colors.text} />
                  <Text style={[styles.modeButtonText, { color: mode === 'geolocation' ? '#FFFFFF' : colors.text }]}>Moja lokalizacja</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeButton, { borderColor: colors.border }, mode === 'map-point' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setMode('map-point')}>
                  <Ionicons name="location" size={20} color={mode === 'map-point' ? '#FFFFFF' : colors.text} />
                  <Text style={[styles.modeButtonText, { color: mode === 'map-point' ? '#FFFFFF' : colors.text }]}>Wskaż na mapie</Text>
                </TouchableOpacity>
              </View>

              {errors.center && <Text style={styles.errorText}>{errors.center}</Text>}

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Zakresy strefy</Text>
              {ranges.filter(r => r.visible).map((range) => (
                <View key={range.id} style={styles.rangeRow}>
                  <View style={[styles.rangeColorDot, { backgroundColor: range.color }]} />
                  <Text style={[styles.rangeLabel, { color: colors.text }]}>Promień {range.id}</Text>
                  <TextInput
                    style={[styles.rangeInput, { backgroundColor: colors.surface, color: colors.text, borderColor: errors[`range${range.id}`] ? '#ff0000' : colors.border }]}
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
                errors[`range${range.id}`] ? <Text key={`error-${range.id}`} style={styles.errorText}>{errors[`range${range.id}`]}</Text> : null
              ))}

              {visibleRangesCount < 3 && (
                <TouchableOpacity style={[styles.addRangeButton, { borderColor: colors.border }]} onPress={addRange}>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  <Text style={[styles.addRangeText, { color: colors.primary }]}>Dodaj kolejny zakres</Text>
                </TouchableOpacity>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={clearAll}>
                  <Ionicons name="trash-outline" size={18} color={colors.text} />
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Wyczyść</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={createHazardZone} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="radio-button-on" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Wyznacz strefę</Text></>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )
        ) : (
          <View style={[styles.panelCollapsedSpacer, { paddingBottom: 8 + insets.bottom }]} />
        )}
      </View>

      <CountySelectionModal
        visible={countyModalVisible}
        onClose={() => setCountyModalVisible(false)}
        onSelect={handleManualCountySelect}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  headerSpacer: { width: 40 },
  mapContainer: { position: 'relative' },
  mapContainerExpanded: { flex: 1, minHeight: 220 },
  mapContainerCollapsed: { flex: 1, minHeight: 260 },
  map: { flex: 1 },
  mapLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    maxHeight: 160,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 6,
    zIndex: 9999,
  },
  debugText: { color: '#fff', fontSize: 12 },
  controlPanel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -16, overflow: 'hidden' },
  controlPanelExpanded: { height: SCREEN_HEIGHT * 0.4 },
  controlPanelCollapsed: { height: 40 },
  controlPanelScroll: { flex: 1 },
  controlPanelContent: { paddingHorizontal: 14, paddingTop: 6 },
  controlPanelHydrantWrap: { flex: 1 },
  panelToggleHandle: { alignItems: 'center', alignSelf: 'center', borderRadius: 999, borderWidth: 1, height: 18, justifyContent: 'center', marginTop: 8, marginBottom: 4, width: 34 },
  panelCollapsedSpacer: { minHeight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  modeButtons: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, gap: 6 },
  modeButtonText: { fontSize: 12, fontWeight: '600' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  rangeColorDot: { width: 16, height: 16, borderRadius: 8 },
  rangeLabel: { fontSize: 13, fontWeight: '600', width: 72 },
  rangeInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  rangeUnit: { fontSize: 13, width: 20 },
  addRangeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', gap: 8, marginTop: 2, marginBottom: 12 },
  addRangeText: { fontSize: 13, fontWeight: '600' },
  errorText: { color: '#ff0000', fontSize: 11, marginBottom: 6, marginLeft: 26 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  primaryButton: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  windOverlay: { alignItems: 'center', borderRadius: 14, borderWidth: 1, minWidth: 96, paddingHorizontal: 10, paddingVertical: 8, position: 'absolute', right: 12, top: 12 },
  windSpeed: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  windDirection: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  windError: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  secondaryButton: { flex: 0.9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, borderWidth: 2, gap: 6 },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  mapModeFab: { position: 'absolute', right: 12, bottom: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5, gap: 6, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
  mapModeFabText: { fontSize: 13, fontWeight: '700' },
  mapViewToggle: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 2, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  mapViewToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 4 },
  mapViewToggleText: { fontSize: 11, fontWeight: '700' },
  hydrantsLoadingBadge: { position: 'absolute', top: 110, right: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, gap: 6 },
  hydrantsLoadingText: { fontSize: 11, fontWeight: '600' },
});
