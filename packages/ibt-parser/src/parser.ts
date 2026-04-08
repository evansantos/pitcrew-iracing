/**
 * iRacing .IBT telemetry file parser.
 *
 * IBT file structure:
 * - File header (112 bytes)
 * - Session info string (YAML)
 * - Variable headers (144 bytes each)
 * - Data samples (variable-length records)
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const IBT_HEADER_SIZE = 112;
export const VARIABLE_HEADER_SIZE = 144;

// Variable types
export const VAR_TYPE_CHAR = 0;
export const VAR_TYPE_BOOL = 1;
export const VAR_TYPE_INT = 2;
export const VAR_TYPE_BITFIELD = 3;
export const VAR_TYPE_FLOAT = 4;
export const VAR_TYPE_DOUBLE = 5;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IBTHeader {
  version: number;
  status: number;
  tickRate: number;
  sessionInfoUpdate: number;
  sessionInfoLength: number;
  sessionInfoOffset: number;
  numVariables: number;
  variableHeadersOffset: number;
  numSamples: number;
  sampleBufferOffset: number;
}

export interface IBTVariableHeader {
  type: number;
  offset: number;
  count: number;
  name: string;
  desc: string;
  unit: string;
}

export interface IBTSessionInfo {
  trackName: string;
  driverName: string;
  carName: string;
  sessionType: string;
}

export interface IBTSample {
  [key: string]: number | boolean | string;
}

export interface IBTParseResult {
  header: IBTHeader;
  sessionInfo: IBTSessionInfo;
  variables: IBTVariableHeader[];
  samples: IBTSample[];
}

// ─── Parsing functions ──────────────────────────────────────────────────────

export function parseIBTHeader(buffer: Buffer): IBTHeader {
  if (buffer.length < IBT_HEADER_SIZE) {
    throw new Error(`Buffer too small for IBT header: ${buffer.length} < ${IBT_HEADER_SIZE}`);
  }

  return {
    version: buffer.readInt32LE(0),
    status: buffer.readInt32LE(4),
    tickRate: buffer.readInt32LE(8),
    sessionInfoUpdate: buffer.readInt32LE(12),
    sessionInfoLength: buffer.readInt32LE(16),
    sessionInfoOffset: buffer.readInt32LE(20),
    numVariables: buffer.readInt32LE(24),
    variableHeadersOffset: buffer.readInt32LE(28),
    numSamples: buffer.readInt32LE(32),
    sampleBufferOffset: buffer.readInt32LE(36),
  };
}

export function parseVariableHeaders(buffer: Buffer, count: number): IBTVariableHeader[] {
  const vars: IBTVariableHeader[] = [];

  for (let i = 0; i < count; i++) {
    const offset = i * VARIABLE_HEADER_SIZE;

    if (offset + VARIABLE_HEADER_SIZE > buffer.length) break;

    vars.push({
      type: buffer.readInt32LE(offset),
      offset: buffer.readInt32LE(offset + 4),
      count: buffer.readInt32LE(offset + 8),
      name: readNullTerminated(buffer, offset + 16, 32),
      desc: readNullTerminated(buffer, offset + 48, 64),
      unit: readNullTerminated(buffer, offset + 112, 32),
    });
  }

  return vars;
}

export function parseSessionInfo(yaml: string): IBTSessionInfo {
  // Simple YAML-like extraction (not a full YAML parser)
  const getField = (text: string, field: string): string => {
    const regex = new RegExp(`${field}:\\s*(.+)`, 'i');
    const match = text.match(regex);
    return match?.[1]?.trim() || 'Unknown';
  };

  return {
    trackName: getField(yaml, 'TrackName'),
    driverName: getField(yaml, 'UserName'),
    carName: getField(yaml, 'CarScreenName'),
    sessionType: getField(yaml, 'SessionType'),
  };
}

export function parseSamples(
  buffer: Buffer,
  variables: IBTVariableHeader[],
  numSamples: number,
  sampleOffset: number,
): IBTSample[] {
  const samples: IBTSample[] = [];

  // Calculate record size from variable offsets
  let recordSize = 0;
  for (const v of variables) {
    const size = getTypeSize(v.type) * v.count;
    recordSize = Math.max(recordSize, v.offset + size);
  }

  if (recordSize === 0) return samples;

  for (let i = 0; i < numSamples; i++) {
    const recOffset = sampleOffset + i * recordSize;
    if (recOffset + recordSize > buffer.length) break;

    const sample: IBTSample = {};
    for (const v of variables) {
      const valueOffset = recOffset + v.offset;
      sample[v.name] = readValue(buffer, valueOffset, v.type);
    }
    samples.push(sample);
  }

  return samples;
}

export function parseIBT(buffer: Buffer): IBTParseResult {
  const header = parseIBTHeader(buffer);

  // Bounds validation
  if (header.sessionInfoOffset + header.sessionInfoLength > buffer.length) {
    throw new Error('IBT file corrupted: session info extends beyond file boundary');
  }
  if (header.variableHeadersOffset > buffer.length) {
    throw new Error('IBT file corrupted: variable headers offset beyond file boundary');
  }

  // Session info
  const sessionInfoRaw = buffer.toString(
    'utf-8',
    header.sessionInfoOffset,
    header.sessionInfoOffset + header.sessionInfoLength,
  );
  const sessionInfo = parseSessionInfo(sessionInfoRaw);

  // Variable headers
  const varBuf = buffer.subarray(header.variableHeadersOffset);
  const variables = parseVariableHeaders(varBuf, header.numVariables);

  // Samples
  const samples = parseSamples(buffer, variables, header.numSamples, header.sampleBufferOffset);

  return { header, sessionInfo, variables, samples };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readNullTerminated(buffer: Buffer, offset: number, maxLen: number): string {
  let end = offset;
  const limit = Math.min(offset + maxLen, buffer.length);
  while (end < limit && buffer[end] !== 0) end++;
  return buffer.toString('ascii', offset, end);
}

function getTypeSize(type: number): number {
  switch (type) {
    case VAR_TYPE_CHAR: return 1;
    case VAR_TYPE_BOOL: return 1;
    case VAR_TYPE_INT: return 4;
    case VAR_TYPE_BITFIELD: return 4;
    case VAR_TYPE_FLOAT: return 4;
    case VAR_TYPE_DOUBLE: return 8;
    default: return 4;
  }
}

function readValue(buffer: Buffer, offset: number, type: number): number | boolean {
  switch (type) {
    case VAR_TYPE_CHAR: return buffer.readInt8(offset);
    case VAR_TYPE_BOOL: return buffer.readUInt8(offset) !== 0;
    case VAR_TYPE_INT: return buffer.readInt32LE(offset);
    case VAR_TYPE_BITFIELD: return buffer.readInt32LE(offset);
    case VAR_TYPE_FLOAT: return buffer.readFloatLE(offset);
    case VAR_TYPE_DOUBLE: return buffer.readDoubleLE(offset);
    default: return 0;
  }
}
