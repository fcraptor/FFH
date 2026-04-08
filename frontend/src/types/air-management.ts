export type RotaKind = 'standard' | 'rit';
export type RotaState = 'ready' | 'active' | 'exited';

export interface ControlSnapshot {
  pressure: number;
  elapsedSeconds: number;
  timestamp: number;
}

export interface RotaRestoreSnapshot {
  label: string;
  kind: RotaKind;
  displayOrder: number;
  firefighters: [string, string];
  expanded: boolean;
  selectedPressure: number;
  bottleVolume: number;
  state: Exclude<RotaState, 'exited'>;
  entryTimestamp: number | null;
  exitDurationSeconds: number | null;
  lastControl: ControlSnapshot | null;
  consumptionRateBarPerMin: number | null;
  previousConsumptionRateLpm: number | null;
}

export interface Rota {
  id: string;
  label: string;
  kind: RotaKind;
  displayOrder: number;
  firefighters: [string, string];
  expanded: boolean;
  selectedPressure: number;
  bottleVolume: number;
  state: RotaState;
  entryTimestamp: number | null;
  exitDurationSeconds: number | null;
  lastControl: ControlSnapshot | null;
  consumptionRateBarPerMin: number | null;
  previousConsumptionRateLpm: number | null;
  restoreSnapshot: RotaRestoreSnapshot | null;
}

export interface AppTemplate {
  version: string;
  rotas: Rota[];
  createdAt: number;
  actionStartTimestamp: number;
}
