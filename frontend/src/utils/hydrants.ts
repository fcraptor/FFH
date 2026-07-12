import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

// Debug receiver: allows UI to register a callback to receive debug messages from this module
let debugReceiver: ((msg: string) => void) | null = null;
export function setHydrantsDebugReceiver(fn: ((msg: string) => void) | null) {
  debugReceiver = fn;
}
function sendDebug(msg: string) {
  try { console.log('[Hydranty DEBUG]', msg); } catch {}
  if (debugReceiver) {
    try { debugReceiver(msg); } catch {}
  }
}
// Używamy rzutowania na any, aby TS nie zgłaszał błędów braku właściwości
const fsAny = FileSystem as any;

const getGeojsonDirectory = (): string => {
  const rootDir = fsAny.documentDirectory || fsAny.cacheDirectory || '';
  return rootDir ? `${rootDir}hydrants_geojson/` : '';
};

const POWIAT_GEOJSON_FOLDER = getGeojsonDirectory();

// ============================================================================
// 1. ORYGINALNY KOD Z GITHUBA
// ============================================================================

export interface Hydrant {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export interface HydrantWithDistance extends Hydrant {
  distanceMeters: number;
  label: string;
}

export interface ReferencePoint {
  lat: number;
  lng: number;
  source: 'gps' | 'map';
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

export const MIN_ZOOM_FOR_HYDRANTS = 13;

const buildOverpassQuery = (bbox: BBox): string => (
  `[out:json][timeout:25];
(
  node["emergency"="fire_hydrant"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  node["amenity"="fire_hydrant"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out body;`
);

export const parseOverpassHydrants = (data: any): Hydrant[] => {
  if (!data || !Array.isArray(data.elements)) return [];
  return data.elements
    .filter((el: any) => el && el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number')
    .map((el: any): Hydrant => ({
      id: `osm-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      tags: (el.tags && typeof el.tags === 'object') ? el.tags : {},
    }));
};

export class OverpassError extends Error {
  constructor(
    message: string,
    public code: 'timeout' | 'http' | 'parse' | 'network' = 'http',
    public endpoint?: string,
  ) {
    super(message);
  }
}

const tryFetchOverpass = async (endpoint: string, query: string): Promise<Hydrant[]> => {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*',
      },
      body: `data=${encodeURIComponent(query)}`,
    });
  } catch (e) {
    throw new OverpassError('Network error', 'network', endpoint);
  }

  if (!response.ok) {
    throw new OverpassError(`HTTP ${response.status}`, 'http', endpoint);
  }

  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) {
    if (/too busy|timeout|gateway|rate.?limit/i.test(trimmed)) {
      throw new OverpassError('Server too busy', 'timeout', endpoint);
    }
    throw new OverpassError('Unexpected response format', 'parse', endpoint);
  }

  let payload: any;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new OverpassError('JSON parse failed', 'parse', endpoint);
  }

  return parseOverpassHydrants(payload);
};

export const fetchHydrantsForBounds = async (bbox: BBox): Promise<Hydrant[]> => {
  const query = buildOverpassQuery(bbox);
  let lastError: OverpassError | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await tryFetchOverpass(endpoint, query);
    } catch (e) {
      lastError = e instanceof OverpassError ? e : new OverpassError(String(e));
    }
  }

  throw lastError || new OverpassError('Unknown error');
};

export const calculateDistanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

export const getHydrantLabel = (hydrant: Hydrant, index: number): string => {
  const tags = hydrant.tags || {};
  const candidates = [
    tags.ref,
    tags.name,
    tags['fire_hydrant:ref'],
    tags['ref:hydrant'],
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (candidates.length > 0) return candidates[0].trim();
  return `Hydrant ${index + 1}`;
};

export const getHydrantDescription = (hydrant: Hydrant): string => {
  const tags = hydrant.tags || {};
  const parts: string[] = [];

  const type = tags['fire_hydrant:type'];
  if (type) {
    const typeLabels: Record<string, string> = {
      pillar: 'naziemny (pillar)',
      underground: 'podziemny',
      wall: 'ścienny',
      pond: 'staw',
      pipe: 'rura',
    };
    parts.push(typeLabels[type] || type);
  }

  const position = tags['fire_hydrant:position'];
  if (position) parts.push(`pozycja: ${position}`);

  const diameter = tags['fire_hydrant:diameter'] || tags.diameter;
  if (diameter) parts.push(`Ø ${diameter}`);

  const pressure = tags['fire_hydrant:pressure'] || tags.pressure;
  if (pressure) parts.push(`p: ${pressure}`);

  return parts.join(' · ');
};

export const getNearestHydrants = (
  hydrants: Hydrant[],
  reference: { lat: number; lng: number },
  count: number = 5,
): HydrantWithDistance[] => {
  if (!hydrants.length) return [];
  return hydrants
    .map((hydrant, index) => ({
      ...hydrant,
      distanceMeters: calculateDistanceMeters(reference, hydrant),
      label: getHydrantLabel(hydrant, index),
    }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, count);
};

// ============================================================================
// 2. NOWA LOGIKA: POWIATY, GEOJSON, NOMINATIM
// ============================================================================

export interface PowiatEntry {
  teryt: string;
  name: string;
  normalizedName: string;
  displayName: string;
  fileNameGeoJSON: string;
  aliases: string[];
  hydrantsCount?: number;
}

const HYDRANTS_GEOJSON_REPOSITORY = 'https://github.com/fcraptor/hydranty-data';
const HYDRANTS_GEOJSON_RELEASE_TAG = 'Hyd_pow_1';
export const HYDRANTS_GEOJSON_RELEASE_URL = `${HYDRANTS_GEOJSON_REPOSITORY}/releases/tag/${HYDRANTS_GEOJSON_RELEASE_TAG}`;
const POWIAT_GEOJSON_DOWNLOAD_BASE_URL = `${HYDRANTS_GEOJSON_REPOSITORY}/releases/download/${HYDRANTS_GEOJSON_RELEASE_TAG}/`;
const POWIAT_GEOJSON_RAW_BASE_URLS = [
  `https://raw.githubusercontent.com/fcraptor/hydranty-data/main/`,
  `https://raw.githubusercontent.com/fcraptor/hydranty-data/master/`,
];

const powiatIndex = require('../../assets/powiat_index.json');

export function getAllPowiats(): PowiatEntry[] {
  const items = Array.isArray((powiatIndex as any)?.items) ? (powiatIndex as any).items : [];
  return items as PowiatEntry[];
}

export function findPowiatEntry(rawQuery: string): PowiatEntry | null {
  if (!rawQuery || !powiatIndex) return null;
  const query = rawQuery.toLowerCase().trim();
  const items = powiatIndex.items || [];
  
  for (let i = 0; i < items.length; i++) {
    const entry = items[i];
    const normName = (entry.normalizedName || '').toLowerCase();
    const displayName = (entry.displayName || '').toLowerCase();
    const teryt = (entry.teryt || '').toString();
    const aliases = Array.isArray(entry.aliases) ? entry.aliases.map((a: string) => a.toLowerCase()) : [];
    
    if (normName.includes(query) || displayName.includes(query) || teryt === query || aliases.some((a: string) => a.includes(query))) {
      return entry as PowiatEntry;
    }
  }
  return null;
}

export async function resolveCountyFromLocation(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'FireFighterHelper' } });
    if (!response.ok) return null;
    const data = await response.json();
    return data.address?.county || data.address?.city || null;
  } catch {
    return null;
  }
}

export async function ensureGeojsonDirExists(folder: string): Promise<void> {
  if (!folder) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(folder);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    }
  } catch (error: any) {
    console.error('Błąd katalogu:', error);
  }
}

