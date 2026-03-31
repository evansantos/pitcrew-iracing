import type { ProcessedTelemetry, StrategyRecommendation } from '@iracing-race-engineer/shared';

export interface AdviceRequest {
  question: string;
  telemetry: ProcessedTelemetry;
  strategy?: StrategyRecommendation;
}

export interface AdviceResponse {
  advice: string;
  timestamp: string;
}

export interface AIStatusResponse {
  available: boolean;
  models: string[];
  error?: string;
  timestamp: string;
}
