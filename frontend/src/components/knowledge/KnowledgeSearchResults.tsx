// ============================================================
// KNOWLEDGE SEARCH RESULTS COMPONENT
// Displays search results with path and open functionality
// ============================================================

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KnowledgeIndexItem } from '../../types/knowledge';

interface KnowledgeSearchResultsProps {
  results: KnowledgeIndexItem[];
  onOpenItem: (item: KnowledgeIndexItem) => void;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    card: string;
    surface: string;
  };
}

interface SearchResultItemProps {
  item: KnowledgeIndexItem;
  onPress: () => void;
  colors: KnowledgeSearchResultsProps['colors'];
}

const getItemIcon = (item: KnowledgeIndexItem): keyof typeof Ionicons.glyphMap => {
  if (item.type === 'link') return 'link';
  
  const ext = item.extension?.toLowerCase();
  if (ext === 'pdf') return 'document-text';
  if (ext === 'pptx' || ext === 'ppt') return 'easel';
  if (ext === 'doc' || ext === 'docx') return 'document';
  if (ext === 'xls' || ext === 'xlsx') return 'grid';
  return 'document-outline';
};

const getItemIconColor = (item: KnowledgeIndexItem): string => {
  if (item.type === 'link') return '#2196F3';
  
  const ext = item.extension?.toLowerCase();
  if (ext === 'pdf') return '#E53935';
  if (ext === 'pptx' || ext === 'ppt') return '#FB8C00';
  if (ext === 'doc' || ext === 'docx') return '#1E88E5';
  if (ext === 'xls' || ext === 'xlsx') return '#43A047';
  return '#757575';
};

function SearchResultItem({ item, onPress, colors }: SearchResultItemProps) {
  const iconName = getItemIcon(item);
  const iconColor = getItemIconColor(item);

  return (
    <TouchableOpacity
      style={[styles.resultItem, { borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          
          {item.extension && item.type === 'file' && (
            <View style={[styles.badge, { backgroundColor: iconColor + '20' }]}>
              <Text style={[styles.badgeText, { color: iconColor }]}>
                {item.extension.toUpperCase()}
              </Text>
            </View>
          )}
          
          {item.type === 'link' && (
            <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
          )}
        </View>
        
        <Text style={[styles.path, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.path}
        </Text>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const MemoizedSearchResultItem = memo(SearchResultItem);

export function KnowledgeSearchResults({
  results,
  onOpenItem,
  colors,
}: KnowledgeSearchResultsProps) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Brak wyników wyszukiwania
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
          Spróbuj użyć innych słów kluczowych
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MemoizedSearchResultItem
          item={item}
          onPress={() => onOpenItem(item)}
          colors={colors}
        />
      )}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  path: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
  },
});
