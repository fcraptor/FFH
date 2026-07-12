import { AppTemplate, Rota } from '../types/air-management';

export const APP_TEMPLATE_STORAGE_KEY = 'air-management-default-template-v2';
export const PAL = 50;
export const DEFAULT_Q0 = 50;
export const DEFAULT_BOTTLE = 6.8;
export const INITIAL_PRESSURE_OPTIONS = [330, 320, 310, 300, 290, 280, 270];
export const CONTROL_PRESSURE_OPTIONS = Array.from({ length: 27 }, (_, index) => 300 - index * 10);

const createBaseRota = (label: string, displayOrder: number, kind: Rota['kind']): Rota => ({
  id: `${kind}-${displayOrder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label,
  kind,
  displayOrder,
  firefighters: ['Ratownik 1', 'Ratownik 2'],
  expanded: true,
  selectedPressure: 300,
  bottleVolume: DEFAULT_BOTTLE,
  state: 'ready',
  entryTimestamp: null,
  exitDurationSeconds: null,
  lastControl: null,
  consumptionRateBarPerMin: null,
  previousConsumptionRateLpm: null,
  restoreSnapshot: null,
});

export const createStandardRota = (displayOrder: number) =>
  createBaseRota(`ROTA ${displayOrder}`, displayOrder, 'standard');

export const createRitRota = (displayOrder: number) => ({
  ...createBaseRota(`ROTA RIT ${displayOrder}`, displayOrder, 'rit'),
  firefighters: ['Ratownik RIT 1', 'Ratownik RIT 2'] as [string, string],
});

export const createDefaultTemplate = (): AppTemplate => ({
  version: '1.0.0',
  createdAt: Date.now(),
  actionStartTimestamp: Date.now(),
  rotas: [createStandardRota(1)],
});

export const formatClock = (date: Date) =>
  [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');

export const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const formatClockDuration = (totalSeconds: number) => {
  const hours = Math.floor(Math.max(0, totalSeconds) / 3600);
  const minutes = Math.floor((Math.max(0, totalSeconds) % 3600) / 60);
  const seconds = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const getElapsedSeconds = (entryTimestamp: number | null, now: number) => {
  if (!entryTimestamp) {
    return 0;
  }
  return Math.max(0, Math.floor((now - entryTimestamp) / 1000));
};

export const getRemainingMinutes = (rota: Rota, now: number) => {
  if (rota.state !== 'active' || !rota.entryTimestamp) {
    return null;
  }

  const elapsedMinutes = (now - rota.entryTimestamp) / 60000;

  if (rota.lastControl && rota.consumptionRateBarPerMin && rota.consumptionRateBarPerMin > 0) {
    const minutesSinceControl = (now - rota.lastControl.timestamp) / 60000;
    const timeAtControl = (rota.lastControl.pressure - PAL) / rota.consumptionRateBarPerMin;
    return Math.max(0, timeAtControl - minutesSinceControl);
  }

  const plannedMinutes = ((rota.selectedPressure - PAL) * rota.bottleVolume) / DEFAULT_Q0;
  return Math.max(0, plannedMinutes - elapsedMinutes);
};

export const getForecast = (rota: Rota, now: number) => {
  if (rota.state === 'ready') {
    return {
      usageText: null,
      pressureText: '-/-',
      timeText: null,
      hintText: 'Szacunkowo',
      remainingMinutes: null,
      estimatedPressureValue: null,
      alarmReached: false,
    };
  }

  if (rota.state === 'exited' || !rota.entryTimestamp) {
    return {
      usageText: null,
      pressureText: null,
      timeText: null,
      hintText: null,
      remainingMinutes: null,
      estimatedPressureValue: null,
      alarmReached: false,
    };
  }

  const elapsedMinutes = (now - rota.entryTimestamp) / 60000;

  if (rota.lastControl && rota.consumptionRateBarPerMin && rota.consumptionRateBarPerMin > 0) {
    const minutesSinceControl = (now - rota.lastControl.timestamp) / 60000;
    const estimatedPressure = Math.max(0, rota.lastControl.pressure - minutesSinceControl * rota.consumptionRateBarPerMin);
    const remainingMinutes = getRemainingMinutes(rota, now);

    return {
      usageText: `${Math.round(rota.consumptionRateBarPerMin * rota.bottleVolume)} l/min`,
      pressureText: `~${Math.round(estimatedPressure)} bar`,
      timeText: `~${Math.round(remainingMinutes ?? 0)} min`,
      hintText: 'Szacunkowo',
      remainingMinutes,
      estimatedPressureValue: estimatedPressure,
      alarmReached: estimatedPressure <= PAL,
    };
  }

  const estimatedPressure = Math.max(0, rota.selectedPressure - (elapsedMinutes * DEFAULT_Q0) / rota.bottleVolume);
  const remainingMinutes = getRemainingMinutes(rota, now);

  return {
    usageText: `${DEFAULT_Q0} l/min`,
    pressureText: `~${Math.round(estimatedPressure)} bar`,
    timeText: `~${Math.round(remainingMinutes ?? 0)} min`,
    hintText: 'Szacunkowo',
    remainingMinutes,
    estimatedPressureValue: estimatedPressure,
    alarmReached: estimatedPressure <= PAL,
  };
};

export const getCardStatus = (rota: Rota, now: number) => {
  if (rota.state === 'ready') {
    return 'ready';
  }

  if (rota.state === 'exited') {
    return 'exited';
  }

  const remainingMinutes = getRemainingMinutes(rota, now) ?? 0;

  if (remainingMinutes < 5) {
    return 'critical';
  }

  if (remainingMinutes < 10) {
    return 'danger';
  }

  if (remainingMinutes <= 15) {
    return 'warning';
  }

  return 'safe';
};

export const isPresetInitialPressure = (value: number) => INITIAL_PRESSURE_OPTIONS.includes(value);
