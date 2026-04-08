import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Rota } from '../../types/air-management';
import { formatDuration, getCardStatus, getElapsedSeconds, getForecast, INITIAL_PRESSURE_OPTIONS, isPresetInitialPressure, PAL } from '../../utils/air-management';

interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  secondary: string;
  border: string;
  input: string;
  buttonGray: string;
  buttonYellow: string;
  buttonRed: string;
  tile: string;
  clockBar: string;
  ready: string;
  safe: string;
  warning: string;
  danger: string;
  critical: string;
}

interface RotaCardProps {
  rota: Rota;
  now: number;
  colors: ThemeColors;
  onTitlePress: (rota: Rota) => void;
  onToggleExpanded: (rotaId: string) => void;
  onActionPress: (rota: Rota) => void;
  onControlPress: (rota: Rota) => void;
  onSelectPressure: (rotaId: string, pressure: number) => void;
  onCustomPressurePress: (rota: Rota) => void;
  onBottlePress: (rota: Rota) => void;
  onFirefighterPress: (rota: Rota, firefighterIndex: 0 | 1) => void;
  onClearPress: (rota: Rota) => void;
  onRestorePress: (rota: Rota) => void;
}

export function RotaCard({
  rota,
  now,
  colors,
  onTitlePress,
  onToggleExpanded,
  onActionPress,
  onControlPress,
  onSelectPressure,
  onCustomPressurePress,
  onBottlePress,
  onFirefighterPress,
  onClearPress,
  onRestorePress,
}: RotaCardProps) {
  const forecast = getForecast(rota, now);
  const status = getCardStatus(rota, now);
  const elapsedSeconds = rota.state === 'exited' ? rota.exitDurationSeconds ?? 0 : getElapsedSeconds(rota.entryTimestamp, now);
  const timerText = rota.state === 'ready' ? '00:00' : formatDuration(elapsedSeconds);
  const cardBackground =
    status === 'ready'
      ? colors.ready
      : status === 'safe'
        ? colors.safe
        : status === 'warning'
          ? colors.warning
          : status === 'danger'
            ? colors.danger
            : status === 'critical'
              ? colors.critical
              : colors.background;
  const contentTextColor = status === 'exited' ? colors.text : '#000000';
  const actionLabel = rota.state === 'ready' ? 'WEJŚCIE' : 'Wyjście';
  const actionButtonColor = rota.state === 'ready' ? colors.buttonYellow : colors.buttonGray;
  const titleTextColor = rota.kind === 'rit' ? '#FFFFFF' : contentTextColor;
  const bottleText = `Butla ${rota.bottleVolume.toFixed(1).replace('.', ',')}`;
  const currentUsageLpm = rota.state === 'active'
    ? rota.lastControl && rota.consumptionRateBarPerMin
      ? Math.round(rota.consumptionRateBarPerMin * rota.bottleVolume)
      : 50
    : null;
  const usageDiff = currentUsageLpm !== null && rota.previousConsumptionRateLpm !== null ? currentUsageLpm - rota.previousConsumptionRateLpm : 0;
  const trendIcon = currentUsageLpm !== null && currentUsageLpm > 100
    ? 'chevron-double-up'
    : usageDiff > 10
      ? 'arrow-up'
      : usageDiff < -10
        ? 'arrow-down'
        : 'arrow-right';
  const trendColor = '#000000';
  const remainingForStatus = Math.max(0, Math.min(30, forecast.remainingMinutes ?? 0));
  const firefighterProgress = 1 - remainingForStatus / 30;

  if (rota.state === 'exited') {
    return (
      <View style={styles.cardRow} testID={`rota-card-${rota.id}`}>
        <View style={[styles.exitedCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.exitedTextWrap}>
            <Text style={[styles.exitedTitle, { color: colors.text }]}>{rota.label} Opuściła strefę</Text>
            <Text style={[styles.exitedDuration, { color: colors.buttonYellow }]}>Czas pracy w strefie {formatDuration(rota.exitDurationSeconds ?? 0)}</Text>
          </View>

          <View style={styles.exitedActions}>
            <Pressable
              onPress={() => onRestorePress(rota)}
              style={({ pressed }) => [styles.clearButton, { backgroundColor: colors.buttonYellow, opacity: pressed ? 0.84 : 1 }]}
              testID={`restore-button-${rota.id}`}
            >
              <Text style={styles.clearButtonText}>Powrót</Text>
            </Pressable>
            <Pressable
              onPress={() => onClearPress(rota)}
              style={({ pressed }) => [styles.clearButton, { backgroundColor: colors.buttonGray, opacity: pressed ? 0.84 : 1 }]}
              testID={`clear-button-${rota.id}`}
            >
              <Text style={styles.clearButtonText}>Wyczyść</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.cardRow} testID={`rota-card-${rota.id}`}>
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          {rota.state === 'active' ? (
            <View style={styles.statusTrack}>
              <View style={[styles.statusSegment, { backgroundColor: colors.safe, flex: 3 }]} />
              <View style={[styles.statusSegment, { backgroundColor: colors.warning, flex: 1 }]} />
              <View style={[styles.statusSegment, { backgroundColor: colors.danger, flex: 1 }]} />
              <View style={[styles.statusSegment, { backgroundColor: colors.critical, flex: 1 }]} />
              <MaterialCommunityIcons
                color="#000000"
                name="account-hard-hat"
                size={16}
                style={[styles.firefighterMarker, { left: `${Math.max(0, Math.min(100, firefighterProgress * 100))}%` }]}
              />
            </View>
          ) : null}

          <View style={styles.topRow}>
            <View style={styles.timerCell}>
              <Text style={[styles.controlTimer, { color: contentTextColor }]}>{timerText}</Text>
            </View>

            <View style={styles.titleCell}>
              <Pressable
                onPress={() => onTitlePress(rota)}
                style={({ pressed }) => [
                  styles.titleBadge,
                  rota.kind === 'rit' ? { backgroundColor: colors.buttonRed, borderColor: '#000000' } : { borderColor: '#000000' },
                  { opacity: pressed ? 0.84 : 1 },
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={1}
                  style={[styles.titleText, { color: titleTextColor, fontWeight: rota.kind === 'rit' ? '900' : '800' }]}
                >
                  {rota.label}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.controlCell}>
              <Pressable
                onPress={() => onControlPress(rota)}
                style={({ pressed }) => [styles.controlButton, { backgroundColor: colors.buttonGray, opacity: pressed ? 0.82 : 1 }]}
                testID={`control-button-${rota.id}`}
              >
                {rota.lastControl ? (
                  <>
                    <Text style={styles.controlResultText}>{formatDuration(rota.lastControl.elapsedSeconds)}</Text>
                    <Text style={styles.controlResultText}>{rota.lastControl.pressure} bar</Text>
                  </>
                ) : (
                  <Text style={styles.controlLabel}>Kontrola</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.forecastCell} testID={`forecast-text-${rota.id}`}>
              {forecast.usageText ? (
                <View style={styles.usageRow}>
                  <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.forecastUsage, { color: contentTextColor }]}>
                    {forecast.usageText}
                  </Text>
                  <MaterialCommunityIcons color={trendColor} name={trendIcon as any} size={16} />
                </View>
              ) : null}
              <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.forecastMain, { color: contentTextColor }]}>
                {forecast.pressureText}
              </Text>
              {forecast.timeText ? (
                <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.forecastMain, { color: contentTextColor }]}>
                  {forecast.timeText}
                </Text>
              ) : null}
              {forecast.hintText ? (
                <Text numberOfLines={2} style={[styles.forecastHint, { color: contentTextColor }]}>
                  {forecast.hintText}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={() => onToggleExpanded(rota.id)}
            style={({ pressed }) => [styles.arrowStrip, { borderColor: '#1E1E1E', opacity: pressed ? 0.84 : 1 }]}
            testID={`toggle-panel-${rota.id}`}
          >
            <Text style={styles.arrowText}>{rota.expanded ? '▲' : '▼'}</Text>
          </Pressable>
        </View>

        <View style={styles.sideColumn}>
          {rota.state === 'ready' ? (
            <Pressable
              onPress={() => onBottlePress(rota)}
              style={({ pressed }) => [styles.sideBottleButton, { backgroundColor: '#FFFFFF', opacity: pressed ? 0.84 : 1 }]}
              testID={`bottle-button-${rota.id}`}
            >
              <Text style={styles.bottleText}>{bottleText}</Text>
            </Pressable>
          ) : (
            <View style={styles.sideBottleSpacer} />
          )}

          <Pressable
            onPress={() => onActionPress(rota)}
            style={({ pressed }) => [styles.actionButton, rota.state === 'ready' ? styles.readyActionButton : styles.activeActionButton, { backgroundColor: actionButtonColor, opacity: pressed ? 0.84 : 1 }]}
            testID={`action-button-${rota.id}`}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>

      {rota.expanded ? (
        <View style={[styles.firefighterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`firefighter-panel-${rota.id}`}>
          <Pressable
            onPress={() => onFirefighterPress(rota, 0)}
            style={({ pressed }) => [styles.firefighterButton, { borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}
            testID={`firefighter-1-${rota.id}`}
          >
            <Text style={[styles.firefighterText, { color: colors.text }]} numberOfLines={1}>
              {rota.firefighters[0]}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onFirefighterPress(rota, 1)}
            style={({ pressed }) => [styles.firefighterButton, { borderColor: colors.border, opacity: pressed ? 0.84 : 1 }]}
            testID={`firefighter-2-${rota.id}`}
          >
            <Text style={[styles.firefighterText, { color: colors.text }]} numberOfLines={1}>
              {rota.firefighters[1]}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {rota.state === 'ready' ? (
        <View style={styles.selectorRow} testID={`pressure-selector-${rota.id}`}>
          <Pressable
            onPress={() => onCustomPressurePress(rota)}
            style={({ pressed }) => [
              styles.selectorTile,
              {
                backgroundColor: colors.input,
                borderColor: !isPresetInitialPressure(rota.selectedPressure) ? colors.buttonYellow : colors.border,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
            testID={`initial-pressure-${rota.id}-custom`}
          >
            <Text style={[styles.selectorText, { color: colors.text }]}>wpisz</Text>
          </Pressable>

          {INITIAL_PRESSURE_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => onSelectPressure(rota.id, option)}
              style={({ pressed }) => [
                styles.selectorTile,
                {
                  backgroundColor: colors.input,
                  borderColor: rota.selectedPressure === option ? colors.buttonYellow : colors.border,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
              testID={`initial-pressure-${rota.id}-${option}`}
            >
              <Text style={[styles.selectorText, { color: colors.text }]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {rota.state === 'active' && forecast.alarmReached ? (
        <Text style={[styles.alertText, { color: colors.buttonRed }]}>Ciśnienie osiągnęło poziom alarmowy {PAL} bar.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    borderRadius: 30,
    flex: 1,
    minHeight: 150,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 8,
  },
  statusTrack: {
    borderColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 12,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  statusSegment: {
    height: '100%',
  },
  firefighterMarker: {
    marginLeft: -8,
    position: 'absolute',
    top: -2,
  },
  topRow: {
    flexDirection: 'row',
    minHeight: 32,
  },
  timerCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  titleCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  titleBadge: {
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '88%',
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  titleText: {
    fontSize: 17,
    lineHeight: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  bottleText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  controlCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  controlButton: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 10,
    width: 110,
  },
  controlTimer: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  controlLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  controlResultText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  forecastCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  forecastMain: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 21,
  },
  forecastUsage: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  usageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  forecastHint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  arrowStrip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    marginTop: 6,
  },
  arrowText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  sideColumn: {
    gap: 8,
    width: 82,
  },
  sideBottleButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sideBottleSpacer: {
    height: 0,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: 82,
  },
  readyActionButton: {
    minHeight: 104,
  },
  activeActionButton: {
    minHeight: 150,
  },
  actionText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  firefighterPanel: {
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  firefighterButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  firefighterText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  selectorTile: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 8,
    width: '23%',
  },
  selectorText: {
    fontSize: 17,
    fontWeight: '700',
  },
  exitedCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exitedTextWrap: {
    flex: 1,
    gap: 4,
  },
  exitedActions: {
    gap: 8,
  },
  exitedTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  exitedDuration: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 108,
    paddingHorizontal: 14,
  },
  clearButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  alertText: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
});
