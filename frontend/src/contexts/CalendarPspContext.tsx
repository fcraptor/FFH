import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AutofillConfig,
  CalendarBackup,
  DEFAULT_SHIFT_COLORS,
  EventType,
  ShiftColors,
  ShiftNumber,
} from '../types/calendarPsp';
import { addDays, dateKey, getShiftForDate } from '../utils/calendarPsp';

const EVENTS_KEY = 'firefighter_calendar_events';
const NOTES_KEY = 'firefighter_calendar_notes';
const PHOTOS_KEY = 'firefighter_calendar_photos';
const COLORS_KEY = 'firefighter_calendar_shift_colors';
const AUTOFILL_KEY = 'firefighter_calendar_autofill';

interface CalendarPspState {
  ready: boolean;
  events: Record<string, EventType>;
  notes: Record<string, string>;
  photos: Record<string, string>;
  shiftColors: ShiftColors;
  autofill: AutofillConfig | null;

  getEvent(date: Date): EventType | undefined;
  getNote(date: Date): string | undefined;

  setEvent(date: Date, type: EventType): Promise<void>;
  clearEvent(date: Date): Promise<void>;
  setNote(date: Date, text: string): Promise<void>;
  clearNote(date: Date): Promise<void>;

  setPhotoForMonth(year: number, month: number, base64: string): Promise<void>;
  removePhotoForMonth(year: number, month: number): Promise<void>;
  getPhotoForMonth(year: number, month: number): string | undefined;

  setShiftColors(colors: ShiftColors): Promise<void>;
  resetShiftColors(): Promise<void>;

  setAutofill(config: AutofillConfig | null): Promise<void>;
  /** Wykonuje autouzupełnianie służb w cyklu 3-dniowym od podanej daty. Nadpisuje istniejące zdarzenia. */
  runAutofill(config: AutofillConfig, range?: { start: Date; end: Date }): Promise<number>;

  clearAllData(includeColors: boolean): Promise<void>;

  exportBackup(): CalendarBackup;
  importBackup(backup: CalendarBackup): Promise<void>;
}

const CalendarPspContext = createContext<CalendarPspState | undefined>(undefined);

