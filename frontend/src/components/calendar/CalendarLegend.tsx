import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EVENT_COLORS, EVENT_LABELS, EVENT_ORDER } from '../../types/calendarPsp';

interface Props {
  isDark: boolean;
}

export function CalendarLegend({ isDark }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: isDark ? '#404040' : '#E0E0E0' },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
          Legenda kolorów
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={isDark ? '#B0B0B0' : '#666666'}
        />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          {EVENT_ORDER.map((ev) => (
            <View key={ev} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: EVENT_COLORS[ev] }]} />
              <Text style={[styles.label, { color: isDark ? '#E0E0E0' : '#1A1A1A' }]}>
                {EVENT_LABELS[ev]}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: '#C8102E', borderRadius: 6 }]} />
            <Text style={[styles.label, { color: isDark ? '#E0E0E0' : '#1A1A1A' }]}>
              Notatka (czerwona kropka w prawym górnym rogu)
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
  },
});
