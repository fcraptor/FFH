import React from 'react';
import { StyleSheet, Text } from 'react-native';

interface ValidationMessageProps {
  color: string;
  message: string;
}

export function ValidationMessage({ color, message }: ValidationMessageProps) {
  if (!message) return null;

  return <Text style={[styles.message, { color }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  message: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
});