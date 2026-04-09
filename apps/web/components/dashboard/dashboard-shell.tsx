'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/replay', label: 'Replay' },
  { href: '/tools/ibt-import', label: 'Import .IBT' },
  { href: '/tools/setup-compare', label: 'Setup Compare' },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
        <div className="container flex h-14 items-center gap-6 px-4">
          <h2 className="text-lg font-semibold">Race Engineer</h2>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
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
        </div>
      </header>

      <main className="container px-4 py-6 max-w-[2000px] mx-auto">
        <div className="scroll-smooth overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
