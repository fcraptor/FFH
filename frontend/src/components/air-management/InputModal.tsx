import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface InputModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  value: string;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
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

export function InputModal({
  visible,
  title,
  subtitle,
  value,
  onChangeValue,
  onClose,
  onSave,
  keyboardType = 'default',
  placeholder,
  colors,
}: InputModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.secondary }]}>{subtitle}</Text> : null}

          <TextInput
            autoFocus
            keyboardType={keyboardType}
            onChangeText={onChangeValue}
            placeholder={placeholder}
            placeholderTextColor={colors.secondary}
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            testID="input-modal-field"
            value={value}
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.8 : 1, borderColor: colors.border }]} testID="input-modal-cancel">
              <Text style={[styles.secondaryText, { color: colors.text }]}>Anuluj</Text>
            </Pressable>
            <Pressable onPress={onSave} style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.88 : 1, backgroundColor: colors.accent }]} testID="input-modal-save">
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
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 4,
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
