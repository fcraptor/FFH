import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function BiuroLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1565C0',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pdf-viewer"
        options={{
          title: 'Dokument',
        }}
      />
    </Stack>
  );
}
