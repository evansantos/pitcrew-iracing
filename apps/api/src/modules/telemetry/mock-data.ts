import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';

/**
 * Mock Telemetry Data Generator
 *
 * Simulates realistic iRacing telemetry for development on non-Windows platforms.
 * Generates dynamic racing data including speed, RPM, lap times, and track position.
 */

interface MockRaceState {
  lapDistPct: number;
  currentLap: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  fuelLevel: number;
  lastLapTime: number;
  bestLapTime: number;
  isOnTrack: boolean;
}

export class MockTelemetryGenerator {
  private state: MockRaceState;
  private sessionStartTime: number;
  private trackLength: number = 4200; // meters
  private maxSpeed: number = 280; // km/h
  private lapCount: number = 0;

  constructor() {
    this.sessionStartTime = Date.now();
    this.state = {
      lapDistPct: 0,
      currentLap: 1,
      speed: 0,
      rpm: 800,
      gear: 0,
      throttle: 0,
      brake: 0,
      fuelLevel: 50,
      lastLapTime: 0,
      bestLapTime: 0,
      isOnTrack: true,
    };
  }

  /**
   * Generate the next telemetry frame (called at 60Hz)
   */
  generateFrame(): ProcessedTelemetry {
    this.updateState();

    const now = Date.now();
    const sessionTime = (now - this.sessionStartTime) / 1000;

    return {
      timestamp: now,
      sessionTime,

      player: {
        driverName: 'Mock Driver',
        carName: 'Mock Car',
        speed: Math.round(this.state.speed * 10) / 10,
        rpm: Math.round(this.state.rpm),
        gear: this.state.gear,
        throttle: Math.round(this.state.throttle * 100) / 100,
        brake: Math.round(this.state.brake * 100) / 100,
        lap: this.state.currentLap,
        lapDistPct: Math.round(this.state.lapDistPct * 10000) / 10000,
        currentLapTime: this.getCurrentLapTime(sessionTime),
        lastLapTime: this.state.lastLapTime,
        bestLapTime: this.state.bestLapTime,
        position: 3, // Mock position
        classPosition: 2,
        incidents: 0,
        oilTemp: 90,
        oilPress: 40,
        waterTemp: 85,
        waterLevel: 100,
        voltage: 13.8,
        engineWarnings: 0,
        manifoldPress: 1.0,
        push2PassStatus: false,
        push2PassCount: 0,
        dcBrakePct: 0,
        clutch: 0,
      },

      fuel: {
        level: Math.round(this.state.fuelLevel * 10) / 10,
        levelPct: Math.round((this.state.fuelLevel / 100) * 100),
        usePerHour: 15.5,
        lapsRemaining: Math.floor(this.state.fuelLevel / 2.5),
        tankCapacity: 100, // Mock tank capacity
      },

      tires: {
        lf: this.generateTireData(95, 0.92),
        rf: this.generateTireData(97, 0.90),
        lr: this.generateTireData(93, 0.94),
        rr: this.generateTireData(96, 0.91),
      },

      track: {
        name: 'Mock Track',
        temperature: 32 + Math.sin(sessionTime / 100) * 2,
        airTemp: 25 + Math.sin(sessionTime / 150) * 1,
        windSpeed: 5 + Math.random() * 2,
        windDirection: 180 + Math.sin(sessionTime / 80) * 30,
        humidity: 45 + Math.random() * 5,
      },

      session: {
        state: 4, // Racing
        flags: 4, // Green flag
        timeRemaining: 3600 - sessionTime,
        lapsRemaining: 25 - this.state.currentLap,
      },

      opponents: this.generateOpponents(sessionTime),

      damage: this.generateDamage(),
    };
  }

  /**
   * Update the internal race state
   */
  private updateState(): void {
    // Simulate lap progression (about 90 seconds per lap)
    const lapSpeed = 0.00018; // Progress per frame at 60Hz
    this.state.lapDistPct += lapSpeed;

    // Complete lap
    if (this.state.lapDistPct >= 1.0) {
      this.completeLap();
      this.state.lapDistPct = 0;
      this.state.currentLap++;
    }

    // Simulate speed based on track position
    const throttleZones = this.getThrottleForTrackPosition(this.state.lapDistPct);
    this.state.throttle = throttleZones.throttle;
    this.state.brake = throttleZones.brake;

    // Update speed (smooth acceleration/braking)
    const targetSpeed = this.maxSpeed * this.state.throttle;
    this.state.speed += (targetSpeed - this.state.speed) * 0.1;

    // Apply braking
    if (this.state.brake > 0) {
      this.state.speed *= 1 - this.state.brake * 0.15;
    }

    // Update RPM based on speed and gear
    this.updateGearAndRPM();

    // Fuel consumption (very basic)
    this.state.fuelLevel -= 0.0004;
  }

  /**
   * Get throttle and brake positions for track position
   */
  private getThrottleForTrackPosition(lapPct: number): { throttle: number; brake: number } {
    // Simulate a track with corners and straights
    // Corners at: 0.2, 0.4, 0.6, 0.8
    const corners = [0.15, 0.35, 0.55, 0.75];
    const cornerWidth = 0.08;

    for (const corner of corners) {
      const distToCorner = Math.abs(lapPct - corner);
      if (distToCorner < cornerWidth) {
        // In corner - reduce throttle, apply brake
        const cornerIntensity = 1 - distToCorner / cornerWidth;
        return {
          throttle: 0.3 + (1 - cornerIntensity) * 0.4,
          brake: cornerIntensity * 0.8,
        };
      }
    }

    // On straight - full throttle
    return { throttle: 0.95 + Math.random() * 0.05, brake: 0 };
  }

