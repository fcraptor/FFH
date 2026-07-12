import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHIFT_COLOR_PALETTE } from '../../types/calendarPsp';

interface Props {
  visible: boolean;
  isDark: boolean;
  title: string;
  currentColor: string;
  onClose: () => void;
  onSelect: (color: string) => void;
}

export function ColorPickerModal({ visible, isDark, title, currentColor, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {SHIFT_COLOR_PALETTE.map((c) => {
              const sel = c.toLowerCase() === currentColor.toLowerCase();
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: c,
                      borderColor: sel ? '#1E88E5' : isDark ? '#404040' : '#E0E0E0',
                      borderWidth: sel ? 3 : 1,
                    },
                  ]}
                  onPress={() => onSelect(c)}
                >
                  {sel ? <Ionicons name="checkmark" size={20} color="#1A1A1A" /> : null}
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
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
