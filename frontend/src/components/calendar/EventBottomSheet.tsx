import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EVENT_COLORS,
  EVENT_LABELS,
  EVENT_ORDER,
  EventType,
} from '../../types/calendarPsp';
import { formatLongDate, formatWeekday } from '../../utils/calendarPsp';

interface Props {
  visible: boolean;
  date: Date | null;
  isDark: boolean;
  hasNote: boolean;
  hasEvent: boolean;
  onClose: () => void;
  onPickEvent: (event: EventType) => void;
  onAddNote: () => void;
  onDeleteEvent: () => void;
}

export function EventBottomSheet({
  visible,
  date,
  isDark,
  hasNote,
  hasEvent,
  onClose,
  onPickEvent,
  onAddNote,
  onDeleteEvent,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(400);
      opacity.setValue(0);
    }
  }, [visible, translateY, opacity]);

  const close = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY }],
            paddingBottom: 12 + insets.bottom,
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
          },
        ]}
      >
        <View style={styles.handle} />
        {date ? (
          <View style={styles.header}>
            <Text style={[styles.dateText, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              {formatLongDate(date)}
            </Text>
            <Text style={[styles.weekdayText, { color: isDark ? '#B0B0B0' : '#666666' }]}>
              {formatWeekday(date)}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonsGrid}>
          {EVENT_ORDER.map((ev) => (
            <TouchableOpacity
              key={ev}
              style={[styles.eventButton, { backgroundColor: EVENT_COLORS[ev] }]}
              onPress={() => {
                onPickEvent(ev);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.eventButtonLabel}>{EVENT_LABELS[ev]}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.eventButton,
              {
                backgroundColor: isDark ? '#3D3D3D' : '#ECEFF1',
              },
            ]}
            onPress={() => {
              onAddNote();
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={isDark ? '#FFFFFF' : '#1A1A1A'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.eventButtonLabel, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}
            >
              {hasNote ? 'Edytuj notatkę' : 'Notatka'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.eventButton,
              {
                backgroundColor: '#424242',
                opacity: hasEvent || hasNote ? 1 : 0.5,
              },
            ]}
            disabled={!hasEvent && !hasNote}
            onPress={() => {
              onDeleteEvent();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.eventButtonLabel}>Usuń</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayText: {
    fontSize: 13,
    marginTop: 2,
  },
  buttonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventButton: {
    minWidth: '48%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  eventButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