  /**
   * Update gear and RPM based on speed
   */
  private updateGearAndRPM(): void {
    const speed = this.state.speed;

    // Simple gear calculation
    if (speed < 30) {
      this.state.gear = 1;
      this.state.rpm = 800 + speed * 200;
    } else if (speed < 70) {
      this.state.gear = 2;
      this.state.rpm = 3000 + (speed - 30) * 100;
    } else if (speed < 120) {
      this.state.gear = 3;
      this.state.rpm = 4000 + (speed - 70) * 80;
    } else if (speed < 170) {
      this.state.gear = 4;
      this.state.rpm = 5000 + (speed - 120) * 60;
    } else if (speed < 220) {
      this.state.gear = 5;
      this.state.rpm = 6000 + (speed - 170) * 40;
    } else {
      this.state.gear = 6;
      this.state.rpm = 7000 + (speed - 220) * 20;
    }

    // Cap RPM
    this.state.rpm = Math.min(this.state.rpm, 8500);
  }

  /**
   * Complete a lap and record times
   */
  private completeLap(): void {
    // Generate realistic lap time (88-92 seconds)
    const baseLapTime = 90;
    const variation = (Math.random() - 0.5) * 4;
    const lapTime = baseLapTime + variation;

    this.state.lastLapTime = Math.round(lapTime * 1000) / 1000;

    // Update best lap
    if (this.state.bestLapTime === 0 || lapTime < this.state.bestLapTime) {
      this.state.bestLapTime = Math.round(lapTime * 1000) / 1000;
    }

    this.lapCount++;
  }

  /**
   * Get current lap time
   */
  private getCurrentLapTime(sessionTime: number): number {
    const lapStartTime = sessionTime - this.state.lapDistPct * 90;
    return sessionTime - lapStartTime;
  }

  /**
   * Generate tire data
   */
  private generateTireData(baseTemp: number, wear: number) {
    const tempVariation = (Math.random() - 0.5) * 4;
    return {
      tempL: baseTemp + tempVariation,
      tempM: baseTemp + tempVariation + 2,
      tempR: baseTemp + tempVariation,
      wearL: wear - Math.random() * 0.02,
      wearM: wear - Math.random() * 0.03,
      wearR: wear - Math.random() * 0.02,
      avgTemp: baseTemp,
      avgWear: wear,
    };
  }

  /**
   * Generate mock opponent data
   */
  private generateOpponents(sessionTime: number) {
    const opponentNames = [
      { name: 'Max Verstappen', number: '1', class: 'GT3' },
      { name: 'Lewis Hamilton', number: '44', class: 'GT3' },
      { name: 'Charles Leclerc', number: '16', class: 'GT3' },
      { name: 'Lando Norris', number: '4', class: 'GT3' },
      { name: 'George Russell', number: '63', class: 'GT3' },
      { name: 'Carlos Sainz', number: '55', class: 'GT3' },
    ];

    const playerLap = this.state.currentLap;
    const playerLapPct = this.state.lapDistPct;
    const playerBestLap = this.state.bestLapTime || 90;

    return opponentNames.map((opponent, idx) => {
      // Generate positions around player (player is P3)
      const position = idx < 2 ? idx + 1 : idx + 2; // Skip position 3 (player)

      // Calculate lap offset from player
      const lapOffset = position === 1 ? 0.5 : position === 2 ? 0.2 : -(position - 3) * 0.15;
      let opponentLap = playerLap;
      let opponentLapPct = playerLapPct + lapOffset;

      // Adjust lap if needed
      if (opponentLapPct >= 1.0) {
        opponentLap++;
        opponentLapPct -= 1.0;
      } else if (opponentLapPct < 0) {
        opponentLap--;
        opponentLapPct += 1.0;
      }

      // Generate lap times with variation
      const skillFactor = (7 - position) * 0.3; // Better drivers have lower lap times
      const bestLapTime = playerBestLap - skillFactor + Math.random() * 0.5;
      const lastLapTime = bestLapTime + Math.random() * 2;

      // Calculate gaps
      const totalGapToPlayer = (playerLap - opponentLap) + (playerLapPct - opponentLapPct);
      const gapToPlayer = totalGapToPlayer * 90; // Convert to seconds (90s lap)

      return {
        carIdx: idx,
        driverName: opponent.name,
        carNumber: opponent.number,
        carClass: opponent.class,
        lap: Math.max(1, opponentLap),
        lapDistPct: Math.max(0, Math.min(1, opponentLapPct)),
        position,
        classPosition: position,
        lastLapTime,
        bestLapTime,
        estimatedLapTime: bestLapTime + 0.5,
        gapToPlayer,
        gapToLeader: position === 1 ? 0 : (position - 1) * 15,
        isOnPitRoad: false,
        pitStopCount: 0,
        trackSurface: 3, // OnTrack
      };
    });
  }

  /**
   * Generate mock damage data (mostly no damage, occasionally some minor damage)
   */
  private generateDamage() {
    // Generate very light random damage (0-5% typically)
    // This simulates normal racing contact/wear
    const randomDamage = () => Math.random() * 0.05;

    return {
      lf: randomDamage(),
      rf: randomDamage(),
      lr: randomDamage(),
      rr: randomDamage(),
    };
  }

  /**
   * Reset the generator
   */
  reset(): void {
    this.sessionStartTime = Date.now();
    this.state = {
      lapDistPct: 0,
      currentLap: 1,
      speed: 0,
      rpm: 800,
      gear: 0,
      throttle: 0,
      brake: 0,
      fuelLevel: 50,
      lastLapTime: 0,
      bestLapTime: 0,
      isOnTrack: true,
    };
    this.lapCount = 0;
  }
}

// Singleton instance
export const mockTelemetryGenerator = new MockTelemetryGenerator();
