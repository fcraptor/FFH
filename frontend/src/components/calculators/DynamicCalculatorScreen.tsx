import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CalculatorConfigRecord, CalculatorFieldRecord } from '../../types';
import { fetchCalculators, fetchCalculatorFields } from '../../utils/dataService';
import {
  evaluateFormulaExpression,
  getButtonLabel,
  getFieldDefaultValue,
  getResultDecimals,
  shouldShowLiveResult,
  sortCalculatorFields,
  validateCalculatorField,
} from '../../utils/calculatorEngine';
import { CalculatorFieldRenderer } from './CalculatorFieldRenderer';
import { ResultCard } from './ResultCard';

interface DynamicCalculatorScreenProps {
  calculatorId: string;
  colors: {
    border: string;
    card: string;
    error: string;
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

export function DynamicCalculatorScreen({ calculatorId, colors }: DynamicCalculatorScreenProps) {
  const [calculator, setCalculator] = useState<CalculatorConfigRecord | null>(null);
  const [fields, setFields] = useState<CalculatorFieldRecord[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, boolean | number | string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [resultText, setResultText] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCalculatorData = async () => {
      setLoading(true);
      const [calculators, calculatorFields] = await Promise.all([
        fetchCalculators(),
        fetchCalculatorFields(),
      ]);

      if (!mounted) return;

      const nextCalculator = calculators.find((item) => item.calculator_id === calculatorId) || null;
      const nextFields = sortCalculatorFields(calculatorFields.filter((item) => item.calculator_id === calculatorId));

      setCalculator(nextCalculator);
      setFields(nextFields);
      setFieldValues(
        nextFields.reduce<Record<string, boolean | number | string>>((accumulator, field) => {
          accumulator[field.field_name] = getFieldDefaultValue(field);
          return accumulator;
        }, {}),
      );
      setValidationErrors({});
      setResultText('—');
      setLoading(false);
    };

    loadCalculatorData();

    return () => {
      mounted = false;
    };
  }, [calculatorId]);

  const runCalculation = useMemo(() => {
    return () => {
      if (!calculator) return false;

      const nextErrors = fields.reduce<Record<string, string>>((accumulator, field) => {
        const message = validateCalculatorField(field, fieldValues[field.field_name]);
        if (message) {
          accumulator[field.field_name] = message;
        }
        return accumulator;
      }, {});

      setValidationErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setResultText('Błąd obliczenia');
        return false;
      }

      const result = evaluateFormulaExpression(calculator.formula_expression || '', fieldValues);
      if (result === null) {
        setResultText('Błąd obliczenia');
        return false;
      }

      setResultText(result.toFixed(getResultDecimals(calculator)));
      return true;
    };
  }, [calculator, fieldValues, fields]);

  useEffect(() => {
    if (calculator && shouldShowLiveResult(calculator)) {
      runCalculation();
    }
  }, [calculator, fieldValues, runCalculation]);

  if (loading) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!calculator) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.card }]}>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>Nie znaleziono kalkulatora.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`calculator-screen-${calculatorId}`}>
      <Text style={[styles.title, { color: colors.text }]}>{calculator.calculator_name}</Text>
      {calculator.calculator_description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{calculator.calculator_description}</Text>
      ) : null}

      {fields.map((field) => (
        <CalculatorFieldRenderer
          key={field.field_id}
          colors={colors}
          field={field}
          onChange={(fieldName, value) => {
            setFieldValues((current) => ({ ...current, [fieldName]: value }));
            setValidationErrors((current) => ({ ...current, [fieldName]: '' }));
          }}
          validationMessage={validationErrors[field.field_name] || ''}
          value={fieldValues[field.field_name]}
        />
      ))}

      {!shouldShowLiveResult(calculator) ? (
        <Pressable
          onPress={runCalculation}
          style={[styles.calculateButton, { backgroundColor: colors.primary }]}
          testID="calc-run-button"
        >
          <Text style={styles.calculateButtonText}>{getButtonLabel(calculator)}</Text>
        </Pressable>
      ) : null}

      <ResultCard
        backgroundColor={colors.surface}
        borderColor={colors.border}
        label={calculator.result_label?.trim() || 'Wynik'}
        result={resultText}
        secondaryColor={colors.textSecondary}
        textColor={colors.text}
        unit={calculator.result_unit?.trim() || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  calculateButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 16,
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
});