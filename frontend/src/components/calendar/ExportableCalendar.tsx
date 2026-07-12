import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import {
  buildCalendarGrid,
  dateKey,
  getShiftForDate,
  isSameMonth,
  MONTH_NAMES,
  WEEKDAYS_SHORT,
  formatLongDate,
  parseDateKey,
} from '../../utils/calendarPsp';
import {
  EVENT_COLORS,
  EVENT_LABELS,
  EVENT_ORDER,
  EventType,
  ShiftColors,
} from '../../types/calendarPsp';

interface Props {
  year: number;
  month: number;
  events: Record<string, EventType>;
  notes: Record<string, string>;
  shiftColors: ShiftColors;
  photoBase64?: string;
}

/**
 * Komponent renderowany do JPG przez react-native-view-shot.
 * Zawiera: tytuł miesiąca, siatkę kalendarza, listę zdarzeń, legendę.
 */
export function ExportableCalendar({ year, month, events, notes, shiftColors, photoBase64 }: Props) {
  const cells = buildCalendarGrid(year, month);
  const ref = new Date(year, month, 1);

  // Lista zdarzeń tylko w bieżącym miesiącu
  const monthEvents = Object.entries(events)
    .map(([key, ev]) => ({ key, date: parseDateKey(key), event: ev }))
    .filter((x) => x.date && isSameMonth(x.date, ref))
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  const monthNotes = Object.entries(notes)
    .map(([key, text]) => ({ key, date: parseDateKey(key), text }))
    .filter((x) => x.date && isSameMonth(x.date, ref))
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  return (
    <View style={styles.root} collapsable={false}>
      <Text style={styles.title}>
        {MONTH_NAMES[month]} {year}
      </Text>
      <Text style={styles.subtitle}>Kalendarz PSP · FireFighter Helper</Text>

      <View style={styles.weekdays}>
        {WEEKDAYS_SHORT.map((d) => (
          <View key={d} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, w) => (
          <View key={`w-${w}`} style={styles.weekRow}>
            {cells.slice(w * 7, w * 7 + 7).map((d) => {
              const key = dateKey(d);
              const inMonth = isSameMonth(d, ref);
              const shift = getShiftForDate(d);
              const shiftBg =
                shift === 1
                  ? shiftColors.shift1
                  : shift === 2
                    ? shiftColors.shift2
                    : shiftColors.shift3;
              const tileBg = inMonth ? shiftBg : '#F0F0F0';
              const event = events[key];
              const note = notes[key];
              return (
                <View key={key} style={[styles.tile, { backgroundColor: tileBg }]}>
                  {note && inMonth ? <View style={styles.noteDot} /> : null}
                  {event && inMonth ? (
                    <View style={[styles.eventSquare, { backgroundColor: EVENT_COLORS[event] }]}>
                      <Text style={styles.dayNumOnEvent}>{d.getDate()}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.dayNum, { color: inMonth ? '#1A1A1A' : '#B5B5B5' }]}>
                      {d.getDate()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <View style={[styles.legendItem, { backgroundColor: shiftColors.shift1 }]}>
          <Text style={styles.legendLabel}>1 zmiana</Text>
        </View>
        <View style={[styles.legendItem, { backgroundColor: shiftColors.shift2 }]}>
          <Text style={styles.legendLabel}>2 zmiana</Text>
        </View>
        <View style={[styles.legendItem, { backgroundColor: shiftColors.shift3 }]}>
          <Text style={styles.legendLabel}>3 zmiana</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Zdarzenia w miesiącu</Text>
      {monthEvents.length === 0 && monthNotes.length === 0 ? (
        <Text style={styles.emptyText}>Brak wpisów</Text>
      ) : (
        <View>
          {monthEvents.map((e) => (
            <View key={`e-${e.key}`} style={styles.eventRow}>
              <View style={[styles.eventSwatch, { backgroundColor: EVENT_COLORS[e.event] }]} />
              <Text style={styles.eventDate}>{formatLongDate(e.date!)}</Text>
              <Text style={styles.eventLabel}>· {EVENT_LABELS[e.event]}</Text>
            </View>
          ))}
          {monthNotes.map((n) => (
            <View key={`n-${n.key}`} style={styles.eventRow}>
              <View style={[styles.eventSwatch, { backgroundColor: '#C8102E' }]} />
              <Text style={styles.eventDate}>{formatLongDate(n.date!)}</Text>
              <Text style={styles.eventLabel}>· Notatka: {n.text}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Legenda zdarzeń</Text>
      <View style={styles.legendGrid}>
        {EVENT_ORDER.map((ev) => (
          <View key={ev} style={styles.legendEventRow}>
            <View style={[styles.eventSwatch, { backgroundColor: EVENT_COLORS[ev] }]} />
            <Text style={styles.legendEventLabel}>{EVENT_LABELS[ev]}</Text>
          </View>
        ))}
      </View>

      {photoBase64 ? (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Załączony grafik miesiąca</Text>
          <Image
            source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
            style={styles.photo}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 360,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 10,
  },
  weekdays: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#666666',
  },
  grid: {},
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  noteDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8102E',
  },
  eventSquare: {
    width: '64%',
    height: '64%',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayNumOnEvent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  legendItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyText: {
    color: '#999999',
    fontSize: 13,
    fontStyle: 'italic',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  eventSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  eventDate: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  eventLabel: {
    fontSize: 13,
    color: '#666666',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '30%',
  },
  legendEventLabel: {
    fontSize: 13,
    color: '#1A1A1A',
  },
  photoSection: {
    marginTop: 16,
  },
  photo: {
    width: '100%',
    height: 360,
    borderRadius: 8,
  },
});
