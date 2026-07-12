// Logika dat, cyklu zmian PSP i helperów do kalendarza

import { ShiftNumber } from '../types/calendarPsp';

const MS_PER_DAY = 86_400_000;

/**
 * Punkt zaczepienia cyklu zmian:
 * 2 stycznia 2026 = 1 zmiana
 * 3 stycznia 2026 = 2 zmiana
 * 4 stycznia 2026 = 3 zmiana
 *
 * Dzięki temu w maju 2026 układ zmian jest dokładnie taki jak wymagany przez specyfikację:
 *   Zmiana III: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31
 *   Zmiana I:   2, 5, 8, 11, 14, 17, 20, 23, 26, 29
 *   Zmiana II:  3, 6, 9, 12, 15, 18, 21, 24, 27, 30
 */
const SHIFT_ANCHOR_Y = 2026;
const SHIFT_ANCHOR_M = 0; // styczeń
const SHIFT_ANCHOR_D = 2;

/** Zwraca numer zmiany (1/2/3) dla danej daty. */
export function getShiftForDate(date: Date): ShiftNumber {
  const anchor = Date.UTC(SHIFT_ANCHOR_Y, SHIFT_ANCHOR_M, SHIFT_ANCHOR_D);
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((day - anchor) / MS_PER_DAY);
  const mod = ((diff % 3) + 3) % 3;
  return ((mod + 1) as ShiftNumber);
}

/** Format YYYY-MM-DD dla dat lokalnych (bez konwersji TZ). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format YYYY-MM dla miesięcy. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

export const MONTH_NAMES_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

export const WEEKDAYS_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

export const WEEKDAYS_FULL = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

/** Zwraca kolejne 42 dni (6 tygodni × 7) zaczynających się od poniedziałku tygodnia, w którym jest 1. dzień miesiąca. */
export function buildCalendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // JS: 0=Ndz, 1=Pon...6=Sob; chcemy żeby tydzień zaczynał się od poniedziałku.
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = poniedziałek
  const start = new Date(year, month, 1 - firstWeekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatLongDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatWeekday(date: Date): string {
  const idx = (date.getDay() + 6) % 7;
  return WEEKDAYS_FULL[idx];
}

/** Dodaje dni do daty (zachowuje lokalną strefę). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Parsuje datę z formatu YYYY-MM-DD. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
