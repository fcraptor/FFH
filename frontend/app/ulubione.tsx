import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';
import { useFavorites } from '../src/contexts/FavoritesContext';
import { FavoriteItem } from '../src/types';

export default function UlubioneScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { favorites, removeFavorite } = useFavorites();

  const handleItemPress = (item: FavoriteItem) => {
    switch (item.type) {
      case 'category':
        const categoryKey = item.id.replace('category-', '');
        router.push(`/akcja/szybki-pomocnik/${categoryKey}` as any);
        break;
      case 'card':
        if (item.category && item.cardKey) {
          // Navigate to the category that contains this card
          const catKey = item.id.split('-')[1];
          router.push(`/akcja/szybki-pomocnik/${catKey}` as any);
        }
        break;
      case 'procedure':
        if (item.pdfLink) {
          router.push({
            pathname: '/akcja/pdf-viewer',
            params: { url: item.pdfLink, title: item.title },
          } as any);
        }
        break;
      case 'biuro':
        if (item.pdfLink) {
          router.push({
            pathname: '/biuro/pdf-viewer',
            params: { url: item.pdfLink, title: item.title },
          } as any);
        }
        break;
      case 'biuro-baza-wiedzy':
      case 'biuro-kalendarz':
        if (item.route) {
          router.push(item.route as any);
        }
        break;
    }
  };

  const getItemIcon = (type: FavoriteItem['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'category':
        return 'grid';
      case 'card':
        return 'card';
      case 'procedure':
        return 'document-text';
      case 'biuro':
        return 'briefcase';
      case 'biuro-baza-wiedzy':
        return 'library';
      case 'biuro-kalendarz':
        return 'calendar';
      default:
        return 'star';
    }
  };

  const getTypeLabel = (type: FavoriteItem['type']): string => {
    switch (type) {
      case 'category':
        return 'Kategoria';
      case 'card':
        return 'Karta';
      case 'procedure':
        return 'Procedura';
      case 'biuro':
        return 'Biuro';
      case 'biuro-baza-wiedzy':
        return 'Baza Wiedzy';
      case 'biuro-kalendarz':
        return 'Kalendarz';
      default:
        return 'Element';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Ionicons name="star" size={28} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Ulubione</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Brak ulubionych</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Dodaj elementy do ulubionych klikając ikonę gwiazdy
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionInfo, { color: colors.textSecondary }]}>
              {favorites.length} elementów • Dostępne offline
            </Text>
            {favorites.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.favoriteItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name={getItemIcon(item.type)} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemType, { color: colors.primary }]}>{getTypeLabel(item.type)}</Text>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.category && (
                    <Text style={[styles.itemCategory, { color: colors.textSecondary }]}>
                      {item.category}
                    </Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    onPress={() => removeFavorite(item.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionInfo: {
    fontSize: 13,
    marginBottom: 16,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemIcon: {
    borderRadius: 10,
    padding: 10,
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemType: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
