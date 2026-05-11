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
}

export function ResultCard({
  backgroundColor,
  borderColor,
  label,
  result,
  secondaryColor,
  textColor,
  unit,
}: ResultCardProps) {
  return (
    <View style={[styles.card, { backgroundColor, borderColor }]} testID="calc-result-card">
      <Text style={[styles.label, { color: secondaryColor }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: textColor }]} testID="calc-result-value">{result}</Text>
        {unit ? <Text style={[styles.unit, { color: secondaryColor }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
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
  unit: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
});