export const CalendarPspProvider = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [events, setEvents] = useState<Record<string, EventType>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [shiftColors, setShiftColorsState] = useState<ShiftColors>(DEFAULT_SHIFT_COLORS);
  const [autofill, setAutofillState] = useState<AutofillConfig | null>(null);

  // Refs do najnowszych wartości - używane w funkcjach z setX, aby uniknąć wyścigów
  const eventsRef = useRef(events);
  const notesRef = useRef(notes);
  const photosRef = useRef(photos);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    (async () => {
      try {
        const [rawEv, rawNotes, rawPhotos, rawColors, rawAuto] = await Promise.all([
          AsyncStorage.getItem(EVENTS_KEY),
          AsyncStorage.getItem(NOTES_KEY),
          AsyncStorage.getItem(PHOTOS_KEY),
          AsyncStorage.getItem(COLORS_KEY),
          AsyncStorage.getItem(AUTOFILL_KEY),
        ]);
        if (rawEv) setEvents(JSON.parse(rawEv));
        if (rawNotes) setNotes(JSON.parse(rawNotes));
        if (rawPhotos) setPhotos(JSON.parse(rawPhotos));
        if (rawColors) {
          const parsed = JSON.parse(rawColors);
          setShiftColorsState({ ...DEFAULT_SHIFT_COLORS, ...parsed });
        }
        if (rawAuto) setAutofillState(JSON.parse(rawAuto));
      } catch (err) {
        console.error('CalendarPsp: load error', err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persistEvents = useCallback(async (next: Record<string, EventType>) => {
    setEvents(next);
    eventsRef.current = next;
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('CalendarPsp: events save error', err);
    }
  }, []);

  const persistNotes = useCallback(async (next: Record<string, string>) => {
    setNotes(next);
    notesRef.current = next;
    try {
      await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('CalendarPsp: notes save error', err);
    }
  }, []);

  const persistPhotos = useCallback(async (next: Record<string, string>) => {
    setPhotos(next);
    photosRef.current = next;
    try {
      await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('CalendarPsp: photos save error', err);
    }
  }, []);

  const getEvent = useCallback((date: Date): EventType | undefined => {
    return eventsRef.current[dateKey(date)];
  }, []);

  const getNote = useCallback((date: Date): string | undefined => {
    return notesRef.current[dateKey(date)];
  }, []);

  const setEvent = useCallback(
    async (date: Date, type: EventType) => {
      const next = { ...eventsRef.current, [dateKey(date)]: type };
      await persistEvents(next);
    },
    [persistEvents],
  );

  const clearEvent = useCallback(
    async (date: Date) => {
      const next = { ...eventsRef.current };
      delete next[dateKey(date)];
      await persistEvents(next);
    },
    [persistEvents],
  );

  const setNote = useCallback(
    async (date: Date, text: string) => {
      const trimmed = text.trim();
      const next = { ...notesRef.current };
      if (trimmed) {
        next[dateKey(date)] = trimmed;
      } else {
        delete next[dateKey(date)];
      }
      await persistNotes(next);
    },
    [persistNotes],
  );

  const clearNote = useCallback(
    async (date: Date) => {
      const next = { ...notesRef.current };
      delete next[dateKey(date)];
      await persistNotes(next);
    },
    [persistNotes],
  );

  const monthKeyFor = (year: number, month: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}`;

  const setPhotoForMonth = useCallback(
    async (year: number, month: number, base64: string) => {
      const next = { ...photosRef.current, [monthKeyFor(year, month)]: base64 };
      await persistPhotos(next);
    },
    [persistPhotos],
  );

  const removePhotoForMonth = useCallback(
    async (year: number, month: number) => {
      const next = { ...photosRef.current };
      delete next[monthKeyFor(year, month)];
      await persistPhotos(next);
    },
    [persistPhotos],
  );

  const getPhotoForMonth = useCallback(
    (year: number, month: number) => {
      return photos[monthKeyFor(year, month)];
    },
    [photos],
  );

  const setShiftColors = useCallback(async (next: ShiftColors) => {
    setShiftColorsState(next);
    try {
      await AsyncStorage.setItem(COLORS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('CalendarPsp: colors save error', err);
    }
  }, []);

  const resetShiftColors = useCallback(async () => {
    setShiftColorsState(DEFAULT_SHIFT_COLORS);
    try {
      await AsyncStorage.setItem(COLORS_KEY, JSON.stringify(DEFAULT_SHIFT_COLORS));
    } catch (err) {
      console.error('CalendarPsp: colors reset error', err);
    }
  }, []);

  const setAutofill = useCallback(async (config: AutofillConfig | null) => {
    setAutofillState(config);
    try {
      if (config) {
        await AsyncStorage.setItem(AUTOFILL_KEY, JSON.stringify(config));
      } else {
        await AsyncStorage.removeItem(AUTOFILL_KEY);
      }
    } catch (err) {
      console.error('CalendarPsp: autofill save error', err);
    }
  }, []);

  /**
   * Wpisuje 'sluzba' dla dni, w których wypada wybrana zmiana (cykl 3-dniowy PSP),
   * w zakresie od pierwszego dnia wybranego miesiąca/roku do końca następnych 2 lat.
   * Nadpisuje istniejące zdarzenia w tych dniach.
   */
  const runAutofill = useCallback(
    async (config: AutofillConfig, range?: { start: Date; end: Date }) => {
      const startDefault = new Date(config.startYear, config.startMonth, 1);
      const endDefault = new Date(config.startYear + 2, config.startMonth, 0);
      const start = range?.start ?? startDefault;
      const end = range?.end ?? endDefault;

      const next: Record<string, EventType> = { ...eventsRef.current };
      let count = 0;

      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      while (cursor <= end) {
        const shift = getShiftForDate(cursor);
        if (shift === config.shift) {
          next[dateKey(cursor)] = 'sluzba';
          count += 1;
        }
        cursor = addDays(cursor, 1);
      }
      await persistEvents(next);
      await setAutofill(config);
      return count;
    },
    [persistEvents, setAutofill],
  );

  const clearAllData = useCallback(
    async (includeColors: boolean) => {
      await persistEvents({});
      await persistNotes({});
      await persistPhotos({});
      await setAutofill(null);
      if (includeColors) {
        await resetShiftColors();
      }
    },
    [persistEvents, persistNotes, persistPhotos, setAutofill, resetShiftColors],
  );

  const exportBackup = useCallback((): CalendarBackup => {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      events: { ...eventsRef.current },
      notes: { ...notesRef.current },
      photos: { ...photosRef.current },
      shiftColors,
      autofill,
    };
  }, [shiftColors, autofill]);

  const importBackup = useCallback(
    async (backup: CalendarBackup) => {
      if (!backup || backup.version !== 1) {
        throw new Error('Nieobsługiwana wersja kopii zapasowej.');
      }
      await persistEvents(backup.events || {});
      await persistNotes(backup.notes || {});
      await persistPhotos(backup.photos || {});
      if (backup.shiftColors) {
        await setShiftColors({ ...DEFAULT_SHIFT_COLORS, ...backup.shiftColors });
      }
      await setAutofill(backup.autofill ?? null);
    },
    [persistEvents, persistNotes, persistPhotos, setShiftColors, setAutofill],
  );

  const value: CalendarPspState = useMemo(
    () => ({
      ready,
      events,
      notes,
      photos,
      shiftColors,
      autofill,
      getEvent,
      getNote,
      setEvent,
      clearEvent,
      setNote,
      clearNote,
      setPhotoForMonth,
      removePhotoForMonth,
      getPhotoForMonth,
      setShiftColors,
      resetShiftColors,
      setAutofill,
      runAutofill,
      clearAllData,
      exportBackup,
      importBackup,
    }),
    [
      ready,
      events,
      notes,
      photos,
      shiftColors,
      autofill,
      getEvent,
      getNote,
      setEvent,
      clearEvent,
      setNote,
      clearNote,
      setPhotoForMonth,
      removePhotoForMonth,
      getPhotoForMonth,
      setShiftColors,
      resetShiftColors,
      setAutofill,
      runAutofill,
      clearAllData,
      exportBackup,
      importBackup,
    ],
  );

  return <CalendarPspContext.Provider value={value}>{children}</CalendarPspContext.Provider>;
};

export const useCalendarPsp = () => {
  const ctx = useContext(CalendarPspContext);
  if (!ctx) throw new Error('useCalendarPsp must be used within CalendarPspProvider');
  return ctx;
};

// Eksportujemy pomocniczo, aby można było użyć poza komponentami
export { ShiftNumber };
