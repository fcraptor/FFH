import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MONTH_NAMES } from '../../utils/calendarPsp';

interface Props {
  visible: boolean;
  year: number;
  month: number;
  isDark: boolean;
  onClose: () => void;
  onSelect: (year: number, month: number) => void;
}

const YEAR_CHIP_WIDTH = 80; // szerokość chipa lat + margines (ok. 70 + 8)

export function MonthYearPicker({ visible, year, month, isDark, onClose, onSelect }: Props) {
  const [selectedYear, setSelectedYear] = useState(year);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  React.useEffect(() => {
    if (visible) setSelectedYear(year);
  }, [visible, year]);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y += 1) years.push(y);

  // Po otwarciu modala scroll do wybranego roku tak, żeby był centralnie
  useEffect(() => {
    if (!visible) return;
    const idx = years.findIndex((y) => y === selectedYear);
    if (idx < 0) return;
    const cardWidth = Math.min(width - 40, 420);
    const targetX = idx * YEAR_CHIP_WIDTH + YEAR_CHIP_WIDTH / 2 - cardWidth / 2;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, targetX), animated: false });
    }, 50);
  }, [visible, selectedYear, width, years]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              Wybierz miesiąc
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearsRow}
          >
            {years.map((y) => {
              const isSel = y === selectedYear;
              return (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.yearChip,
                    {
                      backgroundColor: isSel
                        ? '#C8102E'
                        : isDark
                          ? '#3D3D3D'
                          : '#F0F0F0',
                    },
                  ]}
                  onPress={() => setSelectedYear(y)}
                >
                  <Text
                    style={[
                      styles.yearText,
                      { color: isSel ? '#FFFFFF' : isDark ? '#E0E0E0' : '#1A1A1A' },
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.monthsGrid}>
            {MONTH_NAMES.map((name, idx) => {
              const isSel = idx === month && selectedYear === year;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.monthCell,
                    {
                      backgroundColor: isSel
                        ? '#C8102E'
                        : isDark
                          ? '#2A2A2A'
                          : '#F5F5F5',
                    },
                  ]}
                  onPress={() => {
                    onSelect(selectedYear, idx);
                  }}
                >
                  <Text
                    style={[
                      styles.monthText,
                      { color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1A1A1A' },
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
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  yearsRow: {
    paddingVertical: 6,
  },
  yearChip: {
    width: 72,
    marginRight: 8,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  monthCell: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
