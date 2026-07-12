// ============================================================
// UNIVERSAL CALCULATOR SCREEN
// Supports sections, dynamic visibility, lookups, compact layout
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { 
  ActivityIndicator, 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CalculatorConfigRecord, CalculatorFieldRecord, CalculatorResultRecord } from '../../types';
import { 
  CalculatorConfig, 
  CalculatorField, 
  CalculatorResult,
  ComputedResult, 
  FieldSection,
  LookupContext,
  FormulaContext,
  FieldValueWithMeta,
} from '../../types/calculator';
import { 
  fetchCalculators, 
  fetchCalculatorFields, 
  fetchCalculatorResults,
  fetchCalculatorLookups,
} from '../../utils/dataService';
import {
  evaluateAllResults,
  evaluateFormulaExpression,
  getButtonLabel,
  getFieldDefaultValue,
  getResultDecimals,
  isResultHighlighted,
  shouldShowLiveResult,
  shouldShowDebug,
  getCalculatorLayout,
  sortCalculatorFields,
  sortCalculatorResults,
  validateCalculatorField,
  groupFieldsBySection,
  isFieldVisible,
  isFieldEnabled,
  parseSelectOptions,
  SelectOption,
} from '../../utils/calculatorEngine';
import { createFieldValuesWithMeta, createEmptyLookupContext } from '../../utils/formulaEngine';
import { UniversalFieldRenderer } from './UniversalFieldRenderer';
import { ResultCard } from './ResultCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface UniversalCalculatorScreenProps {
  calculatorId: string;
  colors: {
    border: string;
    card: string;
    error: string;
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
    background?: string;
  };
}

