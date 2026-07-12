// ============================================================
// CALCULATOR ENGINE - Extended with Universal Formula Support
// Maintains backward compatibility with existing calculators
// ============================================================

import { CalculatorConfigRecord, CalculatorFieldRecord, CalculatorResultRecord } from '../types';
import {
  CalculatorConfig,
  CalculatorField,
  CalculatorResult,
  CalculatorTable,
  CalculatorTableRow,
  CalculatorTableMatrix,
  ComputedResult,
  FieldSection,
  FieldValueWithMeta,
  FormulaContext,
  LookupContext,
  CalculatorDebugInfo,
} from '../types/calculator';
import {
  evaluateFormula,
  evaluateCondition,
  createFieldValuesWithMeta,
  createEmptyLookupContext,
} from './formulaEngine';

// ============================================================
// SELECT OPTIONS PARSING
// ============================================================

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
      const parts = item.split(':');
      const label = (parts[0] || '').trim();
      const value = (parts[1] || parts[0] || '').trim();
      return { label, value };
    })
    .filter((item) => item.label && item.value)
);

// ============================================================
// SORTING UTILITIES
// ============================================================

export const sortCalculatorFields = (fields: CalculatorFieldRecord[]): CalculatorFieldRecord[] => (
  [...fields].sort((a, b) => Number(a.field_order || 0) - Number(b.field_order || 0))
);

export const sortCalculatorResults = (results: CalculatorResultRecord[]): CalculatorResultRecord[] => (
  [...results].sort((a, b) => Number(a.result_order || 0) - Number(b.result_order || 0))
);

// ============================================================
// FIELD DEFAULT VALUES
// ============================================================

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

// ============================================================
// CALCULATOR CONFIG HELPERS
// ============================================================

export const getResultDecimals = (calculator: CalculatorConfigRecord): number => {
  const parsed = Number(calculator.result_decimals ?? 2);
  return Number.isFinite(parsed) ? parsed : 2;
};

export const getResultDecimalsFromResult = (result: CalculatorResultRecord | CalculatorResult): number => {
  const parsed = Number(result.result_decimals ?? 2);
  return Number.isFinite(parsed) ? parsed : 2;
};

export const getButtonLabel = (calculator: CalculatorConfigRecord | CalculatorConfig): string => (
  calculator.button_label?.trim() || 'Oblicz'
);

export const shouldShowLiveResult = (calculator: CalculatorConfigRecord | CalculatorConfig): boolean => (
  (calculator.show_result_live || '').trim().toLowerCase() === 'true'
);

export const isResultHighlighted = (result: CalculatorResultRecord | CalculatorResult): boolean => (
  (result.highlight || '').trim().toLowerCase() === 'true'
);

export const shouldShowDebug = (calculator: CalculatorConfig | null | undefined): boolean => {
  if (!calculator) return false;
  return (calculator.show_debug || '').trim().toLowerCase() === 'true';
};

export const getCalculatorLayout = (calculator: CalculatorConfig): 'standard' | 'compact' | 'inline' => {
  const layout = calculator.calculator_layout?.trim().toLowerCase();
  if (layout === 'compact' || layout === 'inline') return layout;
  return 'standard';
};

export const getColumnsMobile = (calculator: CalculatorConfig): number => {
  const cols = Number(calculator.columns_mobile || 1);
  return cols === 2 ? 2 : 1;
};

export const getColumnsDesktop = (calculator: CalculatorConfig): number => {
  const cols = Number(calculator.columns_desktop || 1);
  if (cols === 2 || cols === 3) return cols;
  return 1;
};

// ============================================================
// SECTION GROUPING
// ============================================================

export const groupFieldsBySection = (fields: CalculatorField[]): FieldSection[] => {
  const sectionMap = new Map<string, FieldSection>();
  const noSection: CalculatorField[] = [];
  
  for (const field of fields) {
    const sectionName = field.section_name?.trim();
    
    if (!sectionName) {
      noSection.push(field);
      continue;
    }
    
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, {
        name: sectionName,
        order: Number(field.section_order || 0),
        variant: (field.section_variant as FieldSection['variant']) || 'default',
        defaultOpen: field.section_default_open?.toLowerCase() !== 'false',
        fields: [],
      });
    }
    
    sectionMap.get(sectionName)!.fields.push(field);
  }
  
  // Sort sections by order
  const sections = Array.from(sectionMap.values())
    .sort((a, b) => a.order - b.order);
  
  // If there are fields without section, add them as first section
  if (noSection.length > 0) {
    sections.unshift({
      name: '',
      order: -1,
      variant: 'default',
      defaultOpen: true,
      fields: noSection,
    });
  }
  
  return sections;
};

