import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { WebView } from 'react-native-webview';

interface ContentCardProps {
  id: string;
  title: string;
  content: string; // URL to image
  category: string;
  cardKey: string;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  id,
  title,
  content,
  category,
  cardKey,
}) => {
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(id);

  const handleFavorite = () => {
    toggleFavorite({
      id,
      type: 'card',
      title,
      category,
      cardKey,
    });
  };

  const openInBrowser = () => {
    if (content && content.startsWith('http')) {
      Linking.openURL(content);
    }
  };

  const isUrl = content && content.startsWith('http');
  const { width } = Dimensions.get('window');

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity onPress={handleFavorite} style={styles.favoriteButton}>
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={24}
            color={isFav ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.contentContainer}>
        {isUrl ? (
          Platform.OS === 'web' ? (
            <TouchableOpacity onPress={openInBrowser} style={styles.linkButton}>
              <Ionicons name="open-outline" size={24} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.primary }]}>Otwórz materiał</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.webviewContainer, { width: width - 64 }]}>
              <WebView
                source={{ uri: content }}
                style={styles.webview}
                scalesPageToFit={true}
                javaScriptEnabled={true}
              />
            </View>
          )
        ) : (
          <Text style={[styles.content, { color: colors.textSecondary }]}>
            {content || 'Brak treści'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  favoriteButton: {
    padding: 4,
  },
  contentContainer: {
    minHeight: 200,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
  webviewContainer: {
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