async function tryFetchAndWriteGeojson(url: string, localFilePath: string): Promise<boolean> {
  try {
    const attemptMsg = `Próba pobrania z: ${url}`;
    console.log(`[Hydranty] ${attemptMsg}`);
    sendDebug(attemptMsg);
    try { Alert.alert('Hydranty - pobieranie', `Pobieram: ${url}`); } catch (e) { /* ignore alert failures */ }
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json,application/octet-stream,text/plain,*/*',
      },
    });

    const respMsg = `Odpowiedź: status=${response.status}, contentType=${response.headers.get('content-type') || '—'}`;
    console.log(`[Hydranty] ${respMsg}`);
    sendDebug(respMsg);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error('Pusta odpowiedź serwera');
    }

    await FileSystem.writeAsStringAsync(localFilePath, text);
    const info = await FileSystem.getInfoAsync(localFilePath);
    console.log(`[Hydranty] Plik zapisany: ${localFilePath}, uri=${info.uri}`);
    return true;
  } catch (error: any) {
    const errMsg = `Błąd pobierania z ${url}: ${error?.message || error}`;
    console.warn(`[Hydranty] ${errMsg}`);
    sendDebug(errMsg);
    try { Alert.alert('Hydranty - błąd pobierania', `${url}\n${error?.message || error}`); } catch (e) { /* ignore */ }
    return false;
  }
}

