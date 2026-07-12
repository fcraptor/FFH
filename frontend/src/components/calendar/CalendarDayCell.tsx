import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { EVENT_COLORS, EventType, ShiftNumber } from '../../types/calendarPsp';

interface Props {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  shift: ShiftNumber;
  shiftBackground: string;
  event?: EventType;
  hasNote: boolean;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * Pojedyncza komórka kalendarza.
 *
 * Zasada (centralne KLUCZOWE wymaganie):
 *   - Duży kafel = kolor zmiany (pastelowy)
 *   - Mały, centralny, wyraźny kwadrat z kolorem zdarzenia (pokazywany TYLKO gdy event istnieje)
 *   - Numer dnia jest umieszczony NA tym małym kwadracie (gdy event), albo centralnie na dużym kaflu (gdy brak event)
 *   - Numer dnia nigdy nie jest pod, obok ani za małym kwadratem
 *   - Aktualny dzień: niebieska obwódka wokół całego kafla
 *   - Aktualnie wybrany dzień: biała obwódka wokół całego kafla
 *   - Notatka: mała czerwona kropka w prawym górnym rogu dużego kafla
 *   - Dni spoza miesiąca: jasnoszare tło
 */
function CalendarDayCellComponent({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  shiftBackground,
  event,
  hasNote,
  isDark,
  onPress,
  onLongPress,
}: Props) {
  const eventColor = event ? EVENT_COLORS[event] : undefined;

  // Tło dużego kafla
  const tileBg = isCurrentMonth
    ? shiftBackground
    : isDark
      ? '#2A2A2A'
      : '#F0F0F0';

  // Kolor numeru dnia
  let dayNumberColor: string;
  if (!isCurrentMonth) {
    dayNumberColor = isDark ? '#5C5C5C' : '#B5B5B5';
  } else if (event) {
    // numer siedzi na małym kolorowym kwadracie -> jasny tekst
    dayNumberColor = '#FFFFFF';
  } else {
    dayNumberColor = '#1A1A1A'; // ciemny na pastelowym tle
  }

  // Obramowanie kafla
  let borderColor = 'transparent';
  let borderWidth = 0;
  if (isToday) {
    borderColor = '#1E88E5'; // niebieska obwódka
    borderWidth = 3;
  } else if (isSelected) {
    borderColor = '#FFFFFF';
    borderWidth = 3;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: tileBg,
          borderColor,
          borderWidth,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      testID={`calendar-day-${date.toISOString().slice(0, 10)}`}
    >
      {/* Czerwona kropka notatki */}
      {hasNote && isCurrentMonth ? <View style={styles.noteDot} /> : null}

      {/* Centralny mały kwadrat zdarzenia + numer dnia na nim */}
      {event && isCurrentMonth && eventColor ? (
        <View style={[styles.eventSquare, { backgroundColor: eventColor }]}>
          <Text style={[styles.dayNumberOnEvent]}>{date.getDate()}</Text>
        </View>
      ) : (
        // Brak zdarzenia: numer dnia centralnie na dużym kaflu
        <Text style={[styles.dayNumber, { color: dayNumberColor }]}>{date.getDate()}</Text>
      )}

      {/* Selected ring na nie-aktualnym dniu (subtelne dla a11y) */}
      {isSelected && !isToday && isCurrentMonth ? <View style={styles.selectedShade} /> : null}
    </Pressable>
  );
}

export const CalendarDayCell = React.memo(CalendarDayCellComponent);

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  noteDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8102E',
    zIndex: 5,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventSquare: {
    width: '64%',
    height: '64%',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberOnEvent: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectedShade: {
    ...StyleSheet.absoluteFillObject,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 8,
  },
});
