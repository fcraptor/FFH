import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import { Rota, AppTemplate } from '../types/air-management';
import { APP_TEMPLATE_STORAGE_KEY, createDefaultTemplate, createStandardRota, createRitRota, getForecast, PAL } from '../utils/air-management';

// Próg alertu 170 bar
const LOW_PRESSURE_ALERT_THRESHOLD = 170;
// Próg alarmu 50 bar
const ALARM_THRESHOLD = PAL; // 50 bar

// Klucz do przechowywania ID zaplanowanych powiadomień
const SCHEDULED_NOTIFICATIONS_KEY = '@firefighter_scheduled_notifications';

interface ScheduledNotification {
  rotaId: string;
  notificationId: string;
  type: '170bar' | '50bar';
  scheduledFor: number;
}

interface AirManagementState {
  rotas: Rota[];
  actionStartTimestamp: number;
  nextStandardOrder: number;
  nextRitOrder: number;
  loading: boolean;
  actionTimeRunning: boolean;
}

interface AirManagementContextType extends AirManagementState {
  now: number;
  updateRota: (rotaId: string, updater: (rota: Rota) => Rota) => void;
  setRotas: React.Dispatch<React.SetStateAction<Rota[]>>;
  addRota: () => void;
  activateRit: () => void;
  clearAllData: () => void;
  startActionTime: () => void;
  resetLowPressureAlert: (rotaId: string) => void;
  rotasWithLowPressureAlert: string[];
  // Nowa funkcja do planowania powiadomień
  scheduleRotaNotifications: (rota: Rota) => Promise<void>;
}

const AirManagementContext = createContext<AirManagementContextType | null>(null);

// Konfiguracja kanału powiadomień Android o wysokim priorytecie
// Zwraca Promise aby można było czekać na utworzenie kanału
async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('air-management-alerts', {
        name: 'Alerty zarządzania powietrzem',
        description: 'Krytyczne alerty ciśnienia powietrza dla strażaków',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });
      console.log('[NOTIFICATIONS] Android channel created successfully');
    } catch (err) {
      console.error('[NOTIFICATIONS] Failed to create Android channel:', err);
    }
  }
}

// Funkcja do obliczania czasu osiągnięcia danego ciśnienia
function calculateTimeToReachPressure(
  currentPressure: number,
  targetPressure: number,
  consumptionRateBarPerMin: number,
  entryTimestamp: number,
): number | null {
  if (!consumptionRateBarPerMin || consumptionRateBarPerMin <= 0) {
    // Domyślne zużycie ~7.35 bar/min (50 l/min dla butli 6.8L)
    consumptionRateBarPerMin = 50 / 6.8;
  }
  
  const pressureDrop = currentPressure - targetPressure;
  if (pressureDrop <= 0) return null; // Już poniżej progu
  
  const minutesToTarget = pressureDrop / consumptionRateBarPerMin;
  const msToTarget = minutesToTarget * 60 * 1000;
  
  return entryTimestamp + msToTarget;
}

// Funkcja do anulowania zaplanowanych powiadomień dla roty
async function cancelScheduledNotificationsForRota(rotaId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    const scheduled: ScheduledNotification[] = stored ? JSON.parse(stored) : [];
    
    const toCancel = scheduled.filter(n => n.rotaId === rotaId);
    const remaining = scheduled.filter(n => n.rotaId !== rotaId);
    
    for (const notification of toCancel) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
      } catch {}
    }
    
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(remaining));
  } catch {}
}

// Funkcja do zapisywania zaplanowanego powiadomienia
async function saveScheduledNotification(notification: ScheduledNotification): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    const scheduled: ScheduledNotification[] = stored ? JSON.parse(stored) : [];
    scheduled.push(notification);
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(scheduled));
  } catch {}
}

