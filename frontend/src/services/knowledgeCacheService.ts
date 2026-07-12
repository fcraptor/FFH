// ============================================================
// KNOWLEDGE BASE - CACHE SERVICE
// Local storage management using AsyncStorage
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KnowledgeNode,
  KnowledgeIndexItem,
  KnowledgeSyncMeta,
  KnowledgeCacheData,
} from '../types/knowledge';

// Cache keys
const CACHE_KEYS = {
  TREE: '@knowledge_tree_v1',
  INDEX: '@knowledge_items_index_v1',
  LAST_SYNC: '@knowledge_last_sync',
  SYNC_META: '@knowledge_sync_meta',
};

// ============================================================
// TREE CACHE
// ============================================================

export const saveKnowledgeTree = async (tree: KnowledgeNode[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.TREE, JSON.stringify(tree));
  } catch (error) {
    console.error('[KnowledgeCache] Failed to save tree:', error);
  }
};

export const loadKnowledgeTree = async (): Promise<KnowledgeNode[] | null> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.TREE);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('[KnowledgeCache] Failed to load tree:', error);
    return null;
  }
};

// ============================================================
// INDEX CACHE
// ============================================================

export const saveKnowledgeIndex = async (index: KnowledgeIndexItem[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.INDEX, JSON.stringify(index));
  } catch (error) {
    console.error('[KnowledgeCache] Failed to save index:', error);
  }
};

export const loadKnowledgeIndex = async (): Promise<KnowledgeIndexItem[] | null> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.INDEX);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('[KnowledgeCache] Failed to load index:', error);
    return null;
  }
};

// ============================================================
// SYNC METADATA
// ============================================================

export const saveSyncMeta = async (meta: KnowledgeSyncMeta): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.SYNC_META, JSON.stringify(meta));
    if (meta.lastSync) {
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, meta.lastSync);
    }
  } catch (error) {
    console.error('[KnowledgeCache] Failed to save sync meta:', error);
  }
};

export const loadSyncMeta = async (): Promise<KnowledgeSyncMeta | null> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.SYNC_META);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('[KnowledgeCache] Failed to load sync meta:', error);
    return null;
  }
};

export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
  } catch (error) {
    console.error('[KnowledgeCache] Failed to get last sync time:', error);
    return null;
  }
};

// ============================================================
// FULL CACHE OPERATIONS
// ============================================================

export const saveFullCache = async (data: KnowledgeCacheData): Promise<void> => {
  await Promise.all([
    saveKnowledgeTree(data.tree),
    saveKnowledgeIndex(data.index),
    saveSyncMeta(data.meta),
  ]);
};

export const loadFullCache = async (): Promise<KnowledgeCacheData | null> => {
  const [tree, index, meta] = await Promise.all([
    loadKnowledgeTree(),
    loadKnowledgeIndex(),
    loadSyncMeta(),
  ]);

  if (tree && index) {
    return {
      tree,
      index,
      meta: meta || {
        lastSync: null,
        lastSyncSuccess: false,
        itemCount: 0,
      },
    };
  }

  return null;
};

export const clearKnowledgeCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.TREE,
      CACHE_KEYS.INDEX,
      CACHE_KEYS.LAST_SYNC,
      CACHE_KEYS.SYNC_META,
    ]);
  } catch (error) {
    console.error('[KnowledgeCache] Failed to clear cache:', error);
  }
};

export const hasKnowledgeCache = async (): Promise<boolean> => {
  try {
    const tree = await AsyncStorage.getItem(CACHE_KEYS.TREE);
    return tree !== null;
  } catch {
    return false;
  }
};
