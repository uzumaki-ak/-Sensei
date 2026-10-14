import { Suspense } from "react";

function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6 animate-pulse">
      <div className="h-7 w-44 rounded-sm bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 rounded-sm border border-border/70 bg-card/60" />
        ))}
      </div>
      <div className="h-72 rounded-sm border border-border/70 bg-card/60" />
      <span className="sr-only">Loading dashboard data</span>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-6xl font-bold gradient-title">Industry Insights</h1>
      </div>
      <Suspense fallback={<DashboardLoading />}>
        {children}
      </Suspense>
    </div>
  );
}
