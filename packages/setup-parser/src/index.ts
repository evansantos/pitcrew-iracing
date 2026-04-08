/**
 * iRacing .STO setup file parser and diff tool.
 * .STO files use an INI-like format with [Section] headers and Key=Value pairs.
 */

export type SetupData = Record<string, Record<string, string>>;

export interface SetupDiff {
  category: string;
  key: string;
  valueA: string;
  valueB: string;
  direction: 'increased' | 'decreased' | 'changed';
}

/**
 * Parse an iRacing .STO setup file into structured data.
 */
export function parseStoFile(content: string): SetupData {
  const result: SetupData = {};
  let currentSection = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key=Value pair
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch && currentSection) {
      result[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  return result;
}

/**
 * Compare two setups and return a list of differences.
 */
export function diffSetups(setupA: SetupData, setupB: SetupData): SetupDiff[] {
  const diffs: SetupDiff[] = [];

  // Collect all categories
  const allCategories = new Set([
    ...Object.keys(setupA),
    ...Object.keys(setupB),
  ]);

  for (const category of allCategories) {
    const sectionA = setupA[category] || {};
    const sectionB = setupB[category] || {};

    // Collect all keys
    const allKeys = new Set([
      ...Object.keys(sectionA),
      ...Object.keys(sectionB),
    ]);

    for (const key of allKeys) {
      const valA = sectionA[key] ?? '';
      const valB = sectionB[key] ?? '';

      if (valA !== valB) {
        diffs.push({
          category,
          key,
          valueA: valA,
          valueB: valB,
          direction: getDirection(valA, valB),
        });
      }
    }
  }

  return diffs;
}

function getDirection(a: string, b: string): 'increased' | 'decreased' | 'changed' {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (!isNaN(numA) && !isNaN(numB)) {
    return numB > numA ? 'increased' : numB < numA ? 'decreased' : 'changed';
  }

  return 'changed';
}
