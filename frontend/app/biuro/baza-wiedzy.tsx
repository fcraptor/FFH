// ============================================================
// BAZA WIEDZY KG - MAIN SCREEN
// Knowledge base with tree navigation and search
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { useTheme } from '../../src/contexts/ThemeContext';
import { KnowledgeNode, KnowledgeIndexItem, KnowledgeSyncMeta } from '../../src/types/knowledge';
import { KnowledgeTreeNode } from '../../src/components/knowledge/KnowledgeTreeNode';
import { KnowledgeSearchResults } from '../../src/components/knowledge/KnowledgeSearchResults';
import {
  syncKnowledgeData,
  loadKnowledgeFromCache,
  SyncResult,
} from '../../src/services/knowledgeSyncService';
import { searchKnowledgeIndex } from '../../src/services/knowledgeTreeBuilder';

type ViewMode = 'tree' | 'search';

export default function BazaWiedzyScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // Data state
  const [tree, setTree] = useState<KnowledgeNode[]>([]);
  const [index, setIndex] = useState<KnowledgeIndexItem[]>([]);
  const [meta, setMeta] = useState<KnowledgeSyncMeta | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('tree');

  // Search results
  const searchResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return searchKnowledgeIndex(index, searchQuery);
  }, [index, searchQuery]);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load cached data first, then sync
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, try to load from cache
      const cached = await loadKnowledgeFromCache();
      if (cached) {
        setTree(cached.tree);
        setIndex(cached.index);
        setMeta(cached.meta);
        setLoading(false);

        // Then sync in background
        performBackgroundSync();
      } else {
        // No cache - must sync
        await performSync();
      }
    } catch (err) {
      setError('Wystąpił błąd podczas ładowania danych.');
      setLoading(false);
    }
  };

  // Background sync (no loading indicator)
  const performBackgroundSync = async () => {
    setSyncing(true);
    try {
      const result = await syncKnowledgeData();
      if (result.success && !result.fromCache) {
        setTree(result.tree);
        setIndex(result.index);
        setMeta(result.meta);
      }
    } catch (err) {
      // Silent fail for background sync
    } finally {
      setSyncing(false);
    }
  };

  // Full sync with loading
  const performSync = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await syncKnowledgeData();
      setTree(result.tree);
      setIndex(result.index);
      setMeta(result.meta);

      if (!result.success) {
        setError(result.error || 'Nie udało się pobrać danych.');
      } else if (result.fromCache && result.error) {
        // Show warning but continue with cached data
        Alert.alert('Informacja', result.error);
      }
    } catch (err) {
      setError('Wystąpił błąd podczas synchronizacji.');
    } finally {
      setLoading(false);
    }
  };

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await performSync();
    setRefreshing(false);
  };

  // Toggle folder expand/collapse
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Open file or link
  const handleOpenItem = useCallback(async (item: KnowledgeNode | KnowledgeIndexItem) => {
    const url = item.url;
    if (!url) {
      Alert.alert('Błąd', 'Brak adresu URL dla tego elementu.');
      return;
    }

    try {
      // Try expo-web-browser first
      if (Platform.OS !== 'web') {
        await WebBrowser.openBrowserAsync(url);
      } else {
        // Fallback to Linking for web
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Błąd', 'Nie można otworzyć tego linku.');
        }
      }
    } catch (err) {
      // Fallback to Linking
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Błąd', 'Nie udało się otworzyć linku. Sprawdź połączenie z internetem.');
      }
    }
  }, []);

  // Handle search input
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      setViewMode('search');
    } else {
      setViewMode('tree');
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setViewMode('tree');
  };

  // Expand all root folders
  const handleExpandAll = () => {
    const allFolderIds = new Set<string>();
    const collectFolderIds = (nodes: KnowledgeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'folder') {
          allFolderIds.add(node.id);
        }
        if (node.children) {
          collectFolderIds(node.children);
        }
      }
    };
    collectFolderIds(tree);
    setExpandedIds(allFolderIds);
  };

  // Collapse all
  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Format last sync time
  const formatLastSync = (isoString: string | null): string => {
    if (!isoString) return 'nigdy';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'nieznana';
    }
  };

  // Render loading state
  if (loading && tree.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Synchronizacja bazy wiedzy...
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
            Pobieranie danych z gov.pl/kgpsp
          </Text>
          <Text style={[styles.loadingHint, { color: colors.textSecondary }]}>
            Pierwsza synchronizacja może potrwać do 2 minut
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state (no data)
  if (error && tree.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={performSync}
          >
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Szukaj w bazie wiedzy..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Toolbar (only in tree mode) */}
      {viewMode === 'tree' && (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleExpandAll}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.toolbarButtonText, { color: colors.textSecondary }]}>Rozwiń</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleCollapseAll}>
            <Ionicons name="remove-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.toolbarButtonText, { color: colors.textSecondary }]}>Zwiń</Text>
          </TouchableOpacity>
          <View style={styles.toolbarSpacer} />
          <Text style={[styles.statsText, { color: colors.textSecondary }]}>
            {meta?.itemCount || 0} materiałów
          </Text>
        </View>
      )}

      {/* Search Results or Tree */}
      {viewMode === 'search' ? (
        <KnowledgeSearchResults
          results={searchResults}
          onOpenItem={handleOpenItem}
          colors={colors}
        />
      ) : (
        <ScrollView
          style={styles.treeContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {tree.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Baza wiedzy jest pusta
              </Text>
            </View>
          ) : (
            tree.map((node) => (
              <KnowledgeTreeNode
                key={node.id}
                node={node}
                level={0}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onOpenItem={handleOpenItem}
                colors={colors}
              />
            ))
          )}
          
          {/* Footer with sync info */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Ostatnia synchronizacja: {formatLastSync(meta?.lastSync || null)}
            </Text>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Źródło: gov.pl/kgpsp/baza-wiedzy
            </Text>
          </View>
        </ScrollView>
      )}
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
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
  },
  syncIndicator: {
    marginRight: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarButtonText: {
    fontSize: 13,
  },
  toolbarSpacer: {
    flex: 1,
  },
  statsText: {
    fontSize: 12,
  },
  treeContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  loadingSubtext: {
    fontSize: 14,
  },
  loadingHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerText: {
    fontSize: 11,
  },
});
