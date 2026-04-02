import { describe, it, expect } from 'vitest';
import { parseStoFile, diffSetups } from '../index.js';

const SAMPLE_STO = `
[TiresAero]
TireCompound=Medium
LeftFrontPressure=172.4
RightFrontPressure=172.4
LeftRearPressure=158.6
RightRearPressure=158.6
FrontAntiRollBar=3
RearAntiRollBar=2
RearWing=45

[Chassis]
BallastForward=0
FuelLevel=50.0
CrossWeight=50.0

[Suspension]
LeftFrontCornerWeight=2500
RightFrontCornerWeight=2500
FrontRideHeight=55
RearRideHeight=70
LeftFrontCamber=-3.5
RightFrontCamber=-3.5
`;

describe('Setup Parser', () => {
  describe('parseStoFile', () => {
    it('parses INI-like .sto format', () => {
      const setup = parseStoFile(SAMPLE_STO);

      expect(setup.TiresAero).toBeDefined();
      expect(setup.TiresAero.TireCompound).toBe('Medium');
      expect(setup.TiresAero.LeftFrontPressure).toBe('172.4');
      expect(setup.Chassis).toBeDefined();
      expect(setup.Chassis.FuelLevel).toBe('50.0');
    });

    it('handles empty input', () => {
      const setup = parseStoFile('');
      expect(Object.keys(setup)).toHaveLength(0);
    });
  });

  describe('diffSetups', () => {
    it('returns empty diff for identical setups', () => {
      const setup = parseStoFile(SAMPLE_STO);
      const diff = diffSetups(setup, setup);

      expect(diff).toHaveLength(0);
    });

    it('detects changed values', () => {
      const setupA = parseStoFile(SAMPLE_STO);
      const setupB = parseStoFile(SAMPLE_STO.replace('172.4', '175.0'));

      const diff = diffSetups(setupA, setupB);
      const pressureChange = diff.find(d => d.key === 'LeftFrontPressure');
      expect(pressureChange).toBeDefined();
      expect(pressureChange!.valueA).toBe('172.4');
      expect(pressureChange!.valueB).toBe('175.0');
    });

    it('groups changes by category', () => {
      const setupA = parseStoFile(SAMPLE_STO);
      const modSto = SAMPLE_STO
        .replace('LeftFrontPressure=172.4', 'LeftFrontPressure=175.0')
        .replace('FrontRideHeight=55', 'FrontRideHeight=60');
      const setupB = parseStoFile(modSto);

      const diff = diffSetups(setupA, setupB);
      const categories = new Set(diff.map(d => d.category));
      expect(categories.has('TiresAero')).toBe(true);
      expect(categories.has('Suspension')).toBe(true);
    });
  });
});
