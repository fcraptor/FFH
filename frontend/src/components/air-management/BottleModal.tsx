import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface BottleModalProps {
  visible: boolean;
  initialValue: number;
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

const BOTTLE_OPTIONS = [6.8, 6.0, 9.0];

export function BottleModal({ visible, initialValue, onClose, onSave, colors }: BottleModalProps) {
  const [selectedValue, setSelectedValue] = useState<number>(initialValue);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (visible) {
      const shouldUseCustom = !BOTTLE_OPTIONS.includes(initialValue);
      setSelectedValue(initialValue);
      setCustomMode(shouldUseCustom);
      setCustomValue(shouldUseCustom ? String(initialValue).replace('.', ',') : '');
    }
  }, [initialValue, visible]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Wybierz pojemność butli</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>Wybierz jedną z opcji lub wpisz własną wartość.</Text>

          <View style={styles.grid}>
            {BOTTLE_OPTIONS.map((option) => {
              const optionLabel = option.toFixed(1).replace('.', ',');
              const optionTestId = option.toFixed(1).replace('.', '-');

              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setCustomMode(false);
                    setSelectedValue(option);
                  }}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: colors.surface,
                      borderColor: !customMode && selectedValue === option ? colors.accent : colors.border,
                      opacity: pressed ? 0.84 : 1,
                    },
                  ]}
                  testID={`bottle-option-${optionTestId}`}
                >
                  <Text style={[styles.tileText, { color: colors.text }]}>{`Butla ${optionLabel}`}</Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setCustomMode(true)}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  borderColor: customMode ? colors.accent : colors.border,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
              testID="bottle-option-custom"
            >
              <Text style={[styles.tileText, { color: colors.text }]}>Wpisz</Text>
            </Pressable>
          </View>

          {customMode ? (
            <TextInput
              autoFocus
              keyboardType="numeric"
              onChangeText={setCustomValue}
              placeholder="np. 6,8"
              placeholderTextColor={colors.secondary}
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              testID="bottle-custom-input"
              value={customValue}
            />
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.8 : 1, borderColor: colors.border }]} testID="bottle-modal-cancel">
              <Text style={[styles.secondaryText, { color: colors.text }]}>Anuluj</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(customMode ? Number(customValue.replace(',', '.')) : selectedValue)}
              style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.88 : 1, backgroundColor: colors.accent }]}
              testID="bottle-modal-save"
            >
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
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 110,
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