// ============================================================
// FIELD VISIBILITY AND STATE
// ============================================================

export const isFieldVisible = (
  field: CalculatorField,
  context: FormulaContext
): boolean => {
  if (!field.visible_if?.trim()) return true;
  return evaluateCondition(field.visible_if, context);
};

export const isFieldEnabled = (
  field: CalculatorField,
  context: FormulaContext
): boolean => {
  if (!field.enabled_if?.trim()) return true;
  return evaluateCondition(field.enabled_if, context);
};

export const isFieldRequired = (
  field: CalculatorField,
  context: FormulaContext
): boolean => {
  // Check static required flag first
  if (field.required?.toLowerCase() === 'true') return true;
  
  // Check dynamic required_if
  if (!field.required_if?.trim()) return false;
  return evaluateCondition(field.required_if, context);
};

// ============================================================
// RESULT VISIBILITY
// ============================================================

export const isResultVisible = (
  result: CalculatorResult,
  context: FormulaContext
): boolean => {
  if (!result.visible_if?.trim()) return true;
  return evaluateCondition(result.visible_if, context);
};

// ============================================================
// VALIDATION
// ============================================================

export const validateCalculatorField = (
  field: CalculatorFieldRecord | CalculatorField,
  value: boolean | number | string,
  context?: FormulaContext
): { valid: boolean; message: string; severity: 'error' | 'warning' | 'info' } => {
  const extField = field as CalculatorField;
  const message = field.validation_message?.trim() || '';
  const severity = (extField.validation_severity as any) || 'error';
  
  // Check required
  const required = context 
    ? isFieldRequired(extField, context)
    : field.required?.toLowerCase() === 'true';
  
  if (required) {
    if (typeof value === 'boolean') {
      // Boolean is always valid (explicit choice)
    } else if (value === '' || value === null || value === undefined) {
      return { 
        valid: false, 
        message: message || 'To pole jest wymagane.', 
        severity 
      };
    }
  }
  
  // Check numeric constraints
  if ((field.field_type === 'number' || field.field_type === 'slider') && value !== '') {
    const numericValue = Number(typeof value === 'string' ? value.replace(',', '.') : value);

    if (!Number.isFinite(numericValue)) {
      return { 
        valid: false, 
        message: message || 'Podaj poprawną liczbę.', 
        severity 
      };
    }

    const min = Number(field.min_value);
    const max = Number(field.max_value);

    if (field.min_value && Number.isFinite(min) && numericValue < min) {
      return { 
        valid: false, 
        message: message || `Minimalna wartość to ${min}.`, 
        severity 
      };
    }

    if (field.max_value && Number.isFinite(max) && numericValue > max) {
      return { 
        valid: false, 
        message: message || `Maksymalna wartość to ${max}.`, 
        severity 
      };
    }
  }
  
  // Check custom validation expression
  if (extField.validation_expression?.trim() && context) {
    const isValid = evaluateCondition(extField.validation_expression, context);
    if (!isValid) {
      return { 
        valid: false, 
        message: message || 'Walidacja nie powiodła się.', 
        severity 
      };
    }
  }
  
  return { valid: true, message: '', severity: 'error' };
};

// ============================================================
// FORMULA EVALUATION (NEW - with full formula engine)
// ============================================================

export const evaluateFormulaExpression = (
  formulaExpression: string,
  fieldValues: Record<string, boolean | number | string>,
  lookups: LookupContext = createEmptyLookupContext(),
  fieldOptions: Record<string, SelectOption[]> = {},
  debug: boolean = false
): { value: number | string | null; error?: string } => {
  const formula = formulaExpression.trim();
  
  if (!formula) {
    return { value: null, error: 'Empty formula' };
  }
  
  // Create field values with metadata
  const fieldValuesWithMeta = createFieldValuesWithMeta(fieldValues, fieldOptions);
  
  // Create formula context
  const context: FormulaContext = {
    fieldValues: fieldValuesWithMeta,
    computedResults: {},
    lookups,
    debug,
  };
  
  const result = evaluateFormula(formula, context);
  
  if (result.error) {
    return { value: null, error: result.error };
  }
  
  // Convert result to number if possible
  if (typeof result.value === 'number') {
    return { value: Number.isFinite(result.value) ? result.value : null };
  }
  
  if (typeof result.value === 'string') {
    const parsed = Number(result.value);
    if (Number.isFinite(parsed)) {
      return { value: parsed };
    }
    return { value: result.value };
  }
  
  if (typeof result.value === 'boolean') {
    return { value: result.value ? 1 : 0 };
  }
  
  return { value: null };
};

