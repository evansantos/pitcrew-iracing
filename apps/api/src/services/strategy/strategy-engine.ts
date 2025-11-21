/**
 * Strategy Engine Service
 * Orchestrates all strategy calculations and generates recommendations
 */

import { randomUUID } from 'crypto';
import type {
  LapData,
  SessionContext,
  StrategyState,
  StrategyRecommendation,
  PitWindowRecommendation,
  GapAnalysis,
} from './types.js';
import { FuelCalculator } from './fuel-calculator.js';
import { TireAnalyzer } from './tire-analyzer.js';
import { UndercutAnalyzer } from './undercut-analyzer.js';

export class StrategyEngine {
  private fuelCalculator: FuelCalculator;
  private tireAnalyzer: TireAnalyzer;
  private undercutAnalyzer: UndercutAnalyzer;

  private readonly PIT_STOP_TIME_LOSS = 25; // seconds

  constructor() {
    this.fuelCalculator = new FuelCalculator();
    this.tireAnalyzer = new TireAnalyzer();
    this.undercutAnalyzer = new UndercutAnalyzer();
  }

  /**
   * Calculate comprehensive strategy state
   */
  calculateStrategy(
    sessionContext: SessionContext,
    currentLap: LapData,
    recentLaps: LapData[],
    gapAnalysis: GapAnalysis[],
    playerTireLaps: number = 0
  ): StrategyState {
    // Calculate fuel strategy
    const fuelStrategy = this.fuelCalculator.calculateFuelStrategy(
      recentLaps,
      sessionContext
    );

    // Analyze tire degradation
    const tireDegradation = this.tireAnalyzer.analyzeTireDegradation(recentLaps);

    // Calculate optimal pit window
    const pitWindow = this.calculatePitWindow(
      sessionContext,
      fuelStrategy,
      tireDegradation,
      currentLap.lapNumber
    );

    // Analyze undercut/overcut opportunities
    const undercut = this.undercutAnalyzer.analyzeUndercut(
      gapAnalysis,
      currentLap.lapNumber,
      playerTireLaps
    );

    const overcut = this.undercutAnalyzer.analyzeOvercut(
      gapAnalysis,
      currentLap.lapNumber,
      playerTireLaps
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      sessionContext,
      fuelStrategy,
      tireDegradation,
      pitWindow,
      undercut,
      overcut
    );

    return {
      sessionContext,
      currentLap,
      recentLaps,
      fuelStrategy,
      tireDegradation,
      pitWindow,
      undercut,
      overcut,
      gapAnalysis,
      recommendations,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate optimal pit window
   */
  private calculatePitWindow(
    context: SessionContext,
    fuelStrategy: any,
    tireDegradation: any,
    currentLap: number
  ): PitWindowRecommendation | null {
    const lapsRemaining = context.totalLaps - currentLap;

    // Determine primary reason for pit stop
    let type: 'fuel' | 'tire' | 'undercut' | 'overcut' | 'damage' = 'fuel';
    let optimalLap = 0;
    let windowStart = 0;
    let windowEnd = 0;
    let reason = '';
    let expectedGain = 0;

    // Check fuel requirements
    if (fuelStrategy.refuelRequired) {
      type = 'fuel';
      optimalLap = fuelStrategy.estimatedPitLap;
      windowStart = Math.max(currentLap + 1, optimalLap - 2);
      windowEnd = Math.min(context.totalLaps - 1, optimalLap + 2);
      reason = `Fuel stop required. Current: ${fuelStrategy.currentFuel.toFixed(1)}L, Need: ${fuelStrategy.refuelAmount.toFixed(1)}L`;
      expectedGain = 0; // Required stop, no gain
    }

    // Check tire condition
    const tireStint = this.tireAnalyzer.calculateStintStrategy(
      tireDegradation.currentWear,
      tireDegradation.degradationRate,
      lapsRemaining
    );

    if (!tireStint.canFinishOnCurrentTires) {
      type = 'tire';
      optimalLap = currentLap + tireStint.recommendedPitLap;
      windowStart = Math.max(currentLap + 1, optimalLap - 3);
      windowEnd = Math.min(context.totalLaps - 1, optimalLap + 2);
      reason = `Tire wear critical. Current: ${(tireDegradation.currentWear * 100).toFixed(0)}%, Performance: ${(tireDegradation.performance * 100).toFixed(0)}%`;

      // Calculate time gain from fresh tires
      const lapTimeGain = this.tireAnalyzer.calculateLapTimeDelta(
        tireDegradation.currentWear,
        90 // baseline lap time
      );
      expectedGain = lapTimeGain * (lapsRemaining - tireStint.recommendedPitLap) - this.PIT_STOP_TIME_LOSS;
    }

    // If both fuel and tires are fine, no pit needed
    if (!fuelStrategy.refuelRequired && tireStint.canFinishOnCurrentTires) {
      return null;
    }

    // Calculate confidence based on data quality
    const confidence = this.calculatePitWindowConfidence(
      fuelStrategy,
      tireDegradation,
      context.currentLap
    );

    return {
      optimalLap,
      windowStart,
      windowEnd,
      reason,
      expectedGain,
      confidence,
      type,
    };
  }

  /**
   * Generate strategy recommendations
   */
  private generateRecommendations(
    context: SessionContext,
    fuelStrategy: any,
    tireDegradation: any,
    pitWindow: PitWindowRecommendation | null,
    undercut: any,
    overcut: any
  ): StrategyRecommendation[] {
    const recommendations: StrategyRecommendation[] = [];

    // Pit window recommendation
    if (pitWindow) {
      const severity = this.determinePitSeverity(pitWindow, context.currentLap);
      recommendations.push({
        id: randomUUID(),
        type: 'pit_window',
        title: `Pit Window: Lap ${pitWindow.windowStart}-${pitWindow.windowEnd}`,
        description: pitWindow.reason,
        severity,
        optimalLap: pitWindow.optimalLap,
        windowStart: pitWindow.windowStart,
        windowEnd: pitWindow.windowEnd,
        expectedGain: pitWindow.expectedGain,
        confidence: pitWindow.confidence,
        createdAt: new Date(),
      });
    }

    // Fuel management recommendations
    if (fuelStrategy.refuelRequired) {
      const lapsUntilEmpty = this.fuelCalculator.estimateLapsRemaining(
        fuelStrategy.currentFuel,
        fuelStrategy.fuelPerLap
      );

      if (lapsUntilEmpty < 5) {
        recommendations.push({
          id: randomUUID(),
          type: 'fuel',
          title: 'Critical Fuel Warning',
          description: `Only ${lapsUntilEmpty} laps of fuel remaining. Pit immediately or save fuel.`,
          severity: 'critical',
          confidence: 0.95,
          createdAt: new Date(),
        });
      } else if (lapsUntilEmpty < 10) {
        recommendations.push({
          id: randomUUID(),
          type: 'fuel',
          title: 'Low Fuel Warning',
          description: `${lapsUntilEmpty} laps of fuel remaining. Plan pit stop soon.`,
          severity: 'high',
          confidence: 0.9,
          createdAt: new Date(),
        });
      }
    }

    // Tire recommendations
    if (tireDegradation.performance < 0.75) {
      recommendations.push({
        id: randomUUID(),
        type: 'tire',
        title: 'Tire Performance Degraded',
        description: `Tire performance at ${(tireDegradation.performance * 100).toFixed(0)}%. Consider pitting for fresh tires.`,
        severity: tireDegradation.performance < 0.6 ? 'high' : 'medium',
        confidence: 0.85,
        metadata: {
          currentWear: tireDegradation.currentWear,
          currentTemp: tireDegradation.currentTemp,
        },
        createdAt: new Date(),
      });
    }

    // Temperature recommendations
    const tempAnalysis = this.tireAnalyzer.analyzeTemperature(tireDegradation.currentTemp);
    if (tempAnalysis.status !== 'optimal') {
      recommendations.push({
        id: randomUUID(),
        type: 'tire',
        title: `Tire Temperature ${tempAnalysis.status === 'hot' ? 'High' : 'Low'}`,
        description: tempAnalysis.message,
        severity: tempAnalysis.status === 'hot' ? 'medium' : 'low',
        confidence: 0.8,
        createdAt: new Date(),
      });
    }

    // Undercut opportunity
    if (undercut?.isViable) {
      recommendations.push({
        id: randomUUID(),
        type: 'undercut',
        title: `Undercut Opportunity: ${undercut.targetDriverName}`,
        description: `Gap: ${undercut.gapToTarget.toFixed(1)}s. Pit on lap ${undercut.recommendedLap} for potential undercut.`,
        severity: 'medium',
        optimalLap: undercut.recommendedLap,
        expectedGain: undercut.estimatedGainPerLap * 3, // Gain over 3 laps
        confidence: undercut.confidence,
        metadata: {
          targetCarIdx: undercut.targetCarIdx,
          gapToTarget: undercut.gapToTarget,
        },
        createdAt: new Date(),
      });
    }

    // Overcut opportunity
    if (overcut?.isViable) {
      recommendations.push({
        id: randomUUID(),
        type: 'overcut',
        title: `Overcut Opportunity: ${overcut.targetDriverName}`,
        description: `Stay out ${overcut.additionalLapsOnCurrentTires} more laps to overcut ${overcut.targetDriverName}.`,
        severity: 'medium',
        optimalLap: overcut.recommendedLap,
        expectedGain: overcut.estimatedGainPerLap * overcut.additionalLapsOnCurrentTires,
        confidence: overcut.confidence,
        metadata: {
          targetCarIdx: overcut.targetCarIdx,
          additionalLaps: overcut.additionalLapsOnCurrentTires,
        },
        createdAt: new Date(),
      });
    }

    return recommendations.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Determine pit window severity
   */
  private determinePitSeverity(
    pitWindow: PitWindowRecommendation,
    currentLap: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const lapsUntilWindow = pitWindow.windowStart - currentLap;

    if (lapsUntilWindow <= 0) return 'critical'; // In or past pit window
    if (lapsUntilWindow <= 2) return 'high';
    if (lapsUntilWindow <= 5) return 'medium';
    return 'low';
  }

  /**
   * Calculate pit window confidence
   */
  private calculatePitWindowConfidence(
    fuelStrategy: any,
    tireDegradation: any,
    currentLap: number
  ): number {
    let confidence = 0.5;

    // More laps = more data = higher confidence
    if (currentLap > 10) confidence += 0.2;
    else if (currentLap > 5) confidence += 0.1;

    // Clear fuel requirement increases confidence
    if (fuelStrategy.refuelRequired) confidence += 0.15;

    // Clear tire degradation increases confidence
    if (tireDegradation.degradationRate > 0.015) confidence += 0.15;

    return Math.min(1, confidence);
  }
}
