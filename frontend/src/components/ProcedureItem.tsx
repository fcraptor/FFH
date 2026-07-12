import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../contexts/FavoritesContext';

interface ProcedureItemProps {
  id: string;
  title: string;
  pdfLink: string;
  icon?: string; // Optional icon from spreadsheet
  onPress: () => void;
}

export const ProcedureItem: React.FC<ProcedureItemProps> = ({
  id,
  title,
  pdfLink,
  icon,
  onPress,
}) => {
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(id);
  
  // Use icon from spreadsheet or default to document-text
  const iconName = (icon || 'document-text') as keyof typeof Ionicons.glyphMap;

  const handleFavorite = (e: any) => {
    e.stopPropagation();
    toggleFavorite({
      id,
      type: 'procedure',
      title,
      pdfLink,
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
        <Ionicons name={iconName} size={24} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleFavorite} style={styles.favoriteButton}>
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={22}
            color={isFav ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: {
    borderRadius: 10,
    padding: 10,
    marginRight: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
});
