import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function PDFViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const { colors } = useTheme();
  const isLocalFile = Boolean(url?.startsWith('file://'));

  const openInBrowser = () => {
    if (url) {
      Linking.openURL(url);
    }
  };

  // Convert Google Drive link to preview URL
  const getPreviewUrl = (originalUrl: string) => {
    if (originalUrl.includes('drive.google.com')) {
      // Extract file ID and create preview URL
      const match = originalUrl.match(/id=([^&]+)/);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
    return originalUrl;
  };

  const previewUrl = url ? getPreviewUrl(url) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: title || 'Dokument' }} />
      
      {Platform.OS === 'web' || isLocalFile ? (
        <View style={styles.webFallback}>
          <Ionicons name="document-text" size={80} color={colors.primary} />
          <Text style={[styles.webFallbackTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.webFallbackText, { color: colors.textSecondary }]}>
            {isLocalFile
              ? 'Dokument został pobrany do trybu offline. Kliknij poniżej, aby go otworzyć.'
              : 'Aby otworzyć dokument PDF, kliknij przycisk poniżej'}
          </Text>
          <TouchableOpacity 
            style={[styles.openButton, { backgroundColor: colors.primary }]} 
            onPress={openInBrowser}
          >
            <Ionicons name="open-outline" size={24} color="#FFFFFF" />
            <Text style={styles.openButtonText}>{isLocalFile ? 'Otwórz pobrany PDF' : 'Otwórz PDF'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          source={{ uri: previewUrl }}
          style={styles.webview}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Ładowanie dokumentu...
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  webFallbackText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
