import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';
import { syncAllData, clearCache, getLastSyncTime } from '../src/utils/dataService';

export default function UstawieniaScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadLastSync();
  }, []);

  const loadLastSync = async () => {
    const syncTime = await getLastSyncTime();
    setLastSync(syncTime);
  };

  const handleSync = async () => {
    setSyncing(true);
    const success = await syncAllData();
    setSyncing(false);
    if (success) {
      await loadLastSync();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
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
              <Text style={[styles.settingLabel, { color: colors.text }]}>Tryb nocny</Text>
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
                  {syncing ? 'Synchronizacja...' : 'Synchronizuj dane'}
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
        </View>

        {/* About Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>O aplikacji</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <View style={[styles.appIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="flame" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.aboutInfo}>
              <Text style={[styles.appName, { color: colors.text }]}>FireFighter Helper</Text>
              <Text style={[styles.appVersion, { color: colors.textSecondary }]}>Wersja 1.0.0</Text>
              <Text style={[styles.appDesc, { color: colors.textSecondary }]}>
                Podręcznik PSP/OSP dla strażaków
              </Text>
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
});