export function AirManagementProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(Date.now());
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [actionStartTimestamp, setActionStartTimestamp] = useState(Date.now());
  const [nextStandardOrder, setNextStandardOrder] = useState(2);
  const [nextRitOrder, setNextRitOrder] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionTimeRunning, setActionTimeRunning] = useState(false);
  
  const notifiedRotaIdsRef = useRef<string[]>([]);
  const lowPressureNotifiedRef = useRef<Set<string>>(new Set());
  const [rotasWithLowPressureAlert, setRotasWithLowPressureAlert] = useState<string[]>([]);
  const notificationChannelReady = useRef<boolean>(false);

  // Setup notifications - MUSI być przed planowaniem powiadomień
  useEffect(() => {
    const initNotifications = async () => {
      // 1. Ustaw handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        }),
      });

      // 2. Utwórz kanał Android (PRZED planowaniem powiadomień)
      await setupNotificationChannel();
      notificationChannelReady.current = true;

      // 3. Poproś o uprawnienia
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('[NOTIFICATIONS] Permission status:', status);
      }
    };

    initNotifications();
  }, []);

  // Timer
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
          const parsedTemplate = JSON.parse(storedTemplate) as AppTemplate & { actionTimeRunning?: boolean };
          const nextRotas = parsedTemplate.rotas?.length ? parsedTemplate.rotas : createDefaultTemplate().rotas;
          setRotas(nextRotas);
          setActionStartTimestamp(parsedTemplate.actionStartTimestamp || Date.now());
          setActionTimeRunning(parsedTemplate.actionTimeRunning ?? false);
          setNextStandardOrder(Math.max(2, ...nextRotas.filter((rota) => rota.kind === 'standard').map((rota) => rota.displayOrder + 1)));
          setNextRitOrder(Math.max(1, ...nextRotas.filter((rota) => rota.kind === 'rit').map((rota) => rota.displayOrder + 1)));
        } else {
          const template = createDefaultTemplate();
          await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify({ ...template, actionTimeRunning: false }));
          setRotas(template.rotas);
          setActionStartTimestamp(template.actionStartTimestamp);
          setActionTimeRunning(false);
          setNextStandardOrder(2);
          setNextRitOrder(1);
        }
      } catch {
        const template = createDefaultTemplate();
        setRotas(template.rotas);
        setActionStartTimestamp(template.actionStartTimestamp);
        setActionTimeRunning(false);
        setNextStandardOrder(2);
        setNextRitOrder(1);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, []);

  // Save data
  useEffect(() => {
    if (!loading) {
      const saveTemplate = async () => {
        try {
          const template = {
            version: '1.0.0',
            createdAt: Date.now(),
            actionStartTimestamp,
            actionTimeRunning,
            rotas,
          };
          await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
        } catch {}
      };
      saveTemplate();
    }
  }, [rotas, actionStartTimestamp, actionTimeRunning, loading]);

  // Funkcja do planowania powiadomień dla roty
  // Jeśli ciśnienie już jest poniżej progu - wyślij natychmiast
  // Jeśli jest powyżej - zaplanuj na przyszłość
  const scheduleRotaNotifications = useCallback(async (rota: Rota) => {
    if (Platform.OS === 'web') return;
    if (rota.state !== 'active' || !rota.entryTimestamp) return;

    // Anuluj poprzednie powiadomienia dla tej roty
    await cancelScheduledNotificationsForRota(rota.id);

    const currentPressure = rota.selectedPressure;
    const consumptionRate = rota.consumptionRateBarPerMin || (50 / rota.bottleVolume);
    const entryTimestamp = rota.entryTimestamp;

    // Oblicz czas od wejścia do teraz
    const elapsedMs = Date.now() - entryTimestamp;
    const elapsedMin = elapsedMs / 60000;
    const estimatedCurrentPressure = currentPressure - (consumptionRate * elapsedMin);

    console.log(`[AIR] Scheduling notifications for ${rota.label}:`);
    console.log(`  - Initial pressure: ${currentPressure} bar`);
    console.log(`  - Consumption rate: ${consumptionRate.toFixed(2)} bar/min`);
    console.log(`  - Estimated pressure now: ${estimatedCurrentPressure.toFixed(1)} bar`);

    // 1. Powiadomienie 170 bar - tylko jeśli jeszcze nie było wysłane
    if (estimatedCurrentPressure <= LOW_PRESSURE_ALERT_THRESHOLD) {
      // Ciśnienie już poniżej 170 bar
      if (!rota.lowPressureAlertShown) {
        // Jeszcze nie było powiadomienia - wyślij natychmiast
        console.log(`  ⚡ 170bar: sending immediately (already at ${estimatedCurrentPressure.toFixed(0)} bar)`);
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Sprawdź ciśnienie!',
              body: `${rota.label} - ciśnienie spadło do ${Math.round(estimatedCurrentPressure)} bar`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { rotaId: rota.id, type: '170bar' },
            },
            trigger: Platform.OS === 'android' 
              ? { channelId: 'air-management-alerts' } 
              : null,
          });
        } catch (err) {
          console.error('  ✗ Failed to send immediate 170bar notification:', err);
        }
      } else {
        console.log(`  - 170bar: already notified, skipping`);
      }
    } else {
      // Ciśnienie powyżej 170 bar - zaplanuj na przyszłość
      const minutesTo170 = (estimatedCurrentPressure - LOW_PRESSURE_ALERT_THRESHOLD) / consumptionRate;
      const secondsUntil170 = Math.max(5, Math.floor(minutesTo170 * 60));
      
      console.log(`  → 170bar in ${minutesTo170.toFixed(1)} min (${secondsUntil170}s)`);
      
      try {
        const targetDate = new Date(Date.now() + secondsUntil170 * 1000);
        
        const trigger: Notifications.NotificationTriggerInput = Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate,
              channelId: 'air-management-alerts',
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate,
            };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Sprawdź ciśnienie!',
            body: `${rota.label} - szacowane ciśnienie: 170 bar`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { rotaId: rota.id, type: '170bar' },
          },
          trigger,
        });

        await saveScheduledNotification({
          rotaId: rota.id,
          notificationId,
          type: '170bar',
          scheduledFor: Date.now() + secondsUntil170 * 1000,
        });

        console.log(`  ✓ 170bar scheduled for ${targetDate.toLocaleTimeString()}`);
      } catch (err) {
        console.error('  ✗ Failed to schedule 170bar notification:', err);
      }
    }

    // 2. Powiadomienie 50 bar (alarm)
    if (estimatedCurrentPressure <= ALARM_THRESHOLD) {
      // Ciśnienie już poniżej 50 bar - wyślij natychmiast
      console.log(`  ⚡ 50bar ALARM: sending immediately (already at ${estimatedCurrentPressure.toFixed(0)} bar)`);
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 ALARM ROTY!',
            body: `${rota.label} - ciśnienie ${Math.round(estimatedCurrentPressure)} bar!`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { rotaId: rota.id, type: '50bar' },
          },
          trigger: Platform.OS === 'android' 
            ? { channelId: 'air-management-alerts' } 
            : null,
        });
      } catch (err) {
        console.error('  ✗ Failed to send immediate 50bar notification:', err);
      }
    } else {
      // Ciśnienie powyżej 50 bar - zaplanuj na przyszłość
      const minutesTo50 = (estimatedCurrentPressure - ALARM_THRESHOLD) / consumptionRate;
      const secondsUntil50 = Math.max(5, Math.floor(minutesTo50 * 60));
      
      console.log(`  → 50bar in ${minutesTo50.toFixed(1)} min (${secondsUntil50}s)`);
      
      try {
        const targetDate = new Date(Date.now() + secondsUntil50 * 1000);
        
        const trigger: Notifications.NotificationTriggerInput = Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate,
              channelId: 'air-management-alerts',
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: targetDate,
            };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 ALARM ROTY!',
            body: `${rota.label} - ciśnienie osiągnęło 50 bar!`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { rotaId: rota.id, type: '50bar' },
          },
          trigger,
        });

        await saveScheduledNotification({
          rotaId: rota.id,
          notificationId,
          type: '50bar',
          scheduledFor: Date.now() + secondsUntil50 * 1000,
        });

        console.log(`  ✓ 50bar scheduled for ${targetDate.toLocaleTimeString()}`);
      } catch (err) {
        console.error('  ✗ Failed to schedule 50bar notification:', err);
      }
    }
  }, []);

  // Monitorowanie na żywo (gdy aplikacja jest aktywna)
  // Wysyła powiadomienie NATYCHMIAST gdy ciśnienie spadnie poniżej progu
  useEffect(() => {
    const checkLowPressureAlerts = async () => {
      const newAlertsToAdd: string[] = [];
      
      for (const rota of rotas) {
        if (rota.state !== 'active') continue;
        
        const forecast = getForecast(rota, now);
        const estimatedPressure = forecast.estimatedPressureValue;
        
        if (estimatedPressure === null || estimatedPressure === undefined) continue;
        
        // Sprawdzanie 170 bar
        if (estimatedPressure <= LOW_PRESSURE_ALERT_THRESHOLD) {
          if (!lowPressureNotifiedRef.current.has(rota.id) && !rota.lowPressureAlertShown) {
            // Wibracja + powiadomienie natychmiast
            if (Platform.OS !== 'web') {
              Vibration.vibrate([0, 500, 200, 500]);
              
              // Anuluj zaplanowane powiadomienia i wyślij natychmiast
              await cancelScheduledNotificationsForRota(rota.id);
              
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '⚠️ Sprawdź ciśnienie!',
                    body: `${rota.label} - ciśnienie ${Math.round(estimatedPressure)} bar`,
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    data: { rotaId: rota.id, type: '170bar' },
                  },
                  trigger: Platform.OS === 'android' 
                    ? { channelId: 'air-management-alerts' } 
                    : null,
                });
              } catch (err) {
                console.error('Failed to send 170bar notification:', err);
              }
            }
            
            lowPressureNotifiedRef.current.add(rota.id);
            newAlertsToAdd.push(rota.id);
            
            setRotas((currentRotas) =>
              currentRotas.map((r) =>
                r.id === rota.id ? { ...r, lowPressureAlertShown: true } : r
              )
            );
          } else if (rota.lowPressureAlertShown && !rotasWithLowPressureAlert.includes(rota.id)) {
            newAlertsToAdd.push(rota.id);
          }
        }
      }
      
      if (newAlertsToAdd.length > 0) {
        setRotasWithLowPressureAlert((prev) => {
          const combined = new Set([...prev, ...newAlertsToAdd]);
          return Array.from(combined);
        });
      }
    };

    checkLowPressureAlerts();
  }, [now, rotas, rotasWithLowPressureAlert]);

  // Check 50 bar alarm - wysyła powiadomienie NATYCHMIAST gdy ciśnienie spadnie
  useEffect(() => {
    const checkAlarmNotifications = async () => {
      const activeAlarms = rotas
        .filter((rota) => rota.state === 'active' && getForecast(rota, now).alarmReached)
        .map((rota) => rota.id);

      for (const rotaId of activeAlarms) {
        if (!notifiedRotaIdsRef.current.includes(rotaId) && Platform.OS !== 'web') {
          const rota = rotas.find(r => r.id === rotaId);
          
          // Wibracja alarm
          Vibration.vibrate([0, 500, 500, 500, 500, 500]);
          
          // Anuluj zaplanowane i wyślij powiadomienie natychmiast
          await cancelScheduledNotificationsForRota(rotaId);
          
          try {
            const forecast = getForecast(rota!, now);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🚨 ALARM ROTY!',
                body: `${rota?.label || 'Rota'} - ciśnienie ${Math.round(forecast.estimatedPressureValue || 50)} bar!`,
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { rotaId, type: '50bar' },
              },
              trigger: Platform.OS === 'android' 
                ? { channelId: 'air-management-alerts' } 
                : null,
            });
          } catch (err) {
            console.error('Failed to send 50bar alarm notification:', err);
          }
        }
      }

      notifiedRotaIdsRef.current = activeAlarms;
    };

    checkAlarmNotifications();
  }, [now, rotas]);

  const updateRota = useCallback((rotaId: string, updater: (rota: Rota) => Rota) => {
    setRotas((currentRotas) => currentRotas.map((rota) => (rota.id === rotaId ? updater(rota) : rota)));
  }, []);

  const addRota = useCallback(() => {
    if (nextStandardOrder > 30) return false;
    setRotas((currentRotas) => [...currentRotas, createStandardRota(nextStandardOrder)]);
    setNextStandardOrder((currentValue) => currentValue + 1);
    return true;
  }, [nextStandardOrder]);

  const activateRit = useCallback(() => {
    if (nextRitOrder > 3) return false;
    setRotas((currentRotas) => [...currentRotas, createRitRota(nextRitOrder)]);
    setNextRitOrder((currentValue) => currentValue + 1);
    return true;
  }, [nextRitOrder]);

  const startActionTime = useCallback(() => {
    const newTimestamp = Date.now();
    setActionStartTimestamp(newTimestamp);
    setActionTimeRunning(true);
  }, []);

  const resetLowPressureAlert = useCallback(async (rotaId: string) => {
    setRotasWithLowPressureAlert((prev) => prev.filter((id) => id !== rotaId));
    lowPressureNotifiedRef.current.delete(rotaId);
    setRotas((currentRotas) =>
      currentRotas.map((rota) =>
        rota.id === rotaId ? { ...rota, lowPressureAlertShown: false } : rota
      )
    );
    
    // Przeplanuj powiadomienia po kontroli
    const rota = rotas.find(r => r.id === rotaId);
    if (rota) {
      await scheduleRotaNotifications(rota);
    }
  }, [rotas, scheduleRotaNotifications]);

  const clearAllData = useCallback(async () => {
    // Anuluj wszystkie zaplanowane powiadomienia
    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
      const scheduled: ScheduledNotification[] = stored ? JSON.parse(stored) : [];
      for (const notification of scheduled) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
        } catch {}
      }
      await AsyncStorage.removeItem(SCHEDULED_NOTIFICATIONS_KEY);
    } catch {}

    const template = createDefaultTemplate();
    setRotas(template.rotas);
    setActionStartTimestamp(template.actionStartTimestamp);
    setNextStandardOrder(2);
    setNextRitOrder(1);
    setActionTimeRunning(false);
    setRotasWithLowPressureAlert([]);
    notifiedRotaIdsRef.current = [];
    lowPressureNotifiedRef.current.clear();
    await AsyncStorage.setItem(APP_TEMPLATE_STORAGE_KEY, JSON.stringify({ ...template, actionTimeRunning: false }));
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
        actionTimeRunning,
        updateRota,
        setRotas,
        addRota,
        activateRit,
        clearAllData,
        startActionTime,
        resetLowPressureAlert,
        rotasWithLowPressureAlert,
        scheduleRotaNotifications,
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
