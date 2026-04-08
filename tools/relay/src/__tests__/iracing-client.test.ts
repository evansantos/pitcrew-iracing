import { describe, it, expect } from 'vitest';
import { transformTelemetry } from '../iracing-client.js';
import type { IRacingRawTelemetry } from '../types.js';

describe('transformTelemetry', () => {
  it('converts speed from m/s to km/h', () => {
    const raw: IRacingRawTelemetry = { Speed: 50 }; // 50 m/s = 180 km/h
    const result = transformTelemetry(raw);
    expect(result.player.speed).toBeCloseTo(180, 0);
  });

  it('returns 0 speed when Speed is null', () => {
    const result = transformTelemetry({});
    expect(result.player.speed).toBe(0);
  });

  it('returns 0 speed when Speed is undefined', () => {
    const result = transformTelemetry({ Speed: undefined });
    expect(result.player.speed).toBe(0);
  });

  it('scales FuelLevelPct from 0-1 to 0-100', () => {
    const result = transformTelemetry({ FuelLevelPct: 0.75 });
    expect(result.fuel.levelPct).toBeCloseTo(75, 0);
  });

  it('scales RelativeHumidity from 0-1 to 0-100', () => {
    const result = transformTelemetry({ RelativeHumidity: 0.55 });
    expect(result.track.humidity).toBeCloseTo(55, 0);
  });

  it('estimates fuel laps remaining correctly', () => {
    // FuelUsePerHour=3.6, LapLastLapTime=100s => fuelPerLap = (3.6/3600)*100 = 0.1
    // FuelLevel=1.0 => lapsRemaining = 1.0 / 0.1 = 10
    const result = transformTelemetry({
      FuelLevel: 1.0,
      FuelUsePerHour: 3.6,
      LapLastLapTime: 100,
    });
    expect(result.fuel.lapsRemaining).toBe(10);
  });

  it('returns 0 fuel laps remaining when lastLapTime is 0', () => {
    const result = transformTelemetry({
      FuelLevel: 10,
      FuelUsePerHour: 3.6,
      LapLastLapTime: 0,
    });
    expect(result.fuel.lapsRemaining).toBe(0);
  });

  it('returns 0 fuel laps remaining when FuelUsePerHour is 0', () => {
    const result = transformTelemetry({
      FuelLevel: 10,
      FuelUsePerHour: 0,
      LapLastLapTime: 90,
    });
    expect(result.fuel.lapsRemaining).toBe(0);
  });

  it('passes through gear, lap, position values', () => {
    const result = transformTelemetry({ Gear: 4, Lap: 7, Position: 3 });
    expect(result.player.gear).toBe(4);
    expect(result.player.lap).toBe(7);
    expect(result.player.position).toBe(3);
  });

  it('defaults all fields safely when given empty input', () => {
    const result = transformTelemetry({});
    expect(result.player.speed).toBe(0);
    expect(result.player.rpm).toBe(0);
    expect(result.player.gear).toBe(0);
    expect(result.fuel.level).toBe(0);
    expect(result.fuel.lapsRemaining).toBe(0);
    expect(result.tires.lf.temp).toBe(0);
    expect(result.track.temperature).toBe(20);
    expect(result.track.humidity).toBe(50);
    expect(result.session.state).toBe(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});
