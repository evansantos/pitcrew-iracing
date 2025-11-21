/**
 * Strategy Engine Types
 * Defines interfaces and types for race strategy calculations
 */

export interface LapData {
  lapNumber: number;
  lapTime: number;
  fuelUsed: number;
  fuelRemaining: number;
  isValidLap: boolean;
  sector1Time?: number;
  sector2Time?: number;
  sector3Time?: number;
  avgTireTemp?: number;
  avgTireWear?: number;
  position: number;
  timestamp: Date;
}

export interface SessionContext {
  sessionId: string;
  trackName: string;
  carName: string;
  sessionType: 'practice' | 'qualify' | 'race';
  totalLaps: number;
  currentLap: number;
  sessionTimeRemaining: number;
  fuelCapacity: number;
  tankCapacity: number;
}

export interface PitWindowRecommendation {
  optimalLap: number;
  windowStart: number;
  windowEnd: number;
  reason: string;
  expectedGain: number; // seconds
  confidence: number; // 0-1
  type: 'fuel' | 'tire' | 'undercut' | 'overcut' | 'damage';
}

export interface FuelStrategy {
  requiredFuel: number;
  currentFuel: number;
  fuelPerLap: number;
  lapsRemaining: number;
  refuelRequired: boolean;
  refuelAmount: number;
  safetySafetyMargin: number;
  estimatedPitLap: number;
}

export interface TireDegradation {
  currentWear: number; // 0-1 scale
  currentTemp: number;
  optimalTemp: number;
  degradationRate: number; // per lap
  estimatedLapsRemaining: number;
  performance: number; // 0-1 scale
}

export interface UndercutAnalysis {
  isViable: boolean;
  targetCarIdx: number;
  targetDriverName: string;
  gapToTarget: number; // seconds
  estimatedGainPerLap: number;
  recommendedLap: number;
  confidence: number;
}

export interface OvercutAnalysis {
  isViable: boolean;
  targetCarIdx: number;
  targetDriverName: string;
  gapToTarget: number;
  additionalLapsOnCurrentTires: number;
  estimatedGainPerLap: number;
  recommendedLap: number;
  confidence: number;
}

export interface GapAnalysis {
  carIdx: number;
  driverName: string;
  position: number;
  gapToPlayer: number; // seconds
  gapTrend: 'closing' | 'opening' | 'stable';
  gapChangeRate: number; // seconds per lap
  lastLapTime: number;
  bestLapTime: number;
}

export interface StrategyRecommendation {
  id: string;
  type: 'pit_window' | 'fuel' | 'tire' | 'undercut' | 'overcut' | 'damage';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  optimalLap?: number;
  windowStart?: number;
  windowEnd?: number;
  expectedGain?: number;
  confidence: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface StrategyState {
  sessionContext: SessionContext;
  currentLap: LapData;
  recentLaps: LapData[];
  fuelStrategy: FuelStrategy;
  tireDegradation: TireDegradation;
  pitWindow: PitWindowRecommendation | null;
  undercut: UndercutAnalysis | null;
  overcut: OvercutAnalysis | null;
  gapAnalysis: GapAnalysis[];
  recommendations: StrategyRecommendation[];
  lastUpdated: Date;
}
