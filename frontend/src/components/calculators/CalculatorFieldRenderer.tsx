import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { CalculatorFieldRecord } from '../../types';
import { parseSelectOptions } from '../../utils/calculatorEngine';
import { ValidationMessage } from './ValidationMessage';

interface CalculatorFieldRendererProps {
  colors: {
    border: string;
    error: string;
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  field: CalculatorFieldRecord;
  onChange: (fieldName: string, value: boolean | number | string) => void;
  validationMessage: string;
  value: boolean | number | string;
}

export function CalculatorFieldRenderer({ colors, field, onChange, validationMessage, value }: CalculatorFieldRendererProps) {
  const options = parseSelectOptions(field.options || '');
  const numericValue = Number(typeof value === 'string' ? value.replace(',', '.') : value) || 0;

  return (
    <View style={styles.wrapper} testID={`calc-field-${field.field_name}`}>
      <Text style={[styles.label, { color: colors.text }]}>{field.field_label}</Text>

      {field.field_type === 'number' ? (
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: validationMessage ? colors.error : colors.border }]}>
          <TextInput
            keyboardType="numeric"
            onChangeText={(next) => onChange(field.field_name, next)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text }]}
            testID={`calc-input-${field.field_name}`}
            value={String(value ?? '')}
          />
          {field.unit ? <Text style={[styles.unitInline, { color: colors.textSecondary }]}>{field.unit}</Text> : null}
        </View>
      ) : null}

      {field.field_type === 'text' ? (
        <TextInput
          onChangeText={(next) => onChange(field.field_name, next)}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: validationMessage ? colors.error : colors.border, color: colors.text }]}
          testID={`calc-input-${field.field_name}`}
          value={String(value ?? '')}
        />
      ) : null}

      {field.field_type === 'switch' ? (
        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: validationMessage ? colors.error : colors.border }]}>
          <Text style={[styles.switchValue, { color: colors.text }]}>{value ? 'Tak' : 'Nie'}</Text>
          <Switch
            onValueChange={(next) => onChange(field.field_name, next)}
            testID={`calc-switch-${field.field_name}`}
            trackColor={{ false: colors.border, true: colors.primary }}
            value={Boolean(value)}
          />
        </View>
      ) : null}

      {field.field_type === 'slider' ? (
        <View style={[styles.sliderCard, { backgroundColor: colors.surface, borderColor: validationMessage ? colors.error : colors.border }]}>
          <View style={styles.sliderHeader}>
            <Text style={[styles.sliderValue, { color: colors.text }]}>{numericValue}</Text>
            {field.unit ? <Text style={[styles.sliderUnit, { color: colors.textSecondary }]}>{field.unit}</Text> : null}
          </View>
          <Slider
            maximumTrackTintColor={colors.border}
            maximumValue={Number(field.max_value || 100)}
            minimumTrackTintColor={colors.primary}
            minimumValue={Number(field.min_value || 0)}
            onValueChange={(next) => onChange(field.field_name, Number(next.toFixed(2)))}
            step={Number(field.step_value || 1)}
            testID={`calc-slider-${field.field_name}`}
            thumbTintColor={colors.primary}
            value={numericValue}
          />
        </View>
      ) : null}

      {field.field_type === 'select' ? (
        <View style={styles.optionsColumn}>
          {options.map((option) => {
            const isSelected = String(value) === option.value;
            return (
              <Pressable
                key={`${field.field_name}-${option.value}`}
                onPress={() => onChange(field.field_name, option.value)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                testID={`calc-select-${field.field_name}-${option.value}`}
              >
                <Text style={[styles.optionText, { color: isSelected ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {field.help_text ? <Text style={[styles.helpText, { color: colors.textSecondary }]}>{field.help_text}</Text> : null}
      <ValidationMessage color={colors.error} message={validationMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  unitInline: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  switchValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  sliderCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  sliderUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionsColumn: {
    gap: 8,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
  },
});