// ============================================================
// MULTI-RESULT EVALUATION
// ============================================================

export const evaluateAllResults = (
  results: (CalculatorResultRecord | CalculatorResult)[],
  fieldValues: Record<string, boolean | number | string>,
  lookups: LookupContext = createEmptyLookupContext(),
  fieldOptions: Record<string, SelectOption[]> = {},
  debug: boolean = false
): ComputedResult[] => {
  const sortedResults = [...results].sort(
    (a, b) => Number(a.result_order || 0) - Number(b.result_order || 0)
  );
  
  const computedResults: ComputedResult[] = [];
  const fieldValuesWithMeta = createFieldValuesWithMeta(fieldValues, fieldOptions);
  const computedValues: Record<string, number | string> = {};
  
  for (const resultDef of sortedResults) {
    const expression = resultDef.result_expression?.trim();
    const extResult = resultDef as CalculatorResult;
    
    if (!expression) {
      computedResults.push({
        result: extResult,
        value: null,
        formattedValue: extResult.error_value_text || 'Błąd obliczenia',
        visible: true,
        error: 'Empty expression',
      });
      continue;
    }
    
    // Create context with previous results
    const context: FormulaContext = {
      fieldValues: fieldValuesWithMeta,
      computedResults: computedValues,
      lookups,
      debug,
    };
    
    // Check visibility
    const visible = isResultVisible(extResult, context);
    
    // Evaluate expression
    const evalResult = evaluateFormula(expression, context);
    const decimals = getResultDecimalsFromResult(resultDef);
    
    if (evalResult.error) {
      computedResults.push({
        result: extResult,
        value: null,
        formattedValue: extResult.error_value_text || 'Błąd obliczenia',
        visible,
        error: evalResult.error,
      });
      continue;
    }
    
    const value = evalResult.value;
    
    // Add to computed values for subsequent calculations
    if (resultDef.result_name) {
      if (typeof value === 'number') {
        computedValues[resultDef.result_name] = value;
      } else if (typeof value === 'string') {
        computedValues[resultDef.result_name] = value;
      }
    }
    
    // Format value
    let formattedValue: string;
    if (value === null || value === undefined) {
      formattedValue = extResult.empty_value_text || '—';
    } else if (typeof value === 'number') {
      formattedValue = Number.isFinite(value) ? value.toFixed(decimals) : '—';
    } else {
      formattedValue = String(value);
    }
    
    computedResults.push({
      result: extResult,
      value,
      formattedValue,
      visible,
    });
  }
  
  return computedResults;
};

// ============================================================
// DEBUG INFO GENERATION
// ============================================================

export const generateDebugInfo = (
  fields: CalculatorField[],
  fieldValues: Record<string, boolean | number | string>,
  results: ComputedResult[],
  validationResults: Record<string, { valid: boolean; message: string }>,
  fieldOptions: Record<string, SelectOption[]>
): CalculatorDebugInfo => {
  const fieldValuesWithMeta = createFieldValuesWithMeta(fieldValues, fieldOptions);
  
  return {
    fieldValues: fieldValuesWithMeta,
    evaluatedExpressions: results.map(r => ({
      expression: r.result.result_expression || '',
      result: r.value,
      error: r.error,
    })),
    lookupCalls: [], // Would need to track during evaluation
    validationResults: Object.entries(validationResults).map(([field, result]) => ({
      field,
      passed: result.valid,
      message: result.message,
    })),
  };
};

// ============================================================
// BACKWARD COMPATIBILITY - Legacy function signature
// ============================================================

// Keep the old function signature for backward compatibility
export const evaluateFormulaExpressionLegacy = (
  formulaExpression: string,
  fieldValues: Record<string, boolean | number | string>,
): number | null => {
  const result = evaluateFormulaExpression(formulaExpression, fieldValues);
  return typeof result.value === 'number' ? result.value : null;
};
