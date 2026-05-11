import { CalculatorConfigRecord, CalculatorFieldRecord } from '../types';

export interface SelectOption {
  label: string;
  value: string;
}

export const parseSelectOptions = (options: string): SelectOption[] => (
  options
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, value] = item.split(':');
      return {
        label: (label || value || '').trim(),
        value: (value || label || '').trim(),
      };
    })
    .filter((item) => item.label && item.value)
);

export const sortCalculatorFields = (fields: CalculatorFieldRecord[]): CalculatorFieldRecord[] => (
  [...fields].sort((left, right) => Number(left.field_order || 0) - Number(right.field_order || 0))
);

export const getFieldDefaultValue = (field: CalculatorFieldRecord): boolean | number | string => {
  const { default_value: defaultValue = '', field_type: fieldType = 'text' } = field;

  if (fieldType === 'switch') {
    return ['true', '1', 'yes', 'tak'].includes(defaultValue.trim().toLowerCase());
  }

  if (fieldType === 'slider') {
    const parsed = Number(defaultValue || field.min_value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return defaultValue;
};

export const getResultDecimals = (calculator: CalculatorConfigRecord): number => {
  const parsed = Number(calculator.result_decimals ?? 2);
  return Number.isFinite(parsed) ? parsed : 2;
};

export const getButtonLabel = (calculator: CalculatorConfigRecord): string => (
  calculator.button_label?.trim() || 'Oblicz'
);

export const shouldShowLiveResult = (calculator: CalculatorConfigRecord): boolean => (
  (calculator.show_result_live || '').trim().toLowerCase() === 'true'
);

const safeFormulaPattern = /^[0-9+\-*/().,_\n\r\t A-Za-z]+$/;
const validIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const evaluateFormulaExpression = (
  formulaExpression: string,
  fieldValues: Record<string, boolean | number | string>,
): number | null => {
  const formula = formulaExpression.trim();

  if (!formula || !safeFormulaPattern.test(formula)) {
    return null;
  }

  const variableEntries = Object.entries(fieldValues).filter(([key]) => validIdentifierPattern.test(key));
  const variableNames = variableEntries.map(([key]) => key);
  const variableValues = variableEntries.map(([, value]) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;

    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : normalized;
  });

  try {
    const compute = new Function(
      ...variableNames,
      `'use strict'; return (${formula});`,
    ) as (...args: (number | string)[]) => number;

    const result = compute(...variableValues);
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

export const validateCalculatorField = (
  field: CalculatorFieldRecord,
  value: boolean | number | string,
): string => {
  const required = (field.required || '').trim().toLowerCase() === 'true';
  const message = field.validation_message?.trim();
  const fallback = 'To pole jest wymagane.';

  if (required) {
    if (typeof value === 'boolean') {
      // false is valid for an explicit switch state.
    } else if (value === '' || value === null || value === undefined) {
      return message || fallback;
    }
  }

  if ((field.field_type === 'number' || field.field_type === 'slider') && value !== '') {
    const numericValue = Number(typeof value === 'string' ? value.replace(',', '.') : value);

    if (!Number.isFinite(numericValue)) {
      return message || 'Podaj poprawną liczbę.';
    }

    const min = Number(field.min_value);
    const max = Number(field.max_value);

    if (field.min_value && Number.isFinite(min) && numericValue < min) {
      return message || `Minimalna wartość to ${min}.`;
    }

    if (field.max_value && Number.isFinite(max) && numericValue > max) {
      return message || `Maksymalna wartość to ${max}.`;
    }
  }

  return '';
};