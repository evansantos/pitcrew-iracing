export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Simplified header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4">
          <h2 className="text-lg font-semibold">Race Engineer</h2>
        </div>
      </header>

      {/* Main content area with smooth scroll */}
      <main className="container px-4 py-6 max-w-[2000px] mx-auto">
        <div className="scroll-smooth overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
