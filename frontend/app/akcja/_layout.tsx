import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function AkcjaLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
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
        name="szybki-pomocnik/[category]"
        options={{
          title: 'Szybki pomocnik',
        }}
      />
      <Stack.Screen
        name="procedury"
        options={{
          title: 'Procedury',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="karty-ratownicze"
        options={{
          title: 'Karty ratownicze',
        }}
      />
      <Stack.Screen
        name="ratownicze-webview"
        options={{
          title: 'Wyszukiwanie',
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
