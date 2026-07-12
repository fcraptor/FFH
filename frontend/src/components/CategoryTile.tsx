import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../contexts/FavoritesContext';

interface CategoryTileProps {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  showFavorite?: boolean;
  size?: 'small' | 'large';
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  id,
  title,
  icon,
  color,
  onPress,
  showFavorite = true,
  size = 'small',
}) => {
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(id);

  const handleFavorite = (e: any) => {
    e.stopPropagation();
    toggleFavorite({
      id,
      type: 'category',
      title,
    });
  };

  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isLarge ? styles.largeContainer : styles.smallContainer,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon} size={isLarge ? 40 : 28} color="#FFFFFF" />
      </View>
      <Text
        style={[
          styles.title,
          isLarge ? styles.largeTitle : styles.smallTitle,
          { color: colors.text },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {showFavorite && (
        <TouchableOpacity style={styles.favoriteButton} onPress={handleFavorite}>
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={isLarge ? 24 : 18}
            color={isFav ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  smallContainer: {
    width: '30%',
    aspectRatio: 1,
    padding: 8,
    margin: 4,
  },
  largeContainer: {
    width: '45%',
    aspectRatio: 1,
    padding: 16,
    margin: 8,
  },
  iconContainer: {
    borderRadius: 50,
    padding: 12,
    marginBottom: 8,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  smallTitle: {
    fontSize: 11,
  },
  largeTitle: {
    fontSize: 16,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
});
