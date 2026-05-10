import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/contexts/ThemeContext';
import { useUsage } from '../src/contexts/UsageContext';
import { SearchBar } from '../src/components/SearchBar';
import { syncAllData, fetchCategories, hasInitialData, refreshDataInBackground } from '../src/utils/dataService';
import { CategoryConfig, categoryMetaToConfig } from '../src/utils/categoryConfig';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { getMostUsed, usageData } = useUsage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [noDataError, setNoDataError] = useState(false);

  useEffect(() => {
    initialLoad();
  }, []);

  const initialLoad = async () => {
    setSyncing(true);
    setNoDataError(false);
    
    // First, try to load from cache
    const categoriesData = await fetchCategories(false);
    
    if (categoriesData && categoriesData.length > 0) {
      // We have cached data - show it immediately
      setCategories(categoriesData.map(categoryMetaToConfig));
      setSyncing(false);
      
      // Then refresh in background
      refreshDataInBackground().then(async () => {
        const freshData = await fetchCategories(false);
        if (freshData && freshData.length > 0) {
          setCategories(freshData.map(categoryMetaToConfig));
        }
      });
    } else {
      // No cache - must fetch from network
      const hasData = await hasInitialData();
      
      if (!hasData) {
        // First time launch - need to sync
        const success = await syncAllData();
        const freshCategories = await fetchCategories(false);
        
        if (freshCategories && freshCategories.length > 0) {
          setCategories(freshCategories.map(categoryMetaToConfig));
          setSyncing(false);
        } else {
          // Failed to get data on first launch
          setNoDataError(true);
          setSyncing(false);
        }
      } else {
        // Has data flag but no cache - try to sync
        await syncAllData();
        const freshCategories = await fetchCategories(false);
        if (freshCategories && freshCategories.length > 0) {
          setCategories(freshCategories.map(categoryMetaToConfig));
        }
        setSyncing(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setNoDataError(false);
    await syncAllData();
    const categoriesData = await fetchCategories(false);
    if (categoriesData && categoriesData.length > 0) {
      setCategories(categoriesData.map(categoryMetaToConfig));
    }
    setRefreshing(false);
  }, []);

  // Get quick access categories - most used first, then fill with others
  const quickAccessCategories = useMemo(() => {
    if (categories.length === 0) return [];
    
    const mostUsedKeys = getMostUsed(4);
    const result: CategoryConfig[] = [];
    
    // First add most used categories (in order of usage)
    mostUsedKeys.forEach(key => {
      const cat = categories.find(c => c.key === key);
      if (cat) result.push(cat);
    });
    
    // If we have less than 4, fill with other categories
    if (result.length < 4) {
      const usedKeys = new Set(result.map(c => c.key));
      for (const cat of categories) {
        if (!usedKeys.has(cat.key)) {
          result.push(cat);
          if (result.length >= 4) break;
        }
      }
    }
    
    return result.slice(0, 4);
  }, [categories, usageData, getMostUsed]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Filter categories and items based on search
  const getSearchResults = () => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    
    const results: { title: string; route: string; type: string }[] = [];
    
    // Search in category titles
    categories.forEach((cat: CategoryConfig) => {
      if (cat.title.toLowerCase().includes(query)) {
        results.push({ title: cat.title, route: `/akcja/szybki-pomocnik/${cat.key}`, type: 'Kategoria' });
      }
      // Search in tab titles
      cat.tabs.forEach((tab: { key: string; title: string }) => {
        if (tab.title.toLowerCase().includes(query)) {
          results.push({ title: `${cat.title} - ${tab.title}`, route: `/akcja/szybki-pomocnik/${cat.key}`, type: 'Karta' });
        }
      });
    });

    // Search in procedure titles
    const procedures = ['Acetylen', 'Samochody elektryczne', 'Fotowoltaika', 'Katastrofy budowlane', 'Promieniotwórczość', 'KPP'];
    procedures.forEach(proc => {
      if (proc.toLowerCase().includes(query)) {
        results.push({ title: proc, route: '/akcja?tab=procedury', type: 'Procedura' });
      }
    });

    // Search in biuro items
    const biuroItems = ['Testy wiedzy', 'Testy KPP', 'Pogadanki dzieci'];
    biuroItems.forEach(item => {
      if (item.toLowerCase().includes(query)) {
        results.push({ title: item, route: '/biuro', type: 'Biuro' });
      }
    });

    return results;
  };

  const searchResults = getSearchResults();

  // Show error screen if first launch without internet
  if (noDataError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={80} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Brak połączenia z internetem
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Przy pierwszym uruchomieniu aplikacja wymaga połączenia z internetem, aby pobrać dane.
          </Text>
          <Text style={[styles.errorHint, { color: colors.textSecondary }]}>
            Połącz się z internetem i spróbuj ponownie.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={initialLoad}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <SearchBar onSearch={handleSearch} placeholder="Szukaj tytułów..." />
      
      {syncing && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.syncText}>Synchronizacja danych...</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {searchResults && searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            <Text style={[styles.searchResultsTitle, { color: colors.textSecondary }]}>
              Wyniki wyszukiwania ({searchResults.length})
            </Text>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.searchResultItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(result.route as any)}
              >
                <View style={styles.searchResultInfo}>
                  <Text style={[styles.searchResultType, { color: colors.primary }]}>{result.type}</Text>
                  <Text style={[styles.searchResultText, { color: colors.text }]}>{result.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ) : searchQuery ? (
          <View style={styles.noResults}>
            <Ionicons name="search" size={48} color={colors.textSecondary} />
            <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>Brak wyników</Text>
          </View>
        ) : (
          <>
            {/* Main Tiles */}
            <View style={styles.mainTiles}>
              <TouchableOpacity
                style={[styles.mainTile, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/akcja')}
                activeOpacity={0.8}
              >
                <View style={styles.mainTileIcon}>
                  <Ionicons name="flame" size={56} color="#FFFFFF" />
                </View>
                <Text style={styles.mainTileTitle}>AKCJA</Text>
                <Text style={styles.mainTileSubtitle}>Szybki pomocnik, procedury</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mainTile, { backgroundColor: '#1565C0' }]}
                onPress={() => router.push('/biuro')}
                activeOpacity={0.8}
              >
                <View style={styles.mainTileIcon}>
                  <Ionicons name="briefcase" size={56} color="#FFFFFF" />
                </View>
                <Text style={styles.mainTileTitle}>BIURO</Text>
                <Text style={styles.mainTileSubtitle}>Testy, pogadanki</Text>
              </TouchableOpacity>
            </View>

            {/* Hazard Zone Button */}
            <TouchableOpacity
              style={[styles.hazardZoneButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/strefa-zagrozenia' as any)}
            >
              <View style={[styles.hazardZoneIcon, { backgroundColor: '#FF6B35' }]}>
                <Ionicons name="warning" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.hazardZoneContent}>
                <Text style={[styles.hazardZoneTitle, { color: colors.text }]}>
                  Utwórz strefę zagrożenia
                </Text>
                <Text style={[styles.hazardZoneSubtitle, { color: colors.textSecondary }]}>
                  Wyznacz strefy na mapie
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Air Management Button */}
            <TouchableOpacity
              style={[styles.hazardZoneButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/zarzadzanie-powietrzem' as any)}
            >
              <View style={[styles.hazardZoneIcon, { backgroundColor: '#1E88E5' }]}>
                <Ionicons name="timer" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.hazardZoneContent}>
                <Text style={[styles.hazardZoneTitle, { color: colors.text }]}>
                  Zarządzanie powietrzem
                </Text>
                <Text style={[styles.hazardZoneSubtitle, { color: colors.textSecondary }]}>
                  Kontrola czasu pracy rot.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Quick Access */}
            <View style={styles.quickAccess}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Szybki dostęp</Text>
              <Text style={[styles.quickAccessHint, { color: colors.textSecondary }]}>
                Najczęściej używane kategorie
              </Text>
              <View style={styles.quickAccessGrid}>
                {quickAccessCategories.map((cat: CategoryConfig) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.quickAccessItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/akcja/szybki-pomocnik/${cat.key}` as any)}
                  >
                    <View style={[styles.quickAccessIcon, { backgroundColor: cat.color }]}>
                      <Ionicons name={cat.icon} size={20} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.quickAccessText, { color: colors.text }]} numberOfLines={1}>
                      {cat.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  syncBanner: {
    backgroundColor: '#C8102E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  mainTiles: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  mainTile: {
    flex: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  mainTileIcon: {
    marginBottom: 12,
  },
  mainTileTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  mainTileSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  quickAccess: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  quickAccessHint: {
    fontSize: 12,
    marginBottom: 12,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickAccessIcon: {
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
  },
  quickAccessText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  searchResults: {
    padding: 16,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  searchResultText: {
    fontSize: 15,
    fontWeight: '500',
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 16,
    marginTop: 12,
  },
  hazardZoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    marginHorizontal: 16,
    gap: 14,
  },
  hazardZoneIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hazardZoneContent: {
    flex: 1,
  },
  hazardZoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  hazardZoneSubtitle: {
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
