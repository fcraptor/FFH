import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { useTheme } from '../../src/contexts/ThemeContext';
import {
  buildKartyRatowniczeInjectionScript,
  buildKartyRatowniczeUrl,
  buildRescueCodeInjectionScript,
  buildRescueCodeUrl,
} from '../../src/utils/rescueCards';

type SearchTarget = 'rescue-code' | 'karty-ratownicze';

export default function RatowniczeWebViewScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ target?: SearchTarget; query?: string }>();
  const [showClipboardHint, setShowClipboardHint] = useState(false);

  const target = params.target === 'karty-ratownicze' ? 'karty-ratownicze' : 'rescue-code';
  const query = typeof params.query === 'string' ? params.query : '';

  const pageUrl = useMemo(
    () => target === 'karty-ratownicze' ? buildKartyRatowniczeUrl(query) : buildRescueCodeUrl(query),
    [query, target],
  );

  const injectedJavaScript = useMemo(
    () => target === 'karty-ratownicze'
      ? buildKartyRatowniczeInjectionScript(query)
      : buildRescueCodeInjectionScript(query),
    [query, target],
  );

  const openInBrowser = async () => {
    try {
      await Linking.openURL(pageUrl);
    } catch {
      // Keep screen open if browser cannot be launched.
    }
  };

  const title = target === 'karty-ratownicze' ? 'Karty ratownicze' : 'Rescue Code';

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'prefill-status' && payload.target === 'rescue-code') {
        setShowClipboardHint(payload.status !== 'success');
      }
    } catch {
      // Ignore unrelated messages.
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title }} />

      {Platform.OS === 'web' ? (
        <View style={styles.webFallback}>
          <Text style={[styles.fallbackTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}> 
            Otworzę stronę i przekażę tekst tam, gdzie jest to możliwe. Jeśli serwis nie przyjmie danych automatycznie, strona nadal się otworzy.
          </Text>
          {target === 'rescue-code' ? (
            <View style={[styles.hintBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>Skopiowano model do schowka. Jeśli pole nie uzupełni się automatycznie, wklej go ręcznie w wyszukiwarce.</Text>
            </View>
          ) : null}
          <Pressable testID="open-external-search-button" onPress={openInBrowser} style={[styles.openButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.openButtonText}>Otwórz stronę</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.container}>
          {showClipboardHint ? (
            <View style={[styles.hintBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>Nie udało się wkleić automatycznie. Skopiowano wartość do schowka — wklej ją ręcznie w polu wyszukiwania.</Text>
            </View>
          ) : null}
          <WebView
            source={{ uri: pageUrl }}
            injectedJavaScript={injectedJavaScript}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Ładowanie wyszukiwarki…</Text>
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  hintBox: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  openButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});