'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useServiceWorker } from '@/hooks/use-service-worker';
import { useKeyboardShortcuts, getDefaultShortcuts } from '@/hooks/use-keyboard-shortcuts';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/replay', label: 'Replay' },
  { href: '/tools/ibt-import', label: 'Import .IBT' },
  { href: '/tools/setup-compare', label: 'Setup Compare' },
  { href: '/stats', label: 'Stats' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { offlineReady } = useServiceWorker();

  // Register global keyboard shortcuts
  const shortcuts = useMemo(
    () => getDefaultShortcuts((path) => router.push(path)),
    [router],
  );
  useKeyboardShortcuts(shortcuts);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header
        className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50"
        role="banner"
      >
        <div className="container flex h-14 items-center gap-4 px-4">
          <h2 className="text-lg font-semibold">Race Engineer</h2>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            className="ml-auto md:hidden rounded-md border p-2 text-sm"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

          {offlineReady && (
            <span
              className="hidden md:inline ml-auto text-xs text-green-500"
              title="Offline-ready"
              aria-label="Offline ready"
            >
              ●
            </span>
          )}
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <nav
            className="md:hidden border-t bg-background"
            aria-label="Mobile navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`block px-4 py-3 text-sm border-b ${
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main
        id="main-content"
        className="container px-4 py-6 max-w-[2000px] mx-auto"
        role="main"
      >
        <div className="scroll-smooth overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
