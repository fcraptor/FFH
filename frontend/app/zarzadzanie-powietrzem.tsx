import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useAirManagement } from '../src/contexts/AirManagementContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { RotaCard } from '../src/components/air-management/RotaCard';
import { InputModal } from '../src/components/air-management/InputModal';
import { PressureModal } from '../src/components/air-management/PressureModal';
import { BottleModal } from '../src/components/air-management/BottleModal';
import { RotaLabelModal } from '../src/components/air-management/RotaLabelModal';
import { Rota } from '../src/types/air-management';
import { CONTROL_PRESSURE_OPTIONS, formatClock, formatClockDuration, PAL } from '../src/utils/air-management';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type InputModalState =
  | { type: 'name'; rotaId: string; firefighterIndex: 0 | 1; title: string; value: string }
  | { type: 'initialPressure'; rotaId: string; title: string; value: string }
  | { type: 'bottle'; rotaId: string; title: string; value: string }
  | null;

export default function ZarzadzaniePowietrzem() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: appColors, theme } = useTheme();
  const {
    now,
    rotas,
    actionStartTimestamp,
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
  } = useAirManagement();

  const [inputModal, setInputModal] = useState<InputModalState>(null);
  const [inputDraft, setInputDraft] = useState('');
  const [controlModal, setControlModal] = useState<{ rotaId: string; initialValue: number } | null>(null);
  const [bottleModal, setBottleModal] = useState<{ rotaId: string; initialValue: number } | null>(null);
  const [labelModal, setLabelModal] = useState<{ rotaId: string } | null>(null);
  
  // Modal startu nowej akcji
  const [showStartActionModal, setShowStartActionModal] = useState(false);
  
  // Sprawdź czy pokazać modal startu akcji za każdym razem przy wejściu do modułu
  useFocusEffect(
    useCallback(() => {
      // Pokaż modal gdy czas akcji nie jest uruchomiony (równy 0)
      if (!loading && !actionTimeRunning) {
        setShowStartActionModal(true);
      }
    }, [loading, actionTimeRunning])
  );
  
  // Handler dla przycisku OK w modalu startu akcji
  const handleStartAction = () => {
    startActionTime();
    setShowStartActionModal(false);
  };

  const colors = useMemo(() => ({
    background: appColors.background,
    surface: appColors.card,
    text: appColors.text,
    secondary: appColors.textSecondary,
    border: theme === 'dark' ? '#4A4A4A' : '#D0D0D0',
    bottleButtonBackground: theme === 'dark' ? '#FFFFFF' : '#F3F4F6',
    buttonGray: theme === 'dark' ? '#C9CDD3' : '#D3D3D3',
    buttonYellow: '#FFE400',
    buttonRed: '#FF453A',
    accent: '#FFE400',
    tile: theme === 'dark' ? '#303033' : '#E8E8E8',
    overlay: theme === 'dark' ? 'rgba(0, 0, 0, 0.62)' : 'rgba(15, 23, 42, 0.28)',
    input: theme === 'dark' ? '#2B2B2F' : '#F3F4F6',
    muted: '#000000',
    clockBar: theme === 'dark' ? '#000000' : '#1F2937',
    ready: '#19A4E6',
    safe: '#29B34A',
    warning: '#FFE400',
    danger: '#FF9F0A',
    critical: '#FF453A',
  }), [appColors, theme]);

  const standardRotas = rotas.filter((rota) => rota.kind === 'standard').sort((left, right) => left.displayOrder - right.displayOrder);
  const ritRotas = rotas.filter((rota) => rota.kind === 'rit').sort((left, right) => left.displayOrder - right.displayOrder);

  const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const handleAddRota = () => {
    animateLayout();
    const success = addRota();
    if (!success) {
      Alert.alert('Limit osiągnięty', 'Możesz mieć maksymalnie 30 rot roboczych.');
    }
  };

  const handleActivateRit = () => {
    animateLayout();
    const success = activateRit();
    if (!success) {
      Alert.alert('Limit osiągnięty', 'Możesz uruchomić maksymalnie 3 roty RIT.');
    }
  };

  const handleToggleExpanded = (rotaId: string) => {
    animateLayout();
    updateRota(rotaId, (rota) => ({ ...rota, expanded: !rota.expanded }));
  };

  const handleOpenNameModal = (rota: Rota, firefighterIndex: 0 | 1) => {
    setInputDraft('');
    setInputModal({
      type: 'name',
      rotaId: rota.id,
      firefighterIndex,
      title: firefighterIndex === 0 ? 'Ratownik 1' : 'Ratownik 2',
      value: '',
    });
  };

  const handleOpenInitialPressureModal = (rota: Rota) => {
    setInputDraft('');
    setInputModal({
      type: 'initialPressure',
      rotaId: rota.id,
      title: `${rota.label} — ciśnienie wejścia`,
      value: '',
    });
  };

  const handleBottlePress = (rota: Rota) => {
    setBottleModal({ rotaId: rota.id, initialValue: rota.bottleVolume });
  };

  const handleOpenLabelModal = (rota: Rota) => {
    setLabelModal({ rotaId: rota.id });
  };

  const closeInputModal = () => {
    setInputModal(null);
    setInputDraft('');
  };

  const handleSaveInput = () => {
    if (!inputModal) return;

    if (inputModal.type === 'name') {
      updateRota(inputModal.rotaId, (rota) => {
        const nextFirefighters: [string, string] = [...rota.firefighters] as [string, string];
        const nextValue = inputDraft.trim() || rota.firefighters[inputModal.firefighterIndex];
        nextFirefighters[inputModal.firefighterIndex] = nextValue;
        return { ...rota, firefighters: nextFirefighters };
      });
      closeInputModal();
      return;
    }

    if (inputModal.type === 'initialPressure') {
      const parsedValue = Number(inputDraft.replace(',', '.'));
      if (!Number.isFinite(parsedValue) || parsedValue <= PAL) {
        Alert.alert('Nieprawidłowa wartość', `Podaj ciśnienie większe niż ${PAL} bar.`);
        return;
      }
      updateRota(inputModal.rotaId, (rota) => ({ ...rota, selectedPressure: Math.round(parsedValue) }));
      closeInputModal();
      return;
    }

    const parsedBottle = Number(inputDraft.replace(',', '.'));
    if (!Number.isFinite(parsedBottle) || parsedBottle <= 0) {
      Alert.alert('Nieprawidłowa wartość', 'Podaj pojemność butli większą od 0.');
      return;
    }
    updateRota(inputModal.rotaId, (rota) => ({ ...rota, bottleVolume: Number(parsedBottle.toFixed(1)) }));
    closeInputModal();
  };

  const handleSaveBottleModal = (value: number) => {
    if (!bottleModal || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Nieprawidłowa wartość', 'Podaj pojemność butli większą od 0.');
      return;
    }
    updateRota(bottleModal.rotaId, (rota) => ({ ...rota, bottleVolume: Number(value.toFixed(1)) }));
    setBottleModal(null);
  };

  const handleSaveLabelModal = ({ organization, text }: { organization: 'JRG' | 'OSP' | null; text: string }) => {
    if (!labelModal) return;
    const cleanedText = text.trim();
    const nextLabel = [organization, cleanedText].filter(Boolean).join(' ').trim();
    if (!nextLabel) {
      Alert.alert('Brak nazwy', 'Wybierz JRG lub OSP oraz/lub wpisz nazwę roty.');
      return;
    }
    updateRota(labelModal.rotaId, (rota) => ({ ...rota, label: nextLabel }));
    setLabelModal(null);
  };

  const handleActionPress = (rota: Rota) => {
    animateLayout();
    if (rota.state === 'ready') {
      const updatedRota: Rota = {
        ...rota,
        state: 'active',
        entryTimestamp: Date.now(),
        exitDurationSeconds: null,
        lastControl: null,
        consumptionRateBarPerMin: null,
        restoreSnapshot: null,
        lowPressureAlertShown: false,
      };
      updateRota(rota.id, () => updatedRota);
      
      // Zaplanuj powiadomienia w tle dla tej roty
      scheduleRotaNotifications(updatedRota);
      return;
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (rota.entryTimestamp ?? Date.now())) / 1000));
    updateRota(rota.id, (currentRota) => ({
      ...currentRota,
      state: 'exited',
      exitDurationSeconds: elapsedSeconds,
      entryTimestamp: null,
      restoreSnapshot: {
        label: currentRota.label,
        kind: currentRota.kind,
        displayOrder: currentRota.displayOrder,
        firefighters: currentRota.firefighters,
        expanded: currentRota.expanded,
        selectedPressure: currentRota.selectedPressure,
        bottleVolume: currentRota.bottleVolume,
        state: 'active',
        entryTimestamp: currentRota.entryTimestamp,
        exitDurationSeconds: currentRota.exitDurationSeconds,
        lastControl: currentRota.lastControl,
        consumptionRateBarPerMin: currentRota.consumptionRateBarPerMin,
        previousConsumptionRateLpm: currentRota.previousConsumptionRateLpm,
      },
    }));
  };

  const handleRestorePress = (rota: Rota) => {
    if (!rota.restoreSnapshot) return;
    animateLayout();
    updateRota(rota.id, (currentRota) =>
      currentRota.restoreSnapshot
        ? {
            ...currentRota.restoreSnapshot,
            id: currentRota.id,
            entryTimestamp: Date.now() - (currentRota.exitDurationSeconds ?? 0) * 1000,
            restoreSnapshot: null,
          }
        : currentRota,
    );
  };

  const handleControlPress = (rota: Rota) => {
    if (rota.state !== 'active' || !rota.entryTimestamp) {
      Alert.alert('Najpierw wejście', 'Uruchom rotę przyciskiem WEJŚCIE, aby dodać kontrolę.');
      return;
    }
    setControlModal({
      rotaId: rota.id,
      initialValue: rota.lastControl?.pressure ?? Math.max(PAL + 10, Math.min(270, rota.selectedPressure - 10)),
    });
  };

  const handleSaveControl = (value: number) => {
    if (!controlModal) return;
    const parsedValue = Math.round(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= PAL) {
      Alert.alert('Nieprawidłowa wartość', `Podaj ciśnienie większe niż ${PAL} bar.`);
      return;
    }

    const targetRota = rotas.find((rota) => rota.id === controlModal.rotaId);
    if (!targetRota?.entryTimestamp) {
      setControlModal(null);
      return;
    }

    const elapsedMinutes = (Date.now() - targetRota.entryTimestamp) / 60000;
    if (elapsedMinutes <= 0) {
      Alert.alert('Za wcześnie', 'Odczekaj chwilę po wejściu przed wykonaniem kontroli.');
      return;
    }

    if (parsedValue >= targetRota.selectedPressure) {
      Alert.alert('Brak danych', 'Ciśnienie kontroli musi być niższe niż ciśnienie wejścia.');
      return;
    }

    const consumptionRate = (targetRota.selectedPressure - parsedValue) / elapsedMinutes;
    if (!Number.isFinite(consumptionRate) || consumptionRate <= 0) {
      Alert.alert('Brak danych', 'Nie udało się wyliczyć średniego zużycia.');
      return;
    }

    const previousLpm = targetRota.lastControl && targetRota.consumptionRateBarPerMin
      ? Math.round(targetRota.consumptionRateBarPerMin * targetRota.bottleVolume)
      : 50;

    // Nie resetuj flagi lowPressureAlertShown jeśli ciśnienie kontroli jest już poniżej 170 bar
    const shouldKeepAlertShown = parsedValue <= 170 && targetRota.lowPressureAlertShown;

    const updatedRota: Rota = {
      ...targetRota,
      lastControl: {
        pressure: parsedValue,
        elapsedSeconds: Math.max(1, Math.floor(elapsedMinutes * 60)),
        timestamp: Date.now(),
      },
      consumptionRateBarPerMin: consumptionRate,
      previousConsumptionRateLpm: previousLpm,
      lowPressureAlertShown: shouldKeepAlertShown ? true : false,
    };

    updateRota(controlModal.rotaId, () => updatedRota);
    
    // Reset alertu 170 bar po wykonaniu kontroli TYLKO jeśli ciśnienie jest powyżej 170
    if (parsedValue > 170) {
      resetLowPressureAlert(controlModal.rotaId);
    }
    
    // Przeplanuj powiadomienia z nowymi danymi o zużyciu
    scheduleRotaNotifications(updatedRota);
    
    setControlModal(null);
  };

  const handleClearPress = (rota: Rota) => {
    Alert.alert('Usuń rotę', `Czy na pewno chcesz usunąć ${rota.label}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Tak',
        style: 'destructive',
        onPress: () => {
          animateLayout();
          setRotas((currentRotas) => currentRotas.filter((item) => item.id !== rota.id));
        },
      },
    ]);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Nowa akcja',
      'Czy wyczyścić dane zarządzania czasem i utworzyć nową akcję?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Potwierdź',
          style: 'destructive',
          onPress: async () => {
            animateLayout();
            await clearAllData();
            // Po wyczyszczeniu pokaż modal startu nowej akcji
            setShowStartActionModal(true);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={colors.buttonYellow} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.fixedHeader}>
        <View style={styles.headerMainRow}>
          <Pressable
            onPress={() => router.back()}
            testID="air-back-button"
            style={({ pressed }) => [
              styles.headerButton,
              styles.headerButtonLeft,
              {
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.15)' : colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.clockRowContainer}>
            <View style={styles.clockRow}>
              <View style={[styles.clockBar, { backgroundColor: colors.clockBar }]}>
                <Text style={styles.clockLabel}>Aktualny czas</Text>
                <Text style={styles.clockText}>{formatClock(new Date(now))}</Text>
              </View>
              <View style={[styles.clockBar, { backgroundColor: colors.clockBar }]}>
                <Text style={styles.clockLabel}>Czas AKCJI</Text>
                <Text style={styles.clockText}>
                  {actionTimeRunning 
                    ? formatClockDuration(Math.floor((now - actionStartTimestamp) / 1000))
                    : '00:00:00'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleClearAllData}
            testID="air-trash-button"
            style={({ pressed }) => [
              styles.headerButton,
              styles.headerButtonRight,
              {
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.15)' : colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        <View style={styles.listSection}>
          {standardRotas.map((rota) => (
            <RotaCard
              key={rota.id}
              colors={colors}
              now={now}
              onActionPress={handleActionPress}
              onBottlePress={handleBottlePress}
              onClearPress={handleClearPress}
              onControlPress={handleControlPress}
              onCustomPressurePress={handleOpenInitialPressureModal}
              onFirefighterPress={handleOpenNameModal}
              onRestorePress={handleRestorePress}
              onTitlePress={handleOpenLabelModal}
              onSelectPressure={(rotaId, pressure) => updateRota(rotaId, (currentRota) => ({ ...currentRota, selectedPressure: pressure }))}
              onToggleExpanded={handleToggleExpanded}
              rota={rota}
              hasLowPressureAlert={rotasWithLowPressureAlert.includes(rota.id)}
            />
          ))}

          <Pressable
            onPress={handleAddRota}
            style={({ pressed }) => [styles.addRotaRow, { opacity: pressed ? 0.82 : 1 }]}
          >
            <View style={[styles.addCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.addPlus, { color: colors.text }]}>+</Text>
            </View>
            <Text style={[styles.addText, { color: colors.text }]}>Dodaj rotę</Text>
          </Pressable>

          {ritRotas.map((rota) => (
            <RotaCard
              key={rota.id}
              colors={colors}
              now={now}
              onActionPress={handleActionPress}
              onBottlePress={handleBottlePress}
              onClearPress={handleClearPress}
              onControlPress={handleControlPress}
              onCustomPressurePress={handleOpenInitialPressureModal}
              onFirefighterPress={handleOpenNameModal}
              onRestorePress={handleRestorePress}
              onTitlePress={handleOpenLabelModal}
              onSelectPressure={(rotaId, pressure) => updateRota(rotaId, (currentRota) => ({ ...currentRota, selectedPressure: pressure }))}
              onToggleExpanded={handleToggleExpanded}
              rota={rota}
              hasLowPressureAlert={rotasWithLowPressureAlert.includes(rota.id)}
            />
          ))}

          <View style={styles.ritSpacer} />

          <View style={styles.ritRow}>
            <View style={[styles.ritCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.ritLabel, { color: colors.text }]}>Rota RIT</Text>
            </View>

            <Pressable
              onPress={handleActivateRit}
              style={({ pressed }) => [styles.ritActivateButton, { backgroundColor: colors.buttonRed, opacity: pressed ? 0.84 : 1 }]}
            >
              <Text style={styles.ritActivateText}>Aktywuj</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <InputModal
        colors={colors}
        keyboardType={inputModal?.type === 'name' ? 'default' : 'numeric'}
        onChangeValue={setInputDraft}
        onClose={closeInputModal}
        onSave={handleSaveInput}
        placeholder={inputModal?.type === 'name' ? 'Wpisz nazwę' : inputModal?.type === 'bottle' ? 'np. 6,8' : 'np. 300'}
        subtitle={
          inputModal?.type === 'name'
            ? 'Wpisz nazwę ratownika.'
            : inputModal?.type === 'bottle'
              ? 'Podaj pojemność w litrach.'
              : 'Podaj ciśnienie początkowe w barach.'
        }
        title={inputModal?.title ?? ''}
        value={inputDraft}
        visible={Boolean(inputModal)}
      />

      <PressureModal
        colors={colors}
        initialValue={controlModal?.initialValue ?? 270}
        onClose={() => setControlModal(null)}
        onSave={handleSaveControl}
        options={CONTROL_PRESSURE_OPTIONS}
        title={controlModal ? 'Kontrola ciśnienia' : ''}
        visible={Boolean(controlModal)}
      />

      <BottleModal
        colors={colors}
        initialValue={bottleModal?.initialValue ?? 6.8}
        onClose={() => setBottleModal(null)}
        onSave={handleSaveBottleModal}
        visible={Boolean(bottleModal)}
      />

      <RotaLabelModal colors={colors} onClose={() => setLabelModal(null)} onSave={handleSaveLabelModal} visible={Boolean(labelModal)} />

      {/* Modal startu nowej akcji */}
      <Modal
        visible={showStartActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartActionModal(false)}
      >
        <Pressable 
          style={styles.startActionModalOverlay}
          onPress={() => setShowStartActionModal(false)}
        >
          <Pressable 
            style={[styles.startActionModalCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Ionicons name="time-outline" size={48} color={colors.buttonYellow} style={styles.startActionIcon} />
            <Text style={[styles.startActionTitle, { color: colors.text }]}>Rozpocznij nową akcję</Text>
            <Text style={[styles.startActionSubtitle, { color: colors.secondary }]}>
              Pomiar czasu start
            </Text>
            <Pressable
              onPress={handleStartAction}
              style={({ pressed }) => [
                styles.startActionButton,
                { backgroundColor: colors.buttonYellow, opacity: pressed ? 0.84 : 1 },
              ]}
            >
              <Text style={styles.startActionButtonText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerMainRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 52,
    position: 'relative',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  scrollArea: {
    flex: 1,
  },
  clockRowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  clockBar: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 52,
    maxWidth: 124,
    minWidth: 112,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clockRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  clockLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  clockText: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
    top: 4,
  },
  headerButtonLeft: {
    left: 0,
  },
  headerButtonRight: {
    right: 0,
  },
  listSection: {
    flex: 1,
    gap: 22,
  },
  ritSpacer: {
    flex: 1,
    minHeight: 24,
  },
  addRotaRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
  },
  addCircle: {
    alignItems: 'center',
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  addPlus: {
    fontSize: 52,
    fontWeight: '300',
    lineHeight: 56,
  },
  addText: {
    fontSize: 24,
    fontWeight: '500',
  },
  ritRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  ritCard: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 86,
    paddingHorizontal: 18,
  },
  ritLabel: {
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  ritActivateButton: {
    alignItems: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 86,
    width: 118,
  },
  ritActivateText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },
  // Style dla modalu startu akcji
  startActionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  startActionModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  startActionIcon: {
    marginBottom: 16,
  },
  startActionTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  startActionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  startActionButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  startActionButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
});
