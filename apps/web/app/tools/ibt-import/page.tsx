'use client';

import { useState, useCallback } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

type ImportStatus = 'idle' | 'parsing' | 'success' | 'error';

export default function IbtImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ibt')) {
      setError('Please select a .ibt file');
      setStatus('error');
      return;
    }

    setFileName(file.name);
    setStatus('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/import/ibt`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">.IBT File Import</h1>
        <p className="mb-6 text-muted-foreground">
          Upload iRacing telemetry files (.ibt) for offline analysis.
          Imported sessions appear in the session list and all analysis features are available.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card'
          }`}
        >
          <div className="text-4xl">🏎️</div>
          <div className="text-center">
            <p className="font-medium">
              {status === 'parsing' ? `Parsing ${fileName}...` :
               status === 'success' ? `${fileName} imported successfully!` :
               'Drop .IBT file here or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports iRacing .IBT telemetry files
            </p>
          </div>

          <input
            type="file"
            accept=".ibt"
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>

        {/* Status messages */}
        {status === 'parsing' && (
          <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-400">
            Parsing telemetry data... This may take a moment for large files.
          </div>
        )}

        {status === 'success' && (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
            Session imported successfully! You can now analyze it from the dashboard.
          </div>
        )}

        {status === 'error' && error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
