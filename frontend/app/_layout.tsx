import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { FavoritesProvider } from '../src/contexts/FavoritesContext';
import { UsageProvider } from '../src/contexts/UsageContext';
import { AirManagementProvider } from '../src/contexts/AirManagementContext';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

function TabLayout() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Handler to reset stack when tab is pressed
  const getTabPressListener = (routeName: string) => ({
    tabPress: (e: any) => {
      // Navigate to the root of the tab
      router.replace(`/${routeName === 'index' ? '' : routeName}` as any);
    },
  });

  // Calculate tab bar height with safe area
  const TAB_BAR_BASE_HEIGHT = 56;
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingBottom: insets.bottom,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700',
          },
          // Disable default safe area handling - we handle it manually
          tabBarHideOnKeyboard: true,
        }}
        // Override safe area insets for the tab bar
        safeAreaInsets={{ bottom: 0 }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Główna',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="akcja"
          options={{
            title: 'Akcja',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flame" size={size} color={color} />
            ),
          }}
          listeners={getTabPressListener('akcja')}
        />
        <Tabs.Screen
          name="biuro"
          options={{
            title: 'Biuro',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase" size={size} color={color} />
            ),
          }}
          listeners={getTabPressListener('biuro')}
        />
        <Tabs.Screen
          name="ulubione"
          options={{
            title: 'Ulubione',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="star" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ustawienia"
          options={{
            title: 'Ustawienia',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="strefa-zagrozenia"
          options={{
            href: null, // Hide from tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="zarzadzanie-powietrzem"
          options={{
            href: null, // Hide from tab bar
            headerShown: false,
          }}
        />
      </Tabs>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <UsageProvider>
            <AirManagementProvider>
              <TabLayout />
            </AirManagementProvider>
          </UsageProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
