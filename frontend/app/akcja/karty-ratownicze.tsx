import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../../src/contexts/ThemeContext';
import {
  buildChatGptPrompt,
  buildChatGptUrl,
  buildKartyRatowniczeUrl,
  buildRescueCodeUrl,
} from '../../src/utils/rescueCards';

type RescueSearchMode = 'model' | 'registration';

export default function KartyRatowniczeScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<RescueSearchMode>('model');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const placeholder = mode === 'model'
    ? 'Wpisz marke i model + rok jak znasz'
    : 'Wpisz numer rejestracyjny';

  const noteColor = useMemo(
    () => (colors.textSecondary === colors.text ? '#94A3B8' : colors.textSecondary),
    [colors.text, colors.textSecondary],
  );

  const validate = (): string | null => {
    const trimmed = query.trim();
    if (!trimmed) {
      const message = mode === 'model'
        ? 'Wpisz markę i model pojazdu.'
        : 'Wpisz numer rejestracyjny.';
      setError(message);
      return null;
    }

    setError('');
    return trimmed;
  };

  const openExternalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Błąd', 'Nie udało się otworzyć strony. Spróbuj ponownie.');
    }
  };

  const handleModeChange = (nextMode: RescueSearchMode) => {
    setMode(nextMode);
    setError('');
    setQuery('');
  };

  const handleChatGptSearch = async () => {
    const trimmed = validate();
    if (!trimmed) return;

    try {
      await Clipboard.setStringAsync(buildChatGptPrompt(trimmed));
    } catch {
      // Ignore clipboard error and continue to open ChatGPT.
    }

    await openExternalUrl(buildChatGptUrl(trimmed));
  };

  const handleRescueCodeSearch = async () => {
    const trimmed = validate();
    if (!trimmed) return;

    await openExternalUrl(buildRescueCodeUrl(trimmed));
  };

  const handleRegistrationSearch = async () => {
    const trimmed = validate();
    if (!trimmed) return;

    await openExternalUrl(buildKartyRatowniczeUrl(trimmed));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Pressable
              onPress={() => handleModeChange('model')}
              testID="rescue-mode-model"
              style={[
                styles.segmentButton,
                mode === 'model' && { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.segmentText, { color: mode === 'model' ? '#FFFFFF' : colors.textSecondary }]}>Model</Text>
            </Pressable>

            <Pressable
              onPress={() => handleModeChange('registration')}
              testID="rescue-mode-registration"
              style={[
                styles.segmentButton,
                mode === 'registration' && { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.segmentText, { color: mode === 'registration' ? '#FFFFFF' : colors.textSecondary }]}>Rejestracja</Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Dane pojazdu</Text>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                if (error) setError('');
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.error : colors.border,
                  color: colors.text,
                },
              ]}
              autoCapitalize={mode === 'registration' ? 'characters' : 'sentences'}
              autoCorrect={false}
              testID="rescue-cards-input"
            />

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            {mode === 'model' ? (
              <>
                <Pressable
                  onPress={handleChatGptSearch}
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  testID="search-chatgpt-button"
                >
                  <Text style={styles.primaryButtonText}>Szukaj w ChatGPT</Text>
                </Pressable>

                <Text style={[styles.noteText, { color: noteColor }]}> 
                  Po przekierowaniu do ChatGPT możesz też dodać zdjęcie pojazdu — AI często pomaga znaleźć kartę ratowniczą po fotografii.
                </Text>

                <Pressable
                  onPress={handleRescueCodeSearch}
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  testID="search-rescue-code-button"
                >
                  <Text style={styles.primaryButtonText}>Szukaj w Rescue Code</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleRegistrationSearch}
                style={[styles.registrationButton, { backgroundColor: colors.accent }]}
                testID="search-registration-button"
              >
                <Text style={styles.registrationButtonText}>Szukaj</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  segmentedControl: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  registrationButton: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  registrationButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
});