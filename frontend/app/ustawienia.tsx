import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../src/contexts/ThemeContext';
import { syncAllData, clearCache, getLastSyncTime, downloadAkcjaDataForOffline, fetchAboutApp } from '../src/utils/dataService';
import { AboutAppData } from '../src/types';

export default function UstawieniaScreen() {
  const { colors, theme, toggleTheme, isSystemThemeEnabled } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [downloadingOffline, setDownloadingOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [aboutData, setAboutData] = useState<AboutAppData | null>(null);

  useEffect(() => {
    loadLastSync();
    loadAboutData();
  }, []);

  const loadLastSync = async () => {
    const syncTime = await getLastSyncTime();
    setLastSync(syncTime);
  };

  const loadAboutData = async () => {
    const data = await fetchAboutApp();
    setAboutData(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    const success = await syncAllData();
    setSyncing(false);
    if (success) {
      await loadLastSync();
      await loadAboutData();
      Alert.alert('Sukces', 'Dane zostały zsynchronizowane.');
    } else {
      Alert.alert('Błąd', 'Nie udało się zsynchronizować danych.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Wyczyść cache',
      'Czy na pewno chcesz wyczyścić wszystkie zapisane dane? Będzie wymagana ponowna synchronizacja.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyczyść',
          style: 'destructive',
          onPress: async () => {
            await clearCache();
            setLastSync(null);
            Alert.alert('Gotowe', 'Cache został wyczyszczony.');
          },
        },
      ]
    );
  };

  const handleOfflineDownload = async () => {
    setDownloadingOffline(true);
    const result = await downloadAkcjaDataForOffline();
    setDownloadingOffline(false);

    if (result.success) {
      await loadLastSync();
      Alert.alert(
        'Gotowe',
        `Pobrano materiały Akcja do działania offline. Obrazy: ${result.imageCount}, PDF: ${result.pdfCount}.`
      );
    } else {
      Alert.alert('Błąd', 'Nie udało się pobrać materiałów offline. Sprawdź połączenie z internetem i spróbuj ponownie.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nigdy';
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Ionicons name="settings" size={28} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Ustawienia</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Wygląd</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={22} color={colors.text} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Tryb nocny</Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  {isSystemThemeEnabled
                    ? `Domyślnie zgodny z telefonem (${theme === 'dark' ? 'ciemny' : 'jasny'})`
                    : `Ręcznie ustawiony na ${theme === 'dark' ? 'ciemny' : 'jasny'}`}
                </Text>
              </View>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Data Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Dane</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleSync}
            disabled={syncing}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="sync" size={22} color={colors.text} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {syncing ? 'Synchronizacja...' : 'Synchronizuj dane teraz'}
                </Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  Ostatnia: {formatDate(lastSync)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.settingRow} onPress={handleClearCache}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash" size={22} color={colors.error} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.error }]}>Wyczyść cache</Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                  Usuń zapisane dane offline
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity testID="download-offline-button" style={styles.settingRow} onPress={handleOfflineDownload} disabled={downloadingOffline}>
            <View style={styles.settingInfo}>
              <Ionicons name="download" size={22} color={colors.text} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {downloadingOffline ? 'Pobieranie danych...' : 'Pobierz dane'}
                </Text>
                <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Pobiera dane do działania offline</Text>
              </View>
            </View>
            {downloadingOffline ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Notifications Section - tylko na Android */}
        {Platform.OS === 'android' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Powiadomienia</Text>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  Linking.openSettings();
                }}
              >
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications" size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>Ustawienia powiadomień</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                      Otwórz ustawienia systemowe aplikacji
                    </Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.notificationInfoRow}>
                <Ionicons name="warning" size={20} color="#FF9500" />
                <Text style={[styles.notificationInfoText, { color: colors.textSecondary }]}>
                  Aby powiadomienia o ciśnieniu powietrza działały przy wyłączonym ekranie:
                </Text>
              </View>
              
              <View style={styles.notificationSteps}>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  • Włącz powiadomienia z najwyższym priorytetem
                </Text>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  • Zezwól na wyświetlanie na ekranie blokady
                </Text>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  • Wyłącz oszczędzanie baterii dla tej aplikacji
                </Text>
              </View>

              <View style={[styles.brandNote, { backgroundColor: colors.background }]}>
                <Text style={[styles.brandNoteText, { color: colors.textSecondary }]}>
                  📱 Xiaomi/Huawei/Samsung: Dodatkowo dodaj aplikację do "Autostart" i wyłącz "Usypianie aplikacji w tle"
                </Text>
              </View>
            </View>
          </>
        )}

        {/* About Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>O aplikacji</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <View style={[styles.appIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="flame" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.aboutInfo}>
              <Text style={[styles.appName, { color: colors.text }]}>
                {aboutData?.tytul || 'FireFighter Helper'}
              </Text>
              <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
                Wersja {Constants.expoConfig?.version || '1.0.0'}
              </Text>
              <Text style={[styles.appDesc, { color: colors.textSecondary }]}>
                {aboutData?.opis || 'Podręcznik PSP/OSP dla strażaków'}
              </Text>
              {aboutData?.kontakt ? (
                <Text style={[styles.appContact, { color: colors.textSecondary }]}>
                  Kontakt: {aboutData.kontakt}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Dane są pobierane z Google Drive i przechowywane lokalnie dla dostępu offline.
          </Text>
        </View>
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingHint: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 52,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  appIcon: {
    borderRadius: 16,
    padding: 12,
  },
  aboutInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
  },
  appVersion: {
    fontSize: 13,
    marginTop: 2,
  },
  appDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  appContact: {
    fontSize: 12,
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  notificationInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  notificationInfoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  notificationSteps: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 30,
  },
  brandNote: {
    margin: 12,
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
  },
  brandNoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
