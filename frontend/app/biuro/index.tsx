import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useFavorites } from '../../src/contexts/FavoritesContext';
import { fetchBiuro } from '../../src/utils/dataService';

// Color palette for dynamic tiles
const TILE_COLORS = [
  '#4CAF50', // Green
  '#E91E63', // Pink
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#795548', // Brown
  '#607D8B', // Blue Grey
];

interface BiuroItem {
  tytul: string;
  pod_tytul: string;
  pdf_link: string;
  ikona: string;
}

export default function BiuroScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [data, setData] = useState<Record<string, BiuroItem> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const fetchedData = await fetchBiuro();
    setData(fetchedData);
    setLoading(false);
  };

  const handleTilePress = (key: string, item: BiuroItem) => {
    if (item?.pdf_link) {
      router.push({
        pathname: '/biuro/pdf-viewer',
        params: { url: item.pdf_link, title: item.tytul || key },
      } as any);
    }
  };

  const handleFavorite = (key: string, item: BiuroItem) => {
    const itemId = `biuro-${key}`;
    toggleFavorite({
      id: itemId,
      type: 'biuro',
      title: item?.tytul || key,
      pdfLink: item?.pdf_link,
    });
  };

  const handleKalendarzFavorite = () => {
    const itemId = 'biuro-kalendarz-psp';
    toggleFavorite({
      id: itemId,
      type: 'biuro-kalendarz',
      title: 'Kalendarz PSP',
      route: '/biuro/kalendarz-psp',
    });
  };

  const isKalendarzFavorite = isFavorite('biuro-kalendarz-psp');

  const handleBazaWiedzyFavorite = () => {
    const itemId = 'biuro-baza-wiedzy';
    toggleFavorite({
      id: itemId,
      type: 'biuro-baza-wiedzy',
      title: 'Baza Wiedzy KG',
      route: '/biuro/baza-wiedzy',
    });
  };
  const isBazaWiedzyFavorite = isFavorite('biuro-baza-wiedzy');

  // Get color based on index
  const getColor = (index: number) => TILE_COLORS[index % TILE_COLORS.length];

  // Render tiles from data
  const renderTiles = () => {
    if (!data) return null;
    
    // Filter out internal keys like _subtitles
    const entries = Object.entries(data).filter(([key]) => !key.startsWith('_'));
    
    return entries.map(([key, item], index) => {
      const itemId = `biuro-${key}`;
      const isFav = isFavorite(itemId);
      const iconName = (item.ikona || 'document-text') as keyof typeof Ionicons.glyphMap;
      const tileColor = getColor(index);

      return (
        <TouchableOpacity
          key={key}
          style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => handleTilePress(key, item)}
          activeOpacity={0.8}
        >
          <View style={[styles.tileIcon, { backgroundColor: tileColor }]}>
            <Ionicons name={iconName} size={36} color="#FFFFFF" />
          </View>
          <Text style={[styles.tileTitle, { color: colors.text }]}>
            {item.tytul || key}
          </Text>
          {item.pod_tytul ? (
            <Text style={[styles.tileDescription, { color: colors.textSecondary }]}>
              {item.pod_tytul}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleFavorite(key, item);
            }}
          >
            <Ionicons
              name={isFav ? 'star' : 'star-outline'}
              size={24}
              color={isFav ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1565C0" />
          </View>
        ) : (
          <View style={styles.tilesContainer}>
            {/* Stały kafel: Kalendarz PSP (na górze listy) */}
            <TouchableOpacity
              style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/biuro/kalendarz-psp' as any)}
              activeOpacity={0.8}
              testID="biuro-kalendarz-psp-tile"
            >
              <View style={[styles.tileIcon, { backgroundColor: '#C8102E' }]}>
                <Ionicons name="calendar" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.tileTitle, { color: colors.text }]}>Kalendarz PSP</Text>
              <Text style={[styles.tileDescription, { color: colors.textSecondary }]}>
                Grafik służb, urlopy, dyżury i notatki
              </Text>
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleKalendarzFavorite();
                }}
              >
                <Ionicons
                  name={isKalendarzFavorite ? 'star' : 'star-outline'}
                  size={24}
                  color={isKalendarzFavorite ? colors.accent : colors.textSecondary}
                />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Stały kafel: Baza Wiedzy KG */}
            <TouchableOpacity
              style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/biuro/baza-wiedzy' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.tileIcon, { backgroundColor: '#1565C0' }]}>
                <Ionicons name="library" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.tileTitle, { color: colors.text }]}>Baza Wiedzy KG</Text>
              <Text style={[styles.tileDescription, { color: colors.textSecondary }]}>
                Materiały szkoleniowe KG PSP
              </Text>
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleBazaWiedzyFavorite();
                }}
                testID="biuro-baza-wiedzy-favorite-btn"
              >
                <Ionicons
                  name={isBazaWiedzyFavorite ? 'star' : 'star-outline'}
                  size={24}
                  color={isBazaWiedzyFavorite ? colors.accent : colors.textSecondary}
                />
              </TouchableOpacity>
            </TouchableOpacity>

            {data && Object.keys(data).filter(k => !k.startsWith('_')).length > 0 ? renderTiles() : null}

            {(!data || Object.keys(data).filter(k => !k.startsWith('_')).length === 0) ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Brak dostępnych materiałów PDF
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  tilesContainer: {
    gap: 16,
  },
  tile: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tileIcon: {
    borderRadius: 50,
    padding: 16,
    marginBottom: 12,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  tileDescription: {
    fontSize: 13,
    textAlign: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