export function UniversalCalculatorScreen({ calculatorId, colors }: UniversalCalculatorScreenProps) {
  const [calculator, setCalculator] = useState<CalculatorConfig | null>(null);
  const [fields, setFields] = useState<CalculatorField[]>([]);
  const [results, setResults] = useState<CalculatorResult[]>([]);
  const [lookups, setLookups] = useState<LookupContext>(createEmptyLookupContext());
  const [fieldValues, setFieldValues] = useState<Record<string, boolean | number | string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [computedResults, setComputedResults] = useState<ComputedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // For backward compatibility - single result fallback
  const [resultText, setResultText] = useState<string>('—');

  // Build field options map for select fields
  const fieldOptions = useMemo(() => {
    const options: Record<string, SelectOption[]> = {};
    for (const field of fields) {
      if (field.options) {
        options[field.field_name] = parseSelectOptions(field.options);
      }
    }
    return options;
  }, [fields]);

  // Create formula context for dynamic visibility
  const formulaContext = useMemo((): FormulaContext => {
    const fieldValuesWithMeta = createFieldValuesWithMeta(fieldValues, fieldOptions);
    return {
      fieldValues: fieldValuesWithMeta,
      computedResults: {},
      lookups,
      debug: shouldShowDebug(calculator),
    };
  }, [fieldValues, fieldOptions, lookups, calculator]);

  // Group fields into sections
  const sections = useMemo(() => {
    return groupFieldsBySection(fields);
  }, [fields]);

  // Initialize expanded sections based on section_default_open
  useEffect(() => {
    const defaultExpanded = new Set<string>();
    for (const section of sections) {
      if (section.defaultOpen) {
        defaultExpanded.add(section.name);
      }
    }
    setExpandedSections(defaultExpanded);
  }, [sections]);

  // Load calculator data
  useEffect(() => {
    let mounted = true;

    const loadCalculatorData = async () => {
      setLoading(true);
      
      const [calculators, calculatorFields, calculatorResults, calculatorLookups] = await Promise.all([
        fetchCalculators(),
        fetchCalculatorFields(),
        fetchCalculatorResults(),
        fetchCalculatorLookups(),
      ]);

      if (!mounted) return;

      const nextCalculator = calculators.find((item) => item.calculator_id === calculatorId) as CalculatorConfig | undefined;
      const nextFields = sortCalculatorFields(
        calculatorFields.filter((item) => item.calculator_id === calculatorId)
      ) as CalculatorField[];
      const nextResults = sortCalculatorResults(
        calculatorResults.filter((item) => item.calculator_id === calculatorId)
      ) as CalculatorResult[];

      setCalculator(nextCalculator || null);
      setFields(nextFields);
      setResults(nextResults);
      setLookups(calculatorLookups);
      
      // Initialize field values with defaults
      const initialValues: Record<string, boolean | number | string> = {};
      for (const field of nextFields) {
        initialValues[field.field_name] = getFieldDefaultValue(field as CalculatorFieldRecord);
      }
      setFieldValues(initialValues);
      
      setValidationErrors({});
      setComputedResults([]);
      setResultText('—');
      setLoading(false);
    };

    loadCalculatorData();

    return () => {
      mounted = false;
    };
  }, [calculatorId]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionName: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  }, []);

  // Run calculation
  const runCalculation = useCallback(() => {
    if (!calculator) return false;

    // Validate visible and required fields
    const nextErrors: Record<string, string> = {};
    
    for (const field of fields) {
      // Skip hidden fields
      if (!isFieldVisible(field, formulaContext)) continue;
      
      const validation = validateCalculatorField(
        field, 
        fieldValues[field.field_name],
        formulaContext
      );
      
      if (!validation.valid && validation.severity === 'error') {
        nextErrors[field.field_name] = validation.message;
      }
    }

    setValidationErrors(nextErrors);
    
    if (Object.keys(nextErrors).length > 0) {
      setComputedResults([]);
      setResultText('Błąd obliczenia');
      return false;
    }

    // Check if we have results defined in calculator_results
    if (results.length > 0) {
      // New multi-result mode with lookups
      const computed = evaluateAllResults(
        results, 
        fieldValues, 
        lookups, 
        fieldOptions,
        shouldShowDebug(calculator)
      );
      setComputedResults(computed);
      return true;
    } else {
      // Backward compatibility: use formula_expression from calculator config
      const legacyCalc = calculator as CalculatorConfigRecord;
      const result = evaluateFormulaExpression(
        legacyCalc.formula_expression || '', 
        fieldValues,
        lookups,
        fieldOptions
      );
      
      if (result.value === null) {
        setResultText(result.error || 'Błąd obliczenia');
        return false;
      }
      
      const decimals = getResultDecimals(legacyCalc);
      setResultText(
        typeof result.value === 'number' 
          ? result.value.toFixed(decimals) 
          : String(result.value)
      );
      return true;
    }
  }, [calculator, fieldValues, fields, results, lookups, fieldOptions, formulaContext]);

  // Live calculation
  useEffect(() => {
    if (calculator && shouldShowLiveResult(calculator)) {
      runCalculation();
    }
  }, [calculator, fieldValues, runCalculation]);

  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: boolean | number | string) => {
    setFieldValues((current) => ({ ...current, [fieldName]: value }));
    setValidationErrors((current) => ({ ...current, [fieldName]: '' }));
  }, []);

  // Reset form
  const handleReset = useCallback(() => {
    const initialValues: Record<string, boolean | number | string> = {};
    for (const field of fields) {
      initialValues[field.field_name] = getFieldDefaultValue(field as CalculatorFieldRecord);
    }
    setFieldValues(initialValues);
    setValidationErrors({});
    setComputedResults([]);
    setResultText('—');
  }, [fields]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Not found state
  if (!calculator) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.card }]}>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          Nie znaleziono kalkulatora.
        </Text>
      </View>
    );
  }

  const layout = getCalculatorLayout(calculator);
  const hasMultipleResults = results.length > 0;
  const showResetButton = calculator.allow_reset?.toLowerCase() === 'true';
  const isCompact = layout === 'compact';

  // Render a section
  const renderSection = (section: FieldSection, index: number) => {
    const isExpanded = expandedSections.has(section.name);
    const isAccordion = section.variant === 'accordion' || section.variant === 'collapsible';
    const hasName = section.name.trim() !== '';
    
    // Filter visible fields in this section
    const visibleFields = section.fields.filter(field => 
      isFieldVisible(field, formulaContext)
    );
    
    if (visibleFields.length === 0) return null;

    return (
      <View key={section.name || `section-${index}`} style={styles.section}>
        {/* Section Header (if named and accordion) */}
        {hasName && isAccordion && (
          <Pressable
            onPress={() => toggleSection(section.name)}
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.name}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
        
        {/* Section Header (if named but not accordion) */}
        {hasName && !isAccordion && (
          <Text style={[styles.sectionTitleStatic, { color: colors.textSecondary }]}>
            {section.name}
          </Text>
        )}
        
        {/* Section Content */}
        {(!isAccordion || isExpanded) && (
          <View style={[
            styles.sectionContent,
            isCompact && styles.sectionContentCompact,
          ]}>
            {visibleFields.map((field) => (
              <UniversalFieldRenderer
                key={field.field_id}
                colors={colors}
                field={field}
                onChange={handleFieldChange}
                validationMessage={validationErrors[field.field_name] || ''}
                value={fieldValues[field.field_name]}
                disabled={!isFieldEnabled(field, formulaContext)}
                compact={isCompact}
                fieldOptions={fieldOptions[field.field_name]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View 
      style={[
        styles.card, 
        { backgroundColor: colors.card, borderColor: colors.border },
        isCompact && styles.cardCompact,
      ]} 
      testID={`calculator-screen-${calculatorId}`}
    >
      {/* Header */}
      <Text style={[styles.title, { color: colors.text }, isCompact && styles.titleCompact]}>
        {calculator.calculator_name}
      </Text>
      
      {calculator.calculator_description && !isCompact ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {calculator.calculator_description}
        </Text>
      ) : null}

      {/* Sections with fields */}
      {sections.map((section, index) => renderSection(section, index))}

      {/* Action Buttons */}
      <View style={[styles.buttonRow, isCompact && styles.buttonRowCompact]}>
        {!shouldShowLiveResult(calculator) ? (
          <Pressable
            onPress={runCalculation}
            style={[
              styles.calculateButton, 
              { backgroundColor: colors.primary },
              isCompact && styles.calculateButtonCompact,
            ]}
            testID="calc-run-button"
          >
            <Text style={[styles.calculateButtonText, isCompact && styles.calculateButtonTextCompact]}>
              {getButtonLabel(calculator)}
            </Text>
          </Pressable>
        ) : null}
        
        {showResetButton && (
          <Pressable
            onPress={handleReset}
            style={[
              styles.resetButton, 
              { borderColor: colors.border },
              isCompact && styles.resetButtonCompact,
            ]}
            testID="calc-reset-button"
          >
            <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>
              {calculator.reset_label || 'Reset'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Results Section */}
      {hasMultipleResults ? (
        <View style={[styles.resultsSection, isCompact && styles.resultsSectionCompact]}>
          {computedResults
            .filter(cr => cr.visible)
            .map((computedResult, index) => (
              <ResultCard
                key={computedResult.result.result_id || index}
                backgroundColor={isResultHighlighted(computedResult.result) ? colors.primary + '15' : colors.surface}
                borderColor={isResultHighlighted(computedResult.result) ? colors.primary : colors.border}
                label={computedResult.result.result_label?.trim() || computedResult.result.result_name || 'Wynik'}
                result={computedResult.formattedValue}
                secondaryColor={colors.textSecondary}
                textColor={colors.text}
                unit={computedResult.result.result_unit?.trim() || ''}
                highlighted={isResultHighlighted(computedResult.result)}
                compact={isCompact}
                helpText={computedResult.result.help_text}
              />
            ))}
          {computedResults.filter(cr => cr.visible).length === 0 && !shouldShowLiveResult(calculator) && (
            <View style={[styles.placeholderResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                Kliknij "{getButtonLabel(calculator)}" aby obliczyć
              </Text>
            </View>
          )}
        </View>
      ) : (
        // Single result (backward compatibility)
        <ResultCard
          backgroundColor={colors.surface}
          borderColor={colors.border}
          label={(calculator as CalculatorConfigRecord).result_label?.trim() || 'Wynik'}
          result={resultText}
          secondaryColor={colors.textSecondary}
          textColor={colors.text}
          unit={(calculator as CalculatorConfigRecord).result_unit?.trim() || ''}
          compact={isCompact}
        />
      )}

      {/* Debug Info */}
      {shouldShowDebug(calculator) && (
        <View style={[styles.debugSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.debugTitle, { color: colors.textSecondary }]}>Debug</Text>
          <Text style={[styles.debugText, { color: colors.text }]}>
            {JSON.stringify(fieldValues, null, 2)}
          </Text>
          {computedResults.some(r => r.error) && (
            <Text style={[styles.debugError, { color: colors.error }]}>
              Errors: {computedResults.filter(r => r.error).map(r => r.error).join(', ')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardCompact: {
    padding: 12,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 17,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitleStatic: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionContent: {
    gap: 12,
  },
  sectionContentCompact: {
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  buttonRowCompact: {
    marginBottom: 12,
    marginTop: 4,
  },
  calculateButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
  },
  calculateButtonCompact: {
    minHeight: 42,
    borderRadius: 10,
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  calculateButtonTextCompact: {
    fontSize: 15,
  },
  resetButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  resetButtonCompact: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerState: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 180,
    padding: 16,
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  resultsSection: {
    gap: 12,
  },
  resultsSectionCompact: {
    gap: 8,
  },
  placeholderResult: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
  debugSection: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  debugText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugError: {
    fontSize: 11,
    marginTop: 8,
  },
});
