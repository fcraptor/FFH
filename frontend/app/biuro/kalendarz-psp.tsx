import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { useTheme } from '../../src/contexts/ThemeContext';
import { useCalendarPsp } from '../../src/contexts/CalendarPspContext';
import { CalendarGrid } from '../../src/components/calendar/CalendarGrid';
import { EventBottomSheet } from '../../src/components/calendar/EventBottomSheet';
import { MonthYearPicker } from '../../src/components/calendar/MonthYearPicker';
import { CalendarLegend } from '../../src/components/calendar/CalendarLegend';
import { NoteModal } from '../../src/components/calendar/NoteModal';
import { MonthPhotoModal } from '../../src/components/calendar/MonthPhotoModal';
import { ExportableCalendar } from '../../src/components/calendar/ExportableCalendar';
import {
  dateKey,
  formatLongDate,
  formatWeekday,
  getShiftForDate,
  MONTH_NAMES,
  isSameDay,
  monthKey,
} from '../../src/utils/calendarPsp';
import {
  EVENT_COLORS,
  EVENT_LABELS,
  EventType,
} from '../../src/types/calendarPsp';

export default function KalendarzPspScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const {
    events,
    notes,
    shiftColors,
    setEvent,
    clearEvent,
    setNote,
    clearNote,
    photos,
    setPhotoForMonth,
    removePhotoForMonth,
  } = useCalendarPsp();

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Date | null>(today);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportRef = useRef<View>(null);

  const goPrev = useCallback(() => {
    let m = month - 1;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    setMonth(m);
    setYear(y);
  }, [month, year]);

  const goNext = useCallback(() => {
    let m = month + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }, [month, year]);

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(today);
  }, [today]);

  const onDayPress = useCallback((d: Date) => {
    setSelected(d);
  }, []);

  const onDayLongPress = useCallback(
    (d: Date) => {
      setSelected(d);
      setEvent(d, 'wolna_sluzba');
    },
    [setEvent],
  );

  const selectedKey = selected ? dateKey(selected) : null;
  const currentEvent: EventType | undefined = selectedKey ? events[selectedKey] : undefined;
  const currentNote = selectedKey ? notes[selectedKey] : undefined;
  const currentShift = selected ? getShiftForDate(selected) : 1;

  const handlePickEvent = useCallback(
    async (ev: EventType) => {
      if (!selected) return;
      await setEvent(selected, ev);
      setSheetVisible(false);
    },
    [selected, setEvent],
  );

  const handleAddNote = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setNoteVisible(true), 200);
  }, []);

  const handleDeleteEvent = useCallback(async () => {
    if (!selected) return;
    if (currentEvent) {
      await clearEvent(selected);
    }
    if (currentNote) {
      await clearNote(selected);
    }
    setSheetVisible(false);
  }, [selected, currentEvent, currentNote, clearEvent, clearNote]);

  const handleSaveNote = useCallback(
    async (text: string) => {
      if (!selected) return;
      await setNote(selected, text);
      setNoteVisible(false);
    },
    [selected, setNote],
  );

  const handleDeleteNote = useCallback(async () => {
    if (!selected) return;
    await clearNote(selected);
    setNoteVisible(false);
  }, [selected, clearNote]);

  const photoForMonth = photos[monthKey(year, month)];

  const handleExportJpg = useCallback(() => {
    // Otwieramy modalny preview – tam dopiero wykonujemy captureRef na widocznym widoku.
    setExportVisible(true);
  }, []);

  const performExportCapture = useCallback(async () => {
    try {
      setExporting(true);
      // Czekamy chwilę, aby modal się w pełni zrenderował przed snapshotem
      await new Promise((r) => setTimeout(r, 400));
      if (!exportRef.current) throw new Error('Brak referencji widoku eksportu');
      const uri = await captureRef(exportRef as any, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      const finalName = `kalendarz-psp-${year}-${String(month + 1).padStart(2, '0')}.jpg`;
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const dest = `${cacheDir}${finalName}`;
      try {
        await FileSystem.copyAsync({ from: uri, to: dest });
      } catch {}
      const fileToShare = dest;
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        try {
          await Sharing.shareAsync(fileToShare, {
            mimeType: 'image/jpeg',
            dialogTitle: `Kalendarz PSP · ${MONTH_NAMES[month]} ${year}`,
            UTI: 'public.jpeg',
          });
          setExportVisible(false);
        } catch (shareErr: any) {
          // Expo Go limitation - sharing nie działa w pełni
          if (shareErr?.message?.includes('local file') || shareErr?.message?.includes('rejected')) {
            Alert.alert(
              'Ograniczenie Expo Go',
              'Udostępnianie plików JPG nie działa w trybie deweloperskim (Expo Go).\n\nTa funkcja zadziała poprawnie w zbudowanej aplikacji (EAS Build).',
              [{ text: 'Rozumiem' }],
            );
          } else {
            throw shareErr;
          }
        }
      } else {
        Alert.alert('Eksport JPG', `Plik zapisany: ${fileToShare}`);
        setExportVisible(false);
      }
    } catch (err: any) {
      console.error('export jpg error', err);
      Alert.alert('Eksport JPG', `Nie udało się wygenerować pliku JPG.\n${err?.message || ''}`);
    } finally {
      setExporting(false);
    }
  }, [month, year]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Górny czerwony nagłówek */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerLogo}>
          <Ionicons name="flame" size={26} color="#FFFFFF" />
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Kalendarz PSP</Text>
          <View style={styles.shiftChipsRow}>
            <View style={[styles.shiftChip, { backgroundColor: shiftColors.shift1 }]}>
              <Text style={styles.shiftChipText}>1 zmiana</Text>
            </View>
            <View style={[styles.shiftChip, { backgroundColor: shiftColors.shift2 }]}>
              <Text style={styles.shiftChipText}>2 zmiana</Text>
            </View>
            <View style={[styles.shiftChip, { backgroundColor: shiftColors.shift3 }]}>
              <Text style={styles.shiftChipText}>3 zmiana</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/biuro/kalendarz-psp-ustawienia' as any)}
          style={styles.headerSettingsBtn}
          testID="calendar-settings-btn"
        >
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Pasek miesiąca: lewa połowa = prev/tytuł/next, prawa połowa = today/photo z dużymi polami */}
      <View style={[styles.monthBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.monthBarLeft}>
          <TouchableOpacity onPress={goPrev} style={styles.arrowBtnSm} testID="calendar-prev-month">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.monthTitleBtn}>
            <Text style={[styles.monthTitle, { color: colors.text }]} numberOfLines={1}>
              {MONTH_NAMES[month]} {year}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext} style={styles.arrowBtnSm} testID="calendar-next-month">
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthBarRight}>
          <TouchableOpacity
            onPress={goToday}
            style={[styles.iconBtnLg, { backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0' }]}
            testID="calendar-go-today"
          >
            <Ionicons name="calendar" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPhotoVisible(true)}
            style={[styles.iconBtnLg, { backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0' }]}
            testID="calendar-photo"
          >
            <Ionicons
              name={photoForMonth ? 'images' : 'camera-outline'}
              size={22}
              color={photoForMonth ? '#C8102E' : colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selected}
          events={events}
          notes={notes}
          shiftColors={shiftColors}
          isDark={isDark}
          onDayPress={onDayPress}
          onDayLongPress={onDayLongPress}
          onSwipeLeft={goNext}
          onSwipeRight={goPrev}
        />

        {/* Wiersz: zwijana Legenda + Czerwony przycisk + */}
        <View style={styles.legendAndPlusRow}>
          <CalendarLegend isDark={isDark} />
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => {
              if (!selected) {
                setSelected(today);
              }
              setSheetVisible(true);
            }}
            testID="calendar-add-event"
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Panel informacji o wybranym dniu */}
        {selected ? (
          <View style={[styles.dayPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.dayPanelHeader}>
              <Ionicons
                name={isSameDay(selected, today) ? 'today' : 'calendar-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.dayPanelDate, { color: colors.text }]}>
                {formatLongDate(selected)}
              </Text>
              <View style={[styles.shiftBadge, { backgroundColor:
                currentShift === 1 ? shiftColors.shift1 :
                currentShift === 2 ? shiftColors.shift2 :
                shiftColors.shift3 }]}>
                <Text style={styles.shiftBadgeText}>{currentShift} zmiana</Text>
              </View>
            </View>
            <Text style={[styles.dayPanelWeekday, { color: colors.textSecondary }]}>
              {formatWeekday(selected)}
            </Text>
            {currentEvent ? (
              <View style={styles.eventRow}>
                <View style={[styles.eventSwatch, { backgroundColor: EVENT_COLORS[currentEvent] }]} />
                <Text style={[styles.eventLabel, { color: colors.text }]}>
                  {EVENT_LABELS[currentEvent]}
                </Text>
              </View>
            ) : !currentNote ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Brak dodatkowych wpisów
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Osobna karta notatki */}
        {selected && currentNote ? (
          <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.noteCardHeader}>
              <View style={styles.noteCardDot} />
              <Text style={[styles.noteCardTitle, { color: colors.text }]}>Notatka</Text>
              <TouchableOpacity
                onPress={() => setNoteVisible(true)}
                style={styles.noteEditBtn}
                testID="calendar-edit-note"
              >
                <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.noteCardText, { color: colors.text }]}>{currentNote}</Text>
          </View>
        ) : null}

        {/* Ukryty placeholder do ekranu eksportu (nie używany do widoku) */}
      </ScrollView>

      {/* Floating Export JPG button */}
      <TouchableOpacity
        style={[styles.exportFab, { bottom: 16 }]}
        onPress={handleExportJpg}
        testID="calendar-export-jpg"
      >
        <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Pełnoekranowy Modal podglądu eksportu JPG */}
      <Modal visible={exportVisible} animationType="slide" onRequestClose={() => setExportVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.exportHeader}>
            <Text style={styles.exportHeaderTitle}>Podgląd eksportu · {MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={() => setExportVisible(false)} disabled={exporting}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: '#EEEEEE' }} contentContainerStyle={{ alignItems: 'center', padding: 12 }}>
            <View ref={exportRef as any} collapsable={false} style={styles.exportShot}>
              <ExportableCalendar
                year={year}
                month={month}
                events={events}
                notes={notes}
                shiftColors={shiftColors}
              />
            </View>
          </ScrollView>
          <View style={styles.exportActions}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#424242', opacity: exporting ? 0.5 : 1 }]}
              onPress={() => setExportVisible(false)}
              disabled={exporting}
            >
              <Text style={styles.exportBtnLabel}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#C8102E', flex: 1.5, opacity: exporting ? 0.5 : 1 }]}
              onPress={performExportCapture}
              disabled={exporting}
              testID="export-share-jpg"
            >
              <Ionicons name="share-social" size={18} color="#FFFFFF" />
              <Text style={styles.exportBtnLabel}>{exporting ? 'Generuję...' : 'Udostępnij JPG'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <EventBottomSheet
        visible={sheetVisible}
        date={selected}
        isDark={isDark}
        hasNote={!!currentNote}
        hasEvent={!!currentEvent}
        onClose={() => setSheetVisible(false)}
        onPickEvent={handlePickEvent}
        onAddNote={handleAddNote}
        onDeleteEvent={handleDeleteEvent}
      />

      <NoteModal
        visible={noteVisible}
        date={selected}
        initialText={currentNote || ''}
        isDark={isDark}
        onClose={() => setNoteVisible(false)}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />

      <MonthYearPicker
        visible={pickerVisible}
        year={year}
        month={month}
        isDark={isDark}
        onClose={() => setPickerVisible(false)}
        onSelect={(y, m) => {
          setYear(y);
          setMonth(m);
          setPickerVisible(false);
        }}
      />

      <MonthPhotoModal
        visible={photoVisible}
        isDark={isDark}
        monthLabel={`${MONTH_NAMES[month]} ${year}`}
        photoBase64={photoForMonth}
        onClose={() => setPhotoVisible(false)}
        onPickFromGallery={async (b64) => {
          await setPhotoForMonth(year, month, b64);
        }}
        onTakePhoto={async (b64) => {
          await setPhotoForMonth(year, month, b64);
        }}
        onRemove={async () => {
          await removePhotoForMonth(year, month);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#C8102E',
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBackBtn: {
    padding: 6,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    paddingLeft: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  shiftChipsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  shiftChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shiftChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSettingsBtn: {
    padding: 8,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtnSm: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  iconBtnLg: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  monthTitleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthBarRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  legendAndPlusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  plusBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#C8102E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dayPanel: {
    marginTop: 14,
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayPanelDate: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  dayPanelWeekday: {
    fontSize: 13,
    marginTop: 4,
  },
  eventRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  eventLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  noteCard: {
    marginTop: 10,
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8102E',
  },
  noteCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  noteEditBtn: {
    padding: 6,
  },
  noteCardText: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  exportShot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  exportHeader: {
    backgroundColor: '#C8102E',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exportHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  exportActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  exportBtnLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  exportFab: {
    position: 'absolute',
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
