import { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface RotaLabelModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: { organization: 'JRG' | 'OSP' | null; text: string }) => void;
  colors: {
    overlay: string;
    surface: string;
    text: string;
    secondary: string;
    border: string;
    input: string;
    accent: string;
    muted: string;
  };
}

export function RotaLabelModal({ visible, onClose, onSave, colors }: RotaLabelModalProps) {
  const [organization, setOrganization] = useState<'JRG' | 'OSP' | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setOrganization(null);
      setText('');
    }
  }, [visible]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Nazwa roty</Text>

          <View style={styles.row}>
            {(['JRG', 'OSP'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setOrganization(item)}
                style={({ pressed }) => [
                  styles.optionButton,
                  {
                    backgroundColor: organization === item ? colors.accent : colors.input,
                    borderColor: organization === item ? colors.accent : colors.border,
                    opacity: pressed ? 0.84 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: organization === item ? colors.muted : colors.text }]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            autoFocus
            onChangeText={setText}
            placeholder="Wpisz nazwę"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            value={text}
          />

          <View style={styles.row}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>Anuluj</Text>
            </Pressable>
            <Pressable onPress={() => onSave({ organization, text })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent, opacity: pressed ? 0.84 : 1 }]}>
              <Text style={[styles.primaryText, { color: colors.muted }]}>Zapisz</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
