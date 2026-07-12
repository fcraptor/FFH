import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { CalendarDayCell } from './CalendarDayCell';
import {
  buildCalendarGrid,
  dateKey,
  getShiftForDate,
  isSameDay,
  isSameMonth,
  WEEKDAYS_SHORT,
} from '../../utils/calendarPsp';
import { EventType, ShiftColors } from '../../types/calendarPsp';

interface Props {
  year: number;
  month: number;
  selectedDate: Date | null;
  events: Record<string, EventType>;
  notes: Record<string, string>;
  shiftColors: ShiftColors;
  isDark: boolean;
  onDayPress: (date: Date) => void;
  onDayLongPress: (date: Date) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function CalendarGrid({
  year,
  month,
  selectedDate,
  events,
  notes,
  shiftColors,
  isDark,
  onDayPress,
  onDayLongPress,
  onSwipeLeft,
  onSwipeRight,
}: Props) {
  const { width } = useWindowDimensions();
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const today = useMemo(() => new Date(), []);

  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-25, 25])
      .onEnd((e) => {
        const dx = e.translationX;
        const vx = e.velocityX;
        if (dx < -50 || vx < -500) {
          if (onSwipeLeft) runOnJS(onSwipeLeft)();
        } else if (dx > 50 || vx > 500) {
          if (onSwipeRight) runOnJS(onSwipeRight)();
        }
      });
  }, [onSwipeLeft, onSwipeRight]);

  // Wyciągamy referencyjny miesiąc do isSameMonth
  const ref = useMemo(() => new Date(year, month, 1), [year, month]);

  return (
    <View style={styles.container}>
      <View style={styles.weekdaysRow}>
        {WEEKDAYS_SHORT.map((d, i) => (
          <View key={d} style={styles.weekdayCell}>
            <Text
              style={[
                styles.weekdayText,
                {
                  color: isDark ? '#B0B0B0' : '#666666',
                },
                (i === 5 || i === 6) && { color: '#C8102E' },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, weekIdx) => (
            <View key={`w-${weekIdx}`} style={styles.weekRow}>
              {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((d) => {
                const key = dateKey(d);
                const shift = getShiftForDate(d);
                const shiftBg =
                  shift === 1
                    ? shiftColors.shift1
                    : shift === 2
                      ? shiftColors.shift2
                      : shiftColors.shift3;
                return (
                  <CalendarDayCell
                    key={key}
                    date={d}
                    isCurrentMonth={isSameMonth(d, ref)}
                    isToday={isSameDay(d, today)}
                    isSelected={selectedDate ? isSameDay(d, selectedDate) : false}
                    shift={shift}
                    shiftBackground={shiftBg}
                    event={events[key]}
                    hasNote={!!notes[key]}
                    isDark={isDark}
                    onPress={() => onDayPress(d)}
                    onLongPress={() => onDayLongPress(d)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: {
    width: '100%',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
});
