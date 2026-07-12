// Typy domenowe modułu Kalendarz PSP

export type ShiftNumber = 1 | 2 | 3;

export type EventType =
  | 'sluzba'
  | 'wolna_sluzba'
  | 'urlop'
  | 'choroba'
  | 'dyzur'
  | 'delegacja';

export interface DayEventState {
  event?: EventType;
  note?: string;
}

export interface ShiftColors {
  shift1: string;
  shift2: string;
  shift3: string;
}

export interface AutofillConfig {
  shift: ShiftNumber;
  /** Miesiąc startu autouzupełniania (0-11). */
  startMonth: number;
  /** Rok startu autouzupełniania. */
  startYear: number;
}

export interface CalendarBackup {
  version: 1;
  exportedAt: string;
  events: Record<string, EventType>;
  notes: Record<string, string>;
  photos: Record<string, string>; // monthKey -> base64
  shiftColors: ShiftColors;
  autofill: AutofillConfig | null;
}

export const EVENT_LABELS: Record<EventType, string> = {
  sluzba: 'Służba',
  wolna_sluzba: 'Wolna służba',
  urlop: 'Urlop',
  choroba: 'Choroba',
  dyzur: 'Dyżur',
  delegacja: 'Delegacja',
};

export const EVENT_COLORS: Record<EventType, string> = {
  sluzba: '#E53935', // czerwony
  wolna_sluzba: '#66BB6A', // jasnozielony
  urlop: '#FFC107', // żółty
  choroba: '#1E88E5', // niebieski
  dyzur: '#9E9E9E', // szary
  delegacja: '#7B1FA2', // fioletowy
};

export const EVENT_ICONS: Record<EventType, string> = {
  sluzba: 'flame',
  wolna_sluzba: 'leaf',
  urlop: 'sunny',
  choroba: 'medkit',
  dyzur: 'time',
  delegacja: 'briefcase',
};

export const DEFAULT_SHIFT_COLORS: ShiftColors = {
  shift1: '#FFF9C4', // jaśniejszy pastelowy żółty
  shift2: '#FFCDD2', // jaśniejszy pastelowy koral
  shift3: '#BBDEFB', // jaśniejszy pastelowy niebieski
};

// Paleta dostępnych pastelowych kolorów dla zmian
export const SHIFT_COLOR_PALETTE: string[] = [
  '#FFE082', // pastelowy żółty
  '#FFCC80', // pastelowy pomarańczowy
  '#FFAB91', // pastelowy koral
  '#EF9A9A', // pastelowy róż / czerwony
  '#F48FB1', // pastelowy róż
  '#CE93D8', // pastelowy fiolet
  '#B39DDB', // pastelowy liliowy
  '#9FA8DA', // pastelowy indygo
  '#90CAF9', // pastelowy niebieski
  '#81D4FA', // pastelowy jasnoniebieski
  '#80DEEA', // pastelowy cyjan
  '#A5D6A7', // pastelowy zielony
  '#C5E1A5', // pastelowy limonkowy
  '#FFF59D', // pastelowy żółty 2
  '#BCAAA4', // pastelowy beż
  '#CFD8DC', // pastelowy szary
];

export const EVENT_ORDER: EventType[] = [
  'sluzba',
  'wolna_sluzba',
  'urlop',
  'choroba',
  'dyzur',
  'delegacja',
];
