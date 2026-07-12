import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ResultCardProps {
  backgroundColor: string;
  borderColor: string;
  label: string;
  result: string;
  secondaryColor: string;
  textColor: string;
  unit?: string;
  highlighted?: boolean;
  compact?: boolean;
  helpText?: string;
}

export function ResultCard({
  backgroundColor,
  borderColor,
  label,
  result,
  secondaryColor,
  textColor,
  unit,
  highlighted = false,
  compact = false,
  helpText,
}: ResultCardProps) {
  return (
    <View 
      style={[
        styles.card, 
        { backgroundColor, borderColor },
        highlighted && styles.highlightedCard,
        compact && styles.cardCompact,
      ]} 
      testID="calc-result-card"
    >
      <Text style={[
        styles.label, 
        { color: secondaryColor },
        compact && styles.labelCompact,
      ]}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text 
          style={[
            styles.value, 
            { color: textColor },
            highlighted && styles.highlightedValue,
            compact && styles.valueCompact,
          ]} 
          testID="calc-result-value"
        >
          {result}
        </Text>
        {unit ? (
          <Text style={[
            styles.unit, 
            { color: secondaryColor },
            compact && styles.unitCompact,
          ]}>
            {unit}
          </Text>
        ) : null}
      </View>
      {helpText && (
        <Text style={[styles.helpText, { color: secondaryColor }]}>
          {helpText}
        </Text>
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
    borderRadius: 12,
    padding: 12,
  },
  highlightedCard: {
    borderWidth: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  labelCompact: {
    fontSize: 12,
    marginBottom: 6,
  },
  valueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
  },
  valueCompact: {
    fontSize: 24,
  },
  highlightedValue: {
    fontSize: 34,
  },
  unit: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  unitCompact: {
    fontSize: 12,
    marginBottom: 2,
  },
  helpText: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
});
