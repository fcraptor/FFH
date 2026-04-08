import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import { Rota, AppTemplate } from '../types/air-management';
import { APP_TEMPLATE_STORAGE_KEY, createDefaultTemplate, createStandardRota, createRitRota, getForecast } from '../utils/air-management';

interface AirManagementState {
  rotas: Rota[];
  actionStartTimestamp: number;
  nextStandardOrder: number;
  nextRitOrder: number;
  loading: boolean;
}

interface AirManagementContextType extends AirManagementState {
  now: number;
  updateRota: (rotaId: string, updater: (rota: Rota) => Rota) => void;
  setRotas: React.Dispatch<React.SetStateAction<Rota[]>>;
  addRota: () => void;
  activateRit: () => void;
  clearAllData: () => void;
}

const AirManagementContext = createContext<AirManagementContextType | null>(null);

export function AirManagementProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(Date.now());
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [actionStartTimestamp, setActionStartTimestamp] = useState(Date.now());
  const [nextStandardOrder, setNextStandardOrder] = useState(2);
  const [nextRitOrder, setNextRitOrder] = useState(1);
  const [loading, setLoading] = useState(true);
  const notifiedRotaIdsRef = useRef<string[]>([]);

  // Setup notifications
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS !== 'web') {
      Notifications.requestPermissionsAsync().catch(() => undefined);
    }
  }, []);

  // Timer - runs continuously even when screen is not active
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load saved data
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const storedTemplate = await AsyncStorage.getItem(APP_TEMPLATE_STORAGE_KEY);
        if (storedTemplate) {
          const parsedTemplate = JSON.parse(storedTemplate) as AppTemplate;
          const nextRotas = parsedTemplate.rotas?.length ? parsedTemplate.rotas : createDefaultTemplate().rotas;
          setRotas(nextRotas);
          setActionStartTimestamp(parsedTemplate.actionStartTimestamp || Date.now());
          setNextStandardOrder(Math.max(2, ...nextRotas.filter((rota) => rota.kind === 'standard').map((rota) => rota.displayOrder + 1)));
          setNextRitOrder(Math.max(1, ...nextRotas.filter((rota) => rota.kind === 'rit').map((rota) => rota.displayOrder + 1)));
        } else {
          const template = createDefaultTemplate();
          await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
          setRotas(template.rotas);
          setActionStartTimestamp(template.actionStartTimestamp);
          setNextStandardOrder(2);
          setNextRitOrder(1);
        }
      } catch {
        const template = createDefaultTemplate();
        setRotas(template.rotas);
        setActionStartTimestamp(template.actionStartTimestamp);
        setNextStandardOrder(2);
        setNextRitOrder(1);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, []);

  // Save data whenever rotas change
  useEffect(() => {
    if (!loading) {
      const saveTemplate = async () => {
        try {
          const template: AppTemplate = {
            version: '1.0.0',
            createdAt: Date.now(),
            actionStartTimestamp,
            rotas,
          };
          await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
        } catch {
          // Ignore save errors
        }
      };
      saveTemplate();
    }
  }, [rotas, actionStartTimestamp, loading]);

  // Check alarms
  useEffect(() => {
    const checkAlarmNotifications = async () => {
      const activeAlarms = rotas
        .filter((rota) => rota.state === 'active' && getForecast(rota, now).alarmReached)
        .map((rota) => rota.id);

      for (const rotaId of activeAlarms) {
        if (!notifiedRotaIdsRef.current.includes(rotaId) && Platform.OS !== 'web') {
          Vibration.vibrate();
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Alarm roty',
              body: 'Ciśnienie osiągnęło 50 bar lub mniej.',
              sound: 'default',
            },
            trigger: null,
          });
        }
      }

      notifiedRotaIdsRef.current = activeAlarms;
    };

    checkAlarmNotifications().catch(() => undefined);
  }, [now, rotas]);

  const updateRota = useCallback((rotaId: string, updater: (rota: Rota) => Rota) => {
    setRotas((currentRotas) => currentRotas.map((rota) => (rota.id === rotaId ? updater(rota) : rota)));
  }, []);

  const addRota = useCallback(() => {
    if (nextStandardOrder > 30) {
      return false;
    }
    setRotas((currentRotas) => [...currentRotas, createStandardRota(nextStandardOrder)]);
    setNextStandardOrder((currentValue) => currentValue + 1);
    return true;
  }, [nextStandardOrder]);

  const activateRit = useCallback(() => {
    if (nextRitOrder > 3) {
      return false;
    }
    setRotas((currentRotas) => [...currentRotas, createRitRota(nextRitOrder)]);
    setNextRitOrder((currentValue) => currentValue + 1);
    return true;
  }, [nextRitOrder]);

  const clearAllData = useCallback(async () => {
    const template = createDefaultTemplate();
    setRotas(template.rotas);
    setActionStartTimestamp(template.actionStartTimestamp);
    setNextStandardOrder(2);
    setNextRitOrder(1);
    notifiedRotaIdsRef.current = [];
    await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
  }, []);

  return (
    <AirManagementContext.Provider
      value={{
        now,
        rotas,
        actionStartTimestamp,
        nextStandardOrder,
        nextRitOrder,
        loading,
        updateRota,
        setRotas,
        addRota,
        activateRit,
        clearAllData,
      }}
    >
      {children}
    </AirManagementContext.Provider>
  );
}

export function useAirManagement() {
  const context = useContext(AirManagementContext);
  if (!context) {
    throw new Error('useAirManagement must be used within AirManagementProvider');
  }
  return context;
}
