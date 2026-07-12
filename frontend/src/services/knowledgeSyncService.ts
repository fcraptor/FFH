// ============================================================
// KNOWLEDGE BASE - SYNC SERVICE
// Fetches data from external JSON endpoint and updates cache
// ============================================================

import axios from 'axios';
import Constants from 'expo-constants';
import {
  KnowledgeNode,
  KnowledgeIndexItem,
  KnowledgeSyncMeta,
  KnowledgeApiResponse,
  KnowledgeCacheData,
} from '../types/knowledge';
import {
  saveFullCache,
  loadFullCache,
  saveSyncMeta,
} from './knowledgeCacheService';
import {
  buildTreeFromFlatList,
  buildSearchIndex,
  countTreeItems,
} from './knowledgeTreeBuilder';

// ============================================================
// CONFIGURATION
// ============================================================

// === SYNC ENDPOINT URL ===
// To change the sync endpoint path, modify this:
const KNOWLEDGE_SYNC_PATH = '/api/baza-wiedzy';
// For external API, set full URL: 'https://ffh-api.vercel.app/api/baza-wiedzy'
// =========================

const normalizeKnowledgeEndpoint = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith(KNOWLEDGE_SYNC_PATH)) return trimmed;
  return `${trimmed.replace(/\/+$/, '')}${KNOWLEDGE_SYNC_PATH}`;
};

const getExpoHost = (): string | null => {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) return null;

  const host = hostUri.split(':')[0];
  if (!host) return null;

  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
};

const getKnowledgeSyncUrlCandidates = (): string[] => {
  const explicitUrl = normalizeKnowledgeEndpoint(process.env.EXPO_PUBLIC_BACKEND_URL);
  if (explicitUrl) {
    return [explicitUrl];
  }

  // Fallback logic for local development when EXPO_PUBLIC_BACKEND_URL is not set
  const candidates = new Set<string>();
  const expoHost = getExpoHost();
  const fallbackPorts = ['8000', '8001', '3000', '5001'];

  if (expoHost) {
    fallbackPorts.forEach(port => {
      const endpoint = normalizeKnowledgeEndpoint(`http://${expoHost}:${port}`);
      if (endpoint) candidates.add(endpoint);
    });
  }

  ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://10.0.2.2:8000'].forEach(base => {
    const endpoint = normalizeKnowledgeEndpoint(base);
    if (endpoint) candidates.add(endpoint);
  });

  return Array.from(candidates);
};

const SYNC_TIMEOUT = 120000; // 120 seconds - scraping takes time

// ============================================================
// SYNC RESULT TYPE
// ============================================================

export interface SyncResult {
  success: boolean;
  fromCache: boolean;
  tree: KnowledgeNode[];
  index: KnowledgeIndexItem[];
  meta: KnowledgeSyncMeta;
  error?: string;
}

// ============================================================
// FETCH FROM ENDPOINT
// ============================================================

const fetchKnowledgeData = async (): Promise<KnowledgeApiResponse | null> => {
  const candidateUrls = getKnowledgeSyncUrlCandidates();

  for (const url of candidateUrls) {
    try {
      console.log('[KnowledgeSync] Fetching from:', url);

      const response = await axios.get<KnowledgeApiResponse>(url, {
        timeout: SYNC_TIMEOUT,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (response.data && response.data.nodes) {
        console.log('[KnowledgeSync] Received', response.data.nodes.length, 'nodes');
        return response.data;
      }

      console.warn('[KnowledgeSync] Invalid response structure from:', url);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          console.warn('[KnowledgeSync] Request timeout for:', url);
        } else if (error.response) {
          console.warn(`[KnowledgeSync] Server error ${error.response.status} for:`, url);
        } else if (error.request) {
          console.warn('[KnowledgeSync] Network error - no response received from:', url);
        }
      } else {
        console.error('[KnowledgeSync] Fetch error for:', url, error);
      }
    }
  }

  console.warn('[KnowledgeSync] Failed to reach any endpoint. Tried:', candidateUrls);
  return null;
};

// ============================================================
// SYNC WITH CACHE FALLBACK
// ============================================================

export const syncKnowledgeData = async (): Promise<SyncResult> => {
  // First, load cached data
  const cachedData = await loadFullCache();

  // Try to fetch fresh data
  const freshData = await fetchKnowledgeData();

  if (freshData) {
    // Log types of nodes received
    const typeCount: Record<string, number> = {};
    for (const node of freshData.nodes) {
      typeCount[node.type] = (typeCount[node.type] || 0) + 1;
    }
    console.log('[KnowledgeSync] Node types received:', typeCount);
    
    // Build tree from flat list
    const tree = buildTreeFromFlatList(freshData.nodes);
    
    // Log sections in tree
    const countSections = (nodes: any[]): number => {
      let count = 0;
      for (const node of nodes) {
        if (node.type === 'section') count++;
        if (node.children?.length) count += countSections(node.children);
      }
      return count;
    };
    console.log('[KnowledgeSync] Sections in tree:', countSections(tree));
    
    // Build search index
    const index = buildSearchIndex(tree);
    
    // Count items
    const counts = countTreeItems(tree);
    
    // Create sync metadata
    const meta: KnowledgeSyncMeta = {
      lastSync: new Date().toISOString(),
      lastSyncSuccess: true,
      itemCount: counts.files + counts.links,
      version: freshData.version,
    };

    // Save to cache
    await saveFullCache({ tree, index, meta });

    return {
      success: true,
      fromCache: false,
      tree,
      index,
      meta,
    };
  }

  // Fetch failed - use cached data if available
  if (cachedData) {
    // Update sync meta to indicate failed sync
    const meta: KnowledgeSyncMeta = {
      ...cachedData.meta,
      lastSyncSuccess: false,
    };
    await saveSyncMeta(meta);

    return {
      success: true,
      fromCache: true,
      tree: cachedData.tree,
      index: cachedData.index,
      meta,
      error: 'Nie udało się pobrać nowych danych. Wyświetlam ostatnią wersję.',
    };
  }

  // No cached data and fetch failed
  return {
    success: false,
    fromCache: false,
    tree: [],
    index: [],
    meta: {
      lastSync: null,
      lastSyncSuccess: false,
      itemCount: 0,
    },
    error: 'Brak połączenia z internetem i brak danych lokalnych.',
  };
};

// ============================================================
// LOAD FROM CACHE ONLY
// ============================================================

export const loadKnowledgeFromCache = async (): Promise<KnowledgeCacheData | null> => {
  return await loadFullCache();
};

// ============================================================
// BACKGROUND SYNC
// ============================================================

export const syncKnowledgeInBackground = async (
  onSuccess?: (data: SyncResult) => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    const result = await syncKnowledgeData();
    
    if (result.success && !result.fromCache) {
      onSuccess?.(result);
    } else if (result.error) {
      onError?.(result.error);
    }
  } catch (error) {
    onError?.(error instanceof Error ? error.message : 'Błąd synchronizacji');
  }
};

// ============================================================
// GET SYNC ENDPOINT (for debugging/config display)
// ============================================================

export const getKnowledgeSyncEndpoint = (): string => {
  return getKnowledgeSyncUrlCandidates()[0] ?? '/api/baza-wiedzy';
};
