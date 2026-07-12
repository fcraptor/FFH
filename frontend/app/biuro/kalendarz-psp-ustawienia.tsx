import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { useTheme } from '../../src/contexts/ThemeContext';
import { useCalendarPsp } from '../../src/contexts/CalendarPspContext';
import { ColorPickerModal } from '../../src/components/calendar/ColorPickerModal';
import { DEFAULT_SHIFT_COLORS, ShiftNumber } from '../../src/types/calendarPsp';
import { MONTH_NAMES } from '../../src/utils/calendarPsp';

export default function KalendarzPspUstawieniaScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';

  const {
    shiftColors,
    setShiftColors,
    resetShiftColors,
    runAutofill,
    autofill,
    clearAllData,
    exportBackup,
    importBackup,
  } = useCalendarPsp();

  const [colorPicker, setColorPicker] = useState<null | ShiftNumber>(null);

  // Autouzupełnianie - miesiąc/rok
  const today = new Date();
  const [autofillShift, setAutofillShift] = useState<ShiftNumber>(
    (autofill?.shift as ShiftNumber) ?? 1,
  );
  const [autofillMonth, setAutofillMonth] = useState<number>(autofill?.startMonth ?? today.getMonth());
  const [autofillYear, setAutofillYear] = useState<number>(autofill?.startYear ?? today.getFullYear());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [autofillRunning, setAutofillRunning] = useState(false);

  const handleColorChange = async (shift: ShiftNumber, color: string) => {
    const next = { ...shiftColors };
    if (shift === 1) next.shift1 = color;
    if (shift === 2) next.shift2 = color;
    if (shift === 3) next.shift3 = color;
    await setShiftColors(next);
    setColorPicker(null);
  };

  const confirmRunAutofill = () => {
    Alert.alert(
      'Autouzupełnianie służb',
      `Wpiszę służbę w każdym dniu, w którym wypada ${autofillShift} zmiana, od ${MONTH_NAMES[autofillMonth]} ${autofillYear} przez następne 2 lata.\n\nUwaga: istniejące wpisy w tych dniach zostaną nadpisane.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Uruchom',
          style: 'destructive',
          onPress: async () => {
            setAutofillRunning(true);
            try {
              const cnt = await runAutofill({
                shift: autofillShift,
                startMonth: autofillMonth,
                startYear: autofillYear,
              });
              Alert.alert('Gotowe', `Zapisano ${cnt} dni służby (${autofillShift} zmiana).`);
            } catch (err) {
              console.error(err);
              Alert.alert('Błąd', 'Nie udało się uruchomić autouzupełniania.');
            } finally {
              setAutofillRunning(false);
            }
          },
        },
      ],
    );
  };

  const confirmClearAll = (includeColors: boolean) => {
    Alert.alert(
      includeColors ? 'Pełny reset kalendarza' : 'Wyczyść kalendarz',
      includeColors
        ? 'Usunę wszystkie zdarzenia, notatki, zdjęcia miesięcy oraz przywrócę domyślne kolory zmian. Operacja jest nieodwracalna.'
        : 'Usunę wszystkie zdarzenia, notatki i zdjęcia miesięcy. Kolory zmian zostaną zachowane. Operacja jest nieodwracalna.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyczyść',
          style: 'destructive',
          onPress: async () => {
            await clearAllData(includeColors);
            Alert.alert('Gotowe', 'Dane kalendarza zostały wyczyszczone.');
          },
        },
      ],
    );
  };

  const handleExportBackup = async () => {
    try {
      const backup = exportBackup();
      const json = JSON.stringify(backup, null, 2);
      const fileName = `kalendarz-psp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const path = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' as any });
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        try {
          await Sharing.shareAsync(path, {
            mimeType: 'application/json',
            dialogTitle: 'Kopia zapasowa kalendarza',
          });
        } catch (shareErr: any) {
          // Expo Go limitation
          if (shareErr?.message?.includes('local file') || shareErr?.message?.includes('rejected')) {
            Alert.alert(
              'Ograniczenie Expo Go',
              'Udostępnianie plików nie działa w trybie deweloperskim (Expo Go).\n\nTa funkcja zadziała poprawnie w zbudowanej aplikacji (EAS Build).',
              [{ text: 'Rozumiem' }],
            );
          } else {
            throw shareErr;
          }
        }
      } else {
        Alert.alert('Eksport', `Plik zapisany: ${path}`);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Eksport', 'Nie udało się wyeksportować kopii zapasowej.');
    }
  };

  const handleImportBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const uri = res.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(uri);
      const parsed = JSON.parse(raw);
      Alert.alert(
        'Import kopii zapasowej',
        'Czy nadpisać aktualne dane kalendarza danymi z pliku?',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Nadpisz',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(parsed);
                Alert.alert('Gotowe', 'Dane zostały zaimportowane.');
              } catch (err: any) {
                console.error(err);
                Alert.alert('Błąd', err?.message || 'Nie udało się zaimportować.');
              }
            },
          },
        ],
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Import', 'Nie udało się otworzyć pliku.');
    }
  };

  const handleResetColors = async () => {
    Alert.alert('Przywróć domyślne kolory', 'Przywrócę pastelowe kolory zmian (żółty/koral/niebieski).', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Przywróć',
        onPress: async () => {
          await resetShiftColors();
        },
      },
    ]);
  };

  const Section = ({ title, children }: any) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  const ShiftColorRow = ({ shift, label, color }: { shift: ShiftNumber; label: string; color: string }) => (
    <TouchableOpacity style={styles.row} onPress={() => setColorPicker(shift)}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ustawienia kalendarza</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Kolory zmian">
          <ShiftColorRow shift={1} label="1 zmiana" color={shiftColors.shift1} />
          <ShiftColorRow shift={2} label="2 zmiana" color={shiftColors.shift2} />
          <ShiftColorRow shift={3} label="3 zmiana" color={shiftColors.shift3} />
          <TouchableOpacity style={styles.row} onPress={handleResetColors}>
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Przywróć domyślne kolory</Text>
            <View />
          </TouchableOpacity>
        </Section>

        <Section title="Autouzupełnianie">
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Po autouzupełnianiu służb, wystarczy wprowadzić wolne służby i urlopy.
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Twoja zmiana</Text>
          <View style={styles.shiftPickerRow}>
            {[1, 2, 3].map((n) => {
              const isSel = autofillShift === n;
              const bg =
                n === 1 ? shiftColors.shift1 : n === 2 ? shiftColors.shift2 : shiftColors.shift3;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.shiftPickerBtn,
                    {
                      backgroundColor: bg,
                      borderColor: isSel ? '#1E88E5' : 'transparent',
                      borderWidth: isSel ? 3 : 0,
                    },
                  ]}
                  onPress={() => setAutofillShift(n as ShiftNumber)}
                >
                  <Text style={styles.shiftPickerLabel}>{n} zmiana</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Miesiąc i rok rozpoczęcia</Text>
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={[
                styles.pickerBtn,
                {
                  backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setMonthPickerOpen(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.pickerLabel, { color: colors.text }]}>
                {MONTH_NAMES[autofillMonth]}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pickerBtn,
                {
                  backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setYearPickerOpen(true)}
            >
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.pickerLabel, { color: colors.text }]}>{autofillYear}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#C8102E', opacity: autofillRunning ? 0.6 : 1 }]}
            onPress={confirmRunAutofill}
            disabled={autofillRunning}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnLabel}>Uruchom autouzupełnianie</Text>
          </TouchableOpacity>

          <Text style={[styles.helperSmall, { color: colors.textSecondary }]}>
            ⚠️ Istniejące wpisy w wybranych dniach zostaną nadpisane.
          </Text>
        </Section>

        <Section title="Kopia zapasowa">
          <TouchableOpacity style={styles.row} onPress={handleExportBackup}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Eksportuj kopię zapasową</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleImportBackup}>
            <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Importuj kopię zapasową</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Backup zawiera zdarzenia, notatki, zdjęcia miesięcy oraz ustawienia kolorów i autouzupełniania.
          </Text>
        </Section>

        <Section title="Czyszczenie danych">
          <TouchableOpacity style={styles.row} onPress={() => confirmClearAll(false)}>
            <Ionicons name="trash-outline" size={20} color="#E53935" />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Wyczyść kalendarz</Text>
            <View />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => confirmClearAll(true)}>
            <Ionicons name="warning-outline" size={20} color="#E53935" />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Pełny reset (z kolorami)</Text>
            <View />
          </TouchableOpacity>
        </Section>

        <Section title="Informacje">
          <View style={styles.infoBlock}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              • Pojedyncze kliknięcie dnia = podgląd informacji o dniu.{'\n'}
              • Przytrzymanie dnia = ustawia automatycznie zdarzenie „wolna służba".{'\n'}
              • Przycisk „+" otwiera dolny arkusz wyboru zdarzenia lub notatki.{'\n'}
              • Dla każdego miesiąca możesz dodać zdjęcie grafiku (ikona aparatu).{'\n'}
              • Jeden dzień ma tylko jedno główne zdarzenie. Nowe zdarzenie nadpisuje poprzednie.{'\n'}
              • Notatka jest dodatkiem do dnia – pokazuje się jako czerwona kropka w rogu kafla.{'\n'}
              • Cykl zmian PSP jest stały (24/48){'\n'}
              • Wszystkie dane zapisują się lokalnie na urządzeniu (offline).
            </Text>
          </View>
        </Section>
      </ScrollView>

      <ColorPickerModal
        visible={colorPicker !== null}
        isDark={isDark}
        title={`Kolor ${colorPicker ?? ''} zmiany`}
        currentColor={
          colorPicker === 1
            ? shiftColors.shift1
            : colorPicker === 2
              ? shiftColors.shift2
              : colorPicker === 3
                ? shiftColors.shift3
                : DEFAULT_SHIFT_COLORS.shift1
        }
        onClose={() => setColorPicker(null)}
        onSelect={(c) => {
          if (colorPicker) handleColorChange(colorPicker, c);
        }}
      />

      {/* Picker miesiąca */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={modalStyles.backdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable
            style={[modalStyles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[modalStyles.title, { color: colors.text }]}>Wybierz miesiąc</Text>
            <View style={modalStyles.grid}>
              {MONTH_NAMES.map((name, idx) => {
                const sel = idx === autofillMonth;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      modalStyles.cell,
                      {
                        backgroundColor: sel ? '#C8102E' : isDark ? '#2A2A2A' : '#F5F5F5',
                      },
                    ]}
                    onPress={() => {
                      setAutofillMonth(idx);
                      setMonthPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        modalStyles.cellLabel,
                        { color: sel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1A1A1A' },
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Picker roku */}
      <Modal visible={yearPickerOpen} transparent animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={modalStyles.backdrop} onPress={() => setYearPickerOpen(false)}>
          <Pressable
            style={[modalStyles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[modalStyles.title, { color: colors.text }]}>Wybierz rok</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {Array.from({ length: 21 }).map((_, i) => {
                const y = today.getFullYear() - 10 + i;
                const sel = y === autofillYear;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[
                      modalStyles.yearRow,
                      {
                        backgroundColor: sel ? '#C8102E' : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setAutofillYear(y);
                      setYearPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        modalStyles.yearText,
                        { color: sel ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    backgroundColor: '#C8102E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
  },
  headerBackBtn: { padding: 6 },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  scroll: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  sectionBody: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    paddingHorizontal: 12,
    paddingTop: 12,
    lineHeight: 18,
  },
  helperSmall: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  shiftPickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 8,
  },
  shiftPickerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  shiftPickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  input: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  pickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 8,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  pickerLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoBlock: {
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: 70,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cellLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  yearBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  yearLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