async function tryFetchGeojsonContent(url: string): Promise<string | null> {
  try {
    const attemptMsg = `Pobieram zawartość bez lokalnego FS: ${url}`;
    console.log(`[Hydranty] ${attemptMsg}`);
    sendDebug(attemptMsg);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json,application/octet-stream,text/plain,*/*',
      },
    });
    const respMsg = `Odpowiedź: status=${response.status}, contentType=${response.headers.get('content-type') || '—'}`;
    console.log(`[Hydranty] ${respMsg}`);
    sendDebug(respMsg);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error('Pusta odpowiedź serwera');
    }
    return text;
  } catch (error: any) {
    const errMsg = `Błąd pobierania zawartości z ${url}: ${error?.message || error}`;
    console.warn(`[Hydranty] ${errMsg}`);
    sendDebug(errMsg);
    return null;
  }
}

export async function ensurePowiatDataExists(fileNameGeoJSON: string): Promise<string | null> {
  const geojsonFolder = getGeojsonDirectory();
  const localFilePath = geojsonFolder ? `${geojsonFolder}${fileNameGeoJSON}` : '';
  sendDebug(`ensurePowiatDataExists: geojsonFolder=${geojsonFolder}, localFilePath=${localFilePath}`);

  if (localFilePath) {
    await ensureGeojsonDirExists(geojsonFolder);
    try {
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);
      if (fileInfo.exists) {
        sendDebug(`Plik GEOJSON już istnieje lokalnie: ${localFilePath}`);
        return localFilePath;
      }
    } catch (fileInfoError: any) {
      sendDebug(`Nie można odczytać informacji o pliku lokalnym: ${String(fileInfoError)}`);
      // ignore and continue with download
    }
  }

  const githubApiReleaseUrl = `https://api.github.com/repos/fcraptor/hydranty-data/releases/tags/${HYDRANTS_GEOJSON_RELEASE_TAG}`;
  try {
    console.log(`[Hydranty] Sprawdzanie release API: ${githubApiReleaseUrl}`);
    const apiResp = await fetch(githubApiReleaseUrl, { headers: { 'User-Agent': 'FireFighterHelper', Accept: 'application/vnd.github.v3+json' } });
    if (apiResp.ok) {
      const releaseJson = await apiResp.json();
      const assets = Array.isArray(releaseJson.assets) ? releaseJson.assets : [];
      const match = assets.find((a: any) => a && a.name === fileNameGeoJSON && a.browser_download_url);
      if (match) {
        console.log(`[Hydranty] Znalazłem asset w release: ${match.browser_download_url}`);
        if (localFilePath) {
          const ok = await tryFetchAndWriteGeojson(match.browser_download_url, localFilePath);
          if (ok) return localFilePath;
        } else {
          const content = await tryFetchGeojsonContent(match.browser_download_url);
          if (content !== null) return match.browser_download_url;
        }
        console.warn('[Hydranty] Pobranie z release asset zakończone niepowodzeniem, przechodzę do fallbacków.');
      } else {
        console.warn('[Hydranty] Asset nieznaleziony w release API, przechodzę do fallbacków.');
      }
    } else {
      console.warn(`[Hydranty] Release API zwróciło status ${apiResp.status}`);
    }
  } catch (error: any) {
    console.warn('[Hydranty] Błąd podczas zapytania GitHub Release API:', error);
  }

  const candidateUrls = [
    POWIAT_GEOJSON_DOWNLOAD_BASE_URL + fileNameGeoJSON,
    ...POWIAT_GEOJSON_RAW_BASE_URLS.map((baseUrl) => baseUrl + fileNameGeoJSON),
  ];

  for (const url of candidateUrls) {
    if (localFilePath) {
      const success = await tryFetchAndWriteGeojson(url, localFilePath);
      if (success) return localFilePath;
    } else {
      const content = await tryFetchGeojsonContent(url);
      if (content !== null) return url;
    }
  }

  sendDebug(`[Hydranty] Nie udało się pobrać ${fileNameGeoJSON} z żadnego źródła.`);
  console.error(`[Hydranty] Nie udało się pobrać ${fileNameGeoJSON} z żadnego źródła.`);
  return null;
}

export async function loadHydrantsFromPowiatGeoJSON(localFilePath: string): Promise<Hydrant[]> {
  try {
    let content: string;
    if (localFilePath.startsWith('http://') || localFilePath.startsWith('https://')) {
      const response = await fetch(localFilePath);
      if (!response.ok) {
        console.warn(`[Hydranty] Nie udało się pobrać remote GEOJSON: ${response.status}`);
        return [];
      }
      content = await response.text();
    } else {
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);
      if (!fileInfo.exists) return [];
      content = await FileSystem.readAsStringAsync(localFilePath);
    }
    const geojsonData = JSON.parse(content);
    const features = geojsonData.features || [];
    
    return features.map((f: any): Hydrant => {
      const coords = f.geometry?.coordinates || [0, 0];
      return {
        id: String(f.id || f.properties?.id || Math.random()),
        lat: coords[1],
        lng: coords[0],
        tags: f.properties || {}
      };
    });
  } catch (error: any) {
    console.error("Błąd parsowania:", error);
    return [];
  }
}