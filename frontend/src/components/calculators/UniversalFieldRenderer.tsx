// ============================================================
// UNIVERSAL FIELD RENDERER
// Supports all field types, compact mode, dropdown variants
// ============================================================

import React, { useState, useCallback } from 'react';
import { 
  Pressable, 
  StyleSheet, 
  Switch, 
  Text, 
  TextInput, 
  View,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

import { CalculatorField } from '../../types/calculator';
import { SelectOption } from '../../utils/calculatorEngine';
import { ValidationMessage } from './ValidationMessage';

interface UniversalFieldRendererProps {
  colors: {
    border: string;
    error: string;
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
    card?: string;
    background?: string;
  };
  field: CalculatorField;
  onChange: (fieldName: string, value: boolean | number | string) => void;
  validationMessage: string;
  value: boolean | number | string;
  disabled?: boolean;
  compact?: boolean;
  fieldOptions?: SelectOption[];
}

export function UniversalFieldRenderer({ 
  colors, 
  field, 
  onChange, 
  validationMessage, 
  value,
  disabled = false,
  compact = false,
  fieldOptions,
}: UniversalFieldRendererProps) {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  
  const options = fieldOptions || [];
  const numericValue = Number(typeof value === 'string' ? value.replace(',', '.') : value) || 0;
  const fieldVariant = field.field_variant || 'default';
  const isCompactDropdown = fieldVariant === 'compact-dropdown';
  const isSegmented = fieldVariant === 'segmented';
  const isChips = fieldVariant === 'chips';
  
  // Get selected option for selects
  const selectedOption = options.find(opt => opt.value === String(value));
  
  // Handle dropdown close after selection
  const handleSelectOption = useCallback((optionValue: string) => {
    onChange(field.field_name, optionValue);
    if (field.close_on_select?.toLowerCase() !== 'false') {
      setDropdownVisible(false);
    }
  }, [field.field_name, field.close_on_select, onChange]);

  // Wrapper style based on width setting
  const getWrapperStyle = () => {
    const baseStyle = [styles.wrapper];
    if (compact) baseStyle.push(styles.wrapperCompact);
    
    switch (field.style_width) {
      case 'half':
        baseStyle.push(styles.wrapperHalf);
        break;
      case 'third':
        baseStyle.push(styles.wrapperThird);
        break;
      case 'auto':
        baseStyle.push(styles.wrapperAuto);
        break;
      default:
        baseStyle.push(styles.wrapperFull);
    }
    
    return baseStyle;
  };

  return (
    <View style={getWrapperStyle()} testID={`calc-field-${field.field_name}`}>
      {/* Label */}
      {field.field_type !== 'hidden' && (
        <Text style={[
          styles.label, 
          { color: colors.text },
          compact && styles.labelCompact,
          disabled && styles.labelDisabled,
        ]}>
          {field.field_label}
          {field.required?.toLowerCase() === 'true' && (
            <Text style={{ color: colors.error }}> *</Text>
          )}
        </Text>
      )}

      {/* NUMBER INPUT */}
      {field.field_type === 'number' && (
        <View style={[
          styles.inputRow, 
          { 
            backgroundColor: colors.surface, 
            borderColor: validationMessage ? colors.error : colors.border,
            opacity: disabled ? 0.5 : 1,
          },
          compact && styles.inputRowCompact,
        ]}>
          {field.prefix_text && (
            <Text style={[styles.prefixText, { color: colors.textSecondary }]}>
              {field.prefix_text}
            </Text>
          )}
          <TextInput
            editable={!disabled}
            keyboardType="numeric"
            onChangeText={(next) => onChange(field.field_name, next)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text }, compact && styles.inputCompact]}
            testID={`calc-input-${field.field_name}`}
            value={String(value ?? '')}
          />
          {(field.suffix_text || field.unit) && (
            <Text style={[styles.unitInline, { color: colors.textSecondary }]}>
              {field.suffix_text || field.unit}
            </Text>
          )}
        </View>
      )}

      {/* TEXT INPUT */}
      {field.field_type === 'text' && (
        <TextInput
          editable={!disabled}
          onChangeText={(next) => onChange(field.field_name, next)}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.textInput, 
            { 
              backgroundColor: colors.surface, 
              borderColor: validationMessage ? colors.error : colors.border, 
              color: colors.text,
              opacity: disabled ? 0.5 : 1,
            },
            compact && styles.textInputCompact,
          ]}
          testID={`calc-input-${field.field_name}`}
          value={String(value ?? '')}
        />
      )}

      {/* TEXTAREA */}
      {field.field_type === 'textarea' && (
        <TextInput
          editable={!disabled}
          multiline
          numberOfLines={4}
          onChangeText={(next) => onChange(field.field_name, next)}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.textArea, 
            { 
              backgroundColor: colors.surface, 
              borderColor: validationMessage ? colors.error : colors.border, 
              color: colors.text,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          testID={`calc-input-${field.field_name}`}
          value={String(value ?? '')}
          textAlignVertical="top"
        />
      )}

      {/* SWITCH */}
      {field.field_type === 'switch' && (
        <View style={[
          styles.switchRow, 
          { 
            backgroundColor: colors.surface, 
            borderColor: validationMessage ? colors.error : colors.border,
            opacity: disabled ? 0.5 : 1,
          },
          compact && styles.switchRowCompact,
        ]}>
          <Text style={[styles.switchValue, { color: colors.text }]}>
            {value ? 'Tak' : 'Nie'}
          </Text>
          <Switch
            disabled={disabled}
            onValueChange={(next) => onChange(field.field_name, next)}
            testID={`calc-switch-${field.field_name}`}
            trackColor={{ false: colors.border, true: colors.primary }}
            value={Boolean(value)}
          />
        </View>
      )}

      {/* SLIDER */}
      {field.field_type === 'slider' && (
        <View style={[
          styles.sliderCard, 
          { 
            backgroundColor: colors.surface, 
            borderColor: validationMessage ? colors.error : colors.border,
            opacity: disabled ? 0.5 : 1,
          },
          compact && styles.sliderCardCompact,
        ]}>
          <View style={styles.sliderHeader}>
            <Text style={[styles.sliderValue, { color: colors.text }, compact && styles.sliderValueCompact]}>
              {numericValue}
            </Text>
            {field.unit && (
              <Text style={[styles.sliderUnit, { color: colors.textSecondary }]}>
                {field.unit}
              </Text>
            )}
          </View>
          <Slider
            disabled={disabled}
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
      )}

      {/* SELECT - COMPACT DROPDOWN */}
      {field.field_type === 'select' && isCompactDropdown && (
        <>
          <Pressable
            disabled={disabled}
            onPress={() => setDropdownVisible(true)}
            style={[
              styles.compactDropdownButton,
              {
                backgroundColor: colors.surface,
                borderColor: validationMessage ? colors.error : colors.border,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <Text 
              style={[
                styles.compactDropdownText, 
                { color: selectedOption ? colors.text : colors.textSecondary }
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label || field.placeholder || 'Wybierz...'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
          
          <Modal
            visible={dropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <Pressable 
              style={styles.modalOverlay}
              onPress={() => setDropdownVisible(false)}
            >
              <View style={[styles.dropdownModal, { backgroundColor: colors.card || colors.surface }]}>
                <View style={[styles.dropdownHeader, { borderColor: colors.border }]}>
                  <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                    {field.field_label}
                  </Text>
                  <Pressable onPress={() => setDropdownVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = item.value === String(value);
                    return (
                      <Pressable
                        onPress={() => handleSelectOption(item.value)}
                        style={[
                          styles.dropdownItem,
                          { borderColor: colors.border },
                          isSelected && { backgroundColor: colors.primary + '15' },
                        ]}
                      >
                        <Text style={[
                          styles.dropdownItemText, 
                          { color: isSelected ? colors.primary : colors.text }
                        ]}>
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  }}
                  style={styles.dropdownList}
                />
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      {/* SELECT - SEGMENTED */}
      {field.field_type === 'select' && isSegmented && (
        <View style={[styles.segmentedContainer, { borderColor: colors.border }]}>
          {options.map((option, index) => {
            const isSelected = String(value) === option.value;
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                onPress={() => onChange(field.field_name, option.value)}
                style={[
                  styles.segmentedButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: colors.border,
                    opacity: disabled ? 0.5 : 1,
                  },
                  index === 0 && styles.segmentedButtonFirst,
                  index === options.length - 1 && styles.segmentedButtonLast,
                ]}
              >
                <Text style={[
                  styles.segmentedText,
                  { color: isSelected ? '#FFFFFF' : colors.text },
                  compact && styles.segmentedTextCompact,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* SELECT - CHIPS */}
      {field.field_type === 'select' && isChips && (
        <View style={styles.chipsContainer}>
          {options.map((option) => {
            const isSelected = String(value) === option.value;
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                onPress={() => onChange(field.field_name, option.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: disabled ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  { color: isSelected ? '#FFFFFF' : colors.text },
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* SELECT - DEFAULT (Button List) */}
      {field.field_type === 'select' && !isCompactDropdown && !isSegmented && !isChips && (
        <View style={[styles.optionsColumn, compact && styles.optionsColumnCompact]}>
          {options.map((option) => {
            const isSelected = String(value) === option.value;
            return (
              <Pressable
                key={`${field.field_name}-${option.value}`}
                disabled={disabled}
                onPress={() => onChange(field.field_name, option.value)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: disabled ? 0.5 : 1,
                  },
                  compact && styles.optionButtonCompact,
                ]}
                testID={`calc-select-${field.field_name}-${option.value}`}
              >
                <Text style={[
                  styles.optionText, 
                  { color: isSelected ? '#FFFFFF' : colors.text },
                  compact && styles.optionTextCompact,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* RADIO */}
      {field.field_type === 'radio' && (
        <View style={styles.radioContainer}>
          {options.map((option) => {
            const isSelected = String(value) === option.value;
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                onPress={() => onChange(field.field_name, option.value)}
                style={[styles.radioRow, { opacity: disabled ? 0.5 : 1 }]}
              >
                <View style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? colors.primary : colors.border }
                ]}>
                  {isSelected && (
                    <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* HIDDEN - render nothing */}
      {field.field_type === 'hidden' && null}

      {/* Help Text */}
      {field.help_text && field.field_type !== 'hidden' && (
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          {field.help_text}
        </Text>
      )}
      
      {/* Validation Message */}
      <ValidationMessage color={colors.error} message={validationMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  wrapperCompact: {
    marginBottom: 8,
  },
  wrapperFull: {
    width: '100%',
  },
  wrapperHalf: {
    width: '48%',
  },
  wrapperThird: {
    width: '31%',
  },
  wrapperAuto: {
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  labelCompact: {
    fontSize: 13,
    marginBottom: 6,
  },
  labelDisabled: {
    opacity: 0.6,
  },
  inputRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputRowCompact: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputCompact: {
    fontSize: 15,
  },
  prefixText: {
    fontSize: 14,
    marginRight: 8,
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
  textInputCompact: {
    minHeight: 42,
    borderRadius: 10,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
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
  switchRowCompact: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
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
  sliderCardCompact: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  sliderValueCompact: {
    fontSize: 16,
  },
  sliderUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionsColumn: {
    gap: 8,
  },
  optionsColumnCompact: {
    gap: 6,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  optionButtonCompact: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionTextCompact: {
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
  },
  // Compact Dropdown
  compactDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  compactDropdownText: {
    fontSize: 15,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    width: '100%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  // Segmented
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentedButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
  },
  segmentedButtonFirst: {
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
  },
  segmentedButtonLast: {
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    borderRightWidth: 0,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentedTextCompact: {
    fontSize: 13,
  },
  // Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Radio
  radioContainer: {
    gap: 10,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    fontSize: 15,
  },
});
