/**
 * Race strategy and analysis types
 */
export interface StrategyRecommendation {
    timestamp: number;
    sessionTime: number;
    pitWindow: PitWindowRecommendation;
    fuelStrategy: FuelStrategyRecommendation;
    tireStrategy: TireStrategyRecommendation;
    paceAnalysis: PaceAnalysis;
    opportunities: StrategyOpportunity[];
}
export interface PitWindowRecommendation {
    optimal: {
        lapStart: number;
        lapEnd: number;
        sessionTime: number;
    };
    earliest: {
        lap: number;
        sessionTime: number;
    };
    latest: {
        lap: number;
        sessionTime: number;
    };
    currentStatus: 'early' | 'optimal' | 'late' | 'critical';
    reasoning: string[];
}
export interface FuelStrategyRecommendation {
    lapsRemaining: number;
    fuelRemaining: number;
    fuelNeeded: number;
    fuelToAdd: number;
    averageConsumption: number;
    canFinish: boolean;
    savingRequired: boolean;
    savingPercentage?: number;
    lapsUntilEmpty: number;
}
export interface TireStrategyRecommendation {
    currentStint: number;
    lapsOnTires: number;
    degradationRate: number;
    performanceLoss: number;
    recommendedStint: number;
    changeRecommended: boolean;
    reasoning: string[];
}
export interface PaceAnalysis {
    currentPace: number;
    averagePace: number;
    bestPace: number;
    consistency: number;
    trendDirection: 'improving' | 'stable' | 'degrading';
    deltaToLeader: number;
    deltaToClassLeader: number;
    predictedLapTime: number;
}
export interface StrategyOpportunity {
    type: OpportunityType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    actionRequired: string;
    timing: {
        window: {
            start: number;
            end: number;
        };
        optimal: number;
    };
    expectedGain?: number;
    risk?: string;
}
export declare enum OpportunityType {
    Undercut = "undercut",
    Overcut = "overcut",
    AlternatePitWindow = "alternate_pit_window",
    SafetyCar = "safety_car",
    FuelSaving = "fuel_saving",
    TireManagement = "tire_management",
    TrafficManagement = "traffic_management",
    WeatherChange = "weather_change"
}
export interface GapAnalysis {
    carIdx: number;
    carNumber: string;
    gap: number;
    gapChange: number;
    deltaLapTime: number;
    predictedGap: number;
    isGaining: boolean;
    estimatedLapsToPass?: number;
    estimatedLapsToLap?: number;
}
export interface UndercutAnalysis {
    targetCarIdx: number;
    targetCarNumber: string;
    currentGap: number;
    pitDelta: number;
    tyreDelta: number;
    predictedGainLoss: number;
    recommendedAction: 'pit_now' | 'wait' | 'not_viable';
    confidenceLevel: number;
    reasoning: string[];
}
//# sourceMappingURL=strategy.d.ts.map