'use client';

import { useEffect } from 'react';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

/**
 * Global keyboard shortcuts for accessibility and power users.
 * Bindings are passive — only registered when the hook is mounted.
 */
export function useKeyboardShortcuts(bindings: KeyBinding[]): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const binding of bindings) {
        if (
          e.key.toLowerCase() === binding.key.toLowerCase() &&
          !!binding.ctrl === (e.ctrlKey || e.metaKey) &&
          !!binding.shift === e.shiftKey &&
          !!binding.alt === e.altKey
        ) {
          e.preventDefault();
          binding.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings]);
}

/**
 * Default global shortcuts for the dashboard.
 */
export function getDefaultShortcuts(navigate: (path: string) => void): KeyBinding[] {
  return [
    { key: '1', description: 'Go to Dashboard', action: () => navigate('/') },
    { key: '2', description: 'Go to Analysis', action: () => navigate('/analysis') },
    { key: '3', description: 'Go to Replay', action: () => navigate('/replay') },
    { key: '4', description: 'Go to Stats', action: () => navigate('/stats') },
    { key: '5', description: 'Go to Leaderboard', action: () => navigate('/leaderboard') },
    { key: 'g', description: 'Go to Glance view', action: () => navigate('/glance') },
    { key: '?', shift: true, description: 'Show keyboard shortcuts', action: () => alert('Press 1-5 to navigate, G for glance view') },
  ];
}
