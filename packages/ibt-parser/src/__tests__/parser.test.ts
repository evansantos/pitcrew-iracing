import { describe, it, expect } from 'vitest';
import { parseIBTHeader, parseVariableHeaders, parseIBT, IBT_HEADER_SIZE, VARIABLE_HEADER_SIZE } from '../parser.js';

describe('IBT Parser', () => {
  describe('parseIBTHeader', () => {
    it('parses a valid IBT file header', () => {
      // Create a mock IBT header (112 bytes)
      const buffer = Buffer.alloc(IBT_HEADER_SIZE);

      // Version
      buffer.writeInt32LE(1, 0);
      // Status
      buffer.writeInt32LE(1, 4);
      // Tick rate
      buffer.writeInt32LE(60, 8);
      // Session info update
      buffer.writeInt32LE(0, 12);
      // Session info length
      buffer.writeInt32LE(1024, 16);
      // Session info offset
      buffer.writeInt32LE(IBT_HEADER_SIZE, 20);
      // Num variables
      buffer.writeInt32LE(5, 24);
      // Variable headers offset
      buffer.writeInt32LE(IBT_HEADER_SIZE + 1024, 28);
      // Num samples
      buffer.writeInt32LE(100, 32);
      // Sample buf offset
      buffer.writeInt32LE(IBT_HEADER_SIZE + 1024 + 5 * VARIABLE_HEADER_SIZE, 36);

      const header = parseIBTHeader(buffer);

      expect(header.version).toBe(1);
      expect(header.tickRate).toBe(60);
      expect(header.numVariables).toBe(5);
      expect(header.numSamples).toBe(100);
    });

    it('throws on buffer too small', () => {
      const buffer = Buffer.alloc(10);
      expect(() => parseIBTHeader(buffer)).toThrow();
    });
  });

  describe('parseVariableHeaders', () => {
    it('parses variable header entries', () => {
      const header = {
        type: 1,       // float
        offset: 0,
        count: 1,
        name: 'Speed',
        desc: 'Vehicle speed',
        unit: 'm/s',
      };

      // Build a binary variable header (144 bytes each)
      const buf = Buffer.alloc(VARIABLE_HEADER_SIZE);
      buf.writeInt32LE(header.type, 0);
      buf.writeInt32LE(header.offset, 4);
      buf.writeInt32LE(header.count, 8);
      // Name at offset 16 (32 bytes)
      buf.write(header.name, 16, 32, 'ascii');
      // Desc at offset 48 (64 bytes)
      buf.write(header.desc, 48, 64, 'ascii');
      // Unit at offset 112 (32 bytes)
      buf.write(header.unit, 112, 32, 'ascii');

      const vars = parseVariableHeaders(buf, 1);
      expect(vars).toHaveLength(1);
      expect(vars[0].name).toBe('Speed');
      expect(vars[0].type).toBe(1);
      expect(vars[0].unit).toBe('m/s');
    });
  });

  describe('parseIBT', () => {
    it('throws on sessionInfoOffset beyond buffer boundary', () => {
      const buf = Buffer.alloc(IBT_HEADER_SIZE);
      buf.writeInt32LE(1, 0);                // version
      buf.writeInt32LE(0, 4);                // status
      buf.writeInt32LE(60, 8);               // tickRate
      buf.writeInt32LE(0, 12);               // sessionInfoUpdate
      buf.writeInt32LE(1000, 16);            // sessionInfoLength (way too big)
      buf.writeInt32LE(99999, 20);           // sessionInfoOffset (way past end)
      buf.writeInt32LE(0, 24);               // numVariables
      buf.writeInt32LE(IBT_HEADER_SIZE, 28); // variableHeadersOffset
      buf.writeInt32LE(0, 32);               // numSamples
      buf.writeInt32LE(IBT_HEADER_SIZE, 36); // sampleBufferOffset

      expect(() => parseIBT(buf)).toThrow('corrupted');
    });

    it('throws on variableHeadersOffset beyond buffer boundary', () => {
      const buf = Buffer.alloc(IBT_HEADER_SIZE);
      buf.writeInt32LE(1, 0);                // version
      buf.writeInt32LE(0, 4);                // status
      buf.writeInt32LE(60, 8);               // tickRate
      buf.writeInt32LE(0, 12);               // sessionInfoUpdate
      buf.writeInt32LE(0, 16);               // sessionInfoLength
      buf.writeInt32LE(0, 20);               // sessionInfoOffset
      buf.writeInt32LE(5, 24);               // numVariables
      buf.writeInt32LE(99999, 28);           // variableHeadersOffset (way past end)
      buf.writeInt32LE(0, 32);               // numSamples
      buf.writeInt32LE(IBT_HEADER_SIZE, 36); // sampleBufferOffset

      expect(() => parseIBT(buf)).toThrow('corrupted');
    });
  });
});
