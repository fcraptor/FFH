// ============================================================
// UNIVERSAL CALCULATOR SYSTEM - TYPES
// ============================================================

// ============================================================
// CALCULATOR CONFIG (calculators sheet)
// ============================================================
export interface CalculatorConfig {
  calculator_id: string;
  calculator_name: string;
  calculator_description?: string;
  formula_expression?: string; // Legacy - for backward compatibility
  result_label?: string; // Legacy
  result_unit?: string; // Legacy
  result_decimals?: string; // Legacy
  button_label?: string;
  show_result_live?: string;
  status?: string;
  
  // New optional columns
  calculator_layout?: 'standard' | 'compact' | 'inline';
  columns_mobile?: '1' | '2';
  columns_desktop?: '1' | '2' | '3';
  theme_variant?: 'default' | 'compact' | 'dense' | 'minimal';
  allow_reset?: string;
  reset_label?: string;
  show_debug?: string;
  result_visibility_mode?: 'always' | 'after_submit' | 'when_valid';
}

// ============================================================
// CALCULATOR FIELD (calculator_fields sheet)
// ============================================================
export interface CalculatorField {
  field_id: string;
  calculator_id: string;
  field_order: string;
  field_name: string;
  field_label: string;
  field_type: 'number' | 'select' | 'text' | 'switch' | 'slider' | 'textarea' | 'radio' | 'checkbox_group' | 'hidden' | 'computed';
  unit?: string;
  placeholder?: string;
  default_value?: string;
  default_expression?: string;
  min_value?: string;
  max_value?: string;
  step_value?: string;
  required?: string;
  help_text?: string;
  validation_message?: string;
  options?: string;
  options_source?: string;
  status?: string;
  
  // New optional columns - field variants
  field_variant?: 'default' | 'compact-dropdown' | 'segmented' | 'chips' | 'button-select';
  dropdown_width?: 'auto' | 'full';
  close_on_select?: string;
  searchable?: string;
  clearable?: string;
  
  // Dynamic behavior
  visible_if?: string;
  enabled_if?: string;
  required_if?: string;
  validation_expression?: string;
  validation_severity?: 'error' | 'warning' | 'info';
  
  // Sections
  section_name?: string;
  section_order?: string;
  section_variant?: 'default' | 'accordion' | 'collapsible' | 'inline';
  section_default_open?: string;
  
  // Styling
  style_width?: 'full' | 'half' | 'third' | 'auto';
  prefix_text?: string;
  suffix_text?: string;
}

// ============================================================
// CALCULATOR RESULT (calculator_results sheet)
// ============================================================
export interface CalculatorResult {
  result_id: string;
  calculator_id: string;
  result_order: string;
  result_name: string;
  result_label: string;
  result_expression: string;
  result_unit?: string;
  result_decimals?: string;
  highlight?: string;
  status?: string;
  
  // New optional columns
  visible_if?: string;
  help_text?: string;
  result_variant?: 'default' | 'badge' | 'card' | 'inline' | 'metric';
  empty_value_text?: string;
  error_value_text?: string;
}

// ============================================================
// LOOKUP TABLES (calculator_tables sheet)
// ============================================================
export interface CalculatorTable {
  table_id: string;
  table_name: string;
  table_type: 'map' | 'matrix' | 'range_map';
  key_type?: 'string' | 'number';
  row_key_type?: 'string' | 'number';
  col_key_type?: 'string' | 'number';
  value_type?: 'string' | 'number' | 'boolean';
  status?: string;
  description?: string;
}

// ============================================================
// LOOKUP TABLE ROWS (calculator_table_rows sheet) - 1D lookups
// ============================================================
export interface CalculatorTableRow {
  row_id: string;
  table_id: string;
  row_order?: string;
  key?: string;
  min_key?: string;
  max_key?: string;
  value: string;
  label?: string;
  status?: string;
}

// ============================================================
// LOOKUP TABLE MATRIX (calculator_table_matrix sheet) - 2D lookups
// ============================================================
export interface CalculatorTableMatrix {
  matrix_id: string;
  table_id: string;
  row_key: string;
  col_key: string;
  value: string;
  status?: string;
}

// ============================================================
// RUNTIME TYPES
// ============================================================

// Field value with label support for selects
export interface FieldValueWithMeta {
  value: string | number | boolean;
  label?: string;
  raw?: string;
}

// Computed result
export interface ComputedResult {
  result: CalculatorResult;
  value: number | string | null;
  formattedValue: string;
  visible: boolean;
  error?: string;
}

// Section grouping
export interface FieldSection {
  name: string;
  order: number;
  variant: 'default' | 'accordion' | 'collapsible' | 'inline';
  defaultOpen: boolean;
  fields: CalculatorField[];
}

// Debug info
export interface CalculatorDebugInfo {
  fieldValues: Record<string, FieldValueWithMeta>;
  evaluatedExpressions: Array<{
    expression: string;
    result: string | number | null;
    error?: string;
  }>;
  lookupCalls: Array<{
    function: string;
    args: string[];
    result: string | number | null;
    error?: string;
  }>;
  validationResults: Array<{
    field: string;
    expression?: string;
    passed: boolean;
    message?: string;
  }>;
}

// Lookup context for formula evaluation
export interface LookupContext {
  tables: CalculatorTable[];
  tableRows: CalculatorTableRow[];
  tableMatrix: CalculatorTableMatrix[];
}

// Formula evaluation context
export interface FormulaContext {
  fieldValues: Record<string, FieldValueWithMeta>;
  computedResults: Record<string, number | string>;
  lookups: LookupContext;
  debug?: boolean;
}

// Formula evaluation result
export interface FormulaEvalResult {
  value: number | string | boolean | null;
  error?: string;
  debugInfo?: {
    expression: string;
    parsedTokens?: string[];
    lookupCalls?: Array<{ fn: string; args: string[]; result: any }>;
  };
}
