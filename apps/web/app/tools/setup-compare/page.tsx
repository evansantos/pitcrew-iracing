'use client';

import { useState, useCallback } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

// Types (duplicated from setup-parser to avoid build dependency — client-side only)
type SetupData = Record<string, Record<string, string>>;
interface SetupDiff {
  category: string;
  key: string;
  valueA: string;
  valueB: string;
  direction: 'increased' | 'decreased' | 'changed';
}

function parseStoFile(content: string): SetupData {
  const result: SetupData = {};
  let currentSection = '';
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }
    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch && currentSection) {
      result[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }
  return result;
}

function diffSetups(a: SetupData, b: SetupData): SetupDiff[] {
  const diffs: SetupDiff[] = [];
  const cats = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const cat of cats) {
    const sa = a[cat] || {}, sb = b[cat] || {};
    const keys = new Set([...Object.keys(sa), ...Object.keys(sb)]);
    for (const key of keys) {
      const va = sa[key] ?? '', vb = sb[key] ?? '';
      if (va !== vb) {
        const na = parseFloat(va), nb = parseFloat(vb);
        const dir = !isNaN(na) && !isNaN(nb) ? (nb > na ? 'increased' : 'decreased') : 'changed';
        diffs.push({ category: cat, key, valueA: va, valueB: vb, direction: dir as SetupDiff['direction'] });
      }
    }
  }
  return diffs;
}

export default function SetupComparePage() {
  const [setupA, setSetupA] = useState<SetupData | null>(null);
  const [setupB, setSetupB] = useState<SetupData | null>(null);
  const [nameA, setNameA] = useState<string>('');
  const [nameB, setNameB] = useState<string>('');
  const [diffs, setDiffs] = useState<SetupDiff[]>([]);

  const handleFile = useCallback((side: 'A' | 'B') => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const parsed = parseStoFile(content);

        if (side === 'A') {
          setSetupA(parsed);
          setNameA(file.name);
        } else {
          setSetupB(parsed);
          setNameB(file.name);
        }
      };
      reader.readAsText(file);
    };
  }, []);

  const handleCompare = useCallback(() => {
    if (setupA && setupB) {
      setDiffs(diffSetups(setupA, setupB));
    }
  }, [setupA, setupB]);

  // Group diffs by category
  const groupedDiffs = diffs.reduce((acc, diff) => {
    if (!acc[diff.category]) acc[diff.category] = [];
    acc[diff.category].push(diff);
    return acc;
  }, {} as Record<string, SetupDiff[]>);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">Setup Comparison</h1>
        <p className="mb-6 text-muted-foreground">
          Compare two car setups (.sto files) side-by-side with diff highlighting.
        </p>

        {/* File pickers */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <label className="mb-2 block text-sm font-medium">Setup A</label>
            <input
              type="file"
              accept=".sto,.json"
              onChange={handleFile('A')}
              className="w-full text-sm"
            />
            {nameA && <p className="mt-2 text-xs text-muted-foreground">{nameA}</p>}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <label className="mb-2 block text-sm font-medium">Setup B</label>
            <input
              type="file"
              accept=".sto,.json"
              onChange={handleFile('B')}
              className="w-full text-sm"
            />
            {nameB && <p className="mt-2 text-xs text-muted-foreground">{nameB}</p>}
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={!setupA || !setupB}
          className="mb-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Compare Setups
        </button>

        {/* Diff results */}
        {diffs.length > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {diffs.length} difference{diffs.length !== 1 ? 's' : ''} found
            </p>

            {Object.entries(groupedDiffs).map(([category, catDiffs]) => (
              <div key={category} className="rounded-lg border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">{category}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Setting</th>
                      <th className="px-4 py-2 text-right">Setup A</th>
                      <th className="px-4 py-2 text-right">Setup B</th>
                      <th className="px-4 py-2 text-center">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catDiffs.map((diff) => (
                      <tr key={diff.key} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{diff.key}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{diff.valueA || '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{diff.valueB || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                            diff.direction === 'increased'
                              ? 'bg-green-500/20 text-green-400'
                              : diff.direction === 'decreased'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {diff.direction === 'increased' ? '▲' :
                             diff.direction === 'decreased' ? '▼' : '~'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground"
            >
              Export as PDF (Print)
            </button>
          </div>
        )}

        {diffs.length === 0 && setupA && setupB && (
          <p className="text-sm text-green-400">Setups are identical — no differences found.</p>
        )}
      </div>
    </DashboardShell>
  );
}
