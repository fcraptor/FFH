import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface PressureModalProps {
  visible: boolean;
  title: string;
  initialValue: number;
  options: number[];
  onClose: () => void;
  onSave: (value: number) => void;
  colors: {
    overlay: string;
    surface: string;
    text: string;
    secondary: string;
    border: string;
    input: string;
    accent: string;
    muted: string;
    tile: string;
  };
}

export function PressureModal({ visible, title, initialValue, options, onClose, onSave, colors }: PressureModalProps) {
  const [selectedValue, setSelectedValue] = useState<number>(initialValue);
  const [customValue, setCustomValue] = useState('');
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedValue(initialValue);
      const shouldUseCustom = !options.includes(initialValue);
      setCustomMode(shouldUseCustom);
      setCustomValue(shouldUseCustom ? String(initialValue) : '');
    }
  }, [initialValue, options, visible]);

  const handleSave = () => {
    const parsedValue = customMode ? Number(customValue.replace(',', '.')) : selectedValue;
    onSave(parsedValue);
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>Wybierz kafelek lub wpisz własną wartość.</Text>

          <View style={styles.grid}>
            <Pressable
              onPress={() => setCustomMode(true)}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.input,
                  borderColor: customMode ? colors.accent : colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              testID="pressure-option-custom"
            >
              <Text style={[styles.tileText, { color: colors.text }]}>wpisz</Text>
            </Pressable>

            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setCustomMode(false);
                  setSelectedValue(option);
                }}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: colors.input,
                    borderColor: !customMode && selectedValue === option ? colors.accent : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
                testID={`pressure-option-${option}`}
              >
                <Text style={[styles.tileText, { color: colors.text }]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {customMode ? (
            <TextInput
              autoFocus
              keyboardType="numeric"
              onChangeText={setCustomValue}
              placeholder="np. 240"
              placeholderTextColor={colors.secondary}
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              testID="pressure-custom-input"
              value={customValue}
            />
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.8 : 1, borderColor: colors.border }]} testID="pressure-modal-cancel">
              <Text style={[styles.secondaryText, { color: colors.text }]}>Anuluj</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.88 : 1, backgroundColor: colors.accent }]} testID="pressure-modal-save">
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
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    minHeight: 46,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: 14,
  },
  tileText: {
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
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
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
