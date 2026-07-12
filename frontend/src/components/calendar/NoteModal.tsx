import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatLongDate } from '../../utils/calendarPsp';

interface Props {
  visible: boolean;
  date: Date | null;
  initialText: string;
  isDark: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
}

export function NoteModal({ visible, date, initialText, isDark, onClose, onSave, onDelete }: Props) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              {date ? formatLongDate(date) : ''}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Wpisz notatkę..."
            placeholderTextColor={isDark ? '#777777' : '#9E9E9E'}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                color: isDark ? '#FFFFFF' : '#1A1A1A',
              },
            ]}
            maxLength={500}
          />
          <View style={styles.actions}>
            {initialText ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#424242' }]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionLabel}>Usuń</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#C8102E', flex: 1 }]}
              onPress={() => onSave(text)}
            >
              <Ionicons name="save-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 480,
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
  input: {
    minHeight: 120,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
