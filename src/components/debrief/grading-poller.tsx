"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the debrief while the grader works. */
export function GradingPoller() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(interval);
  }, [router]);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/40 px-5 py-4">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      <div>
        <p className="text-sm font-medium">The grader is reviewing your call…</p>
        <p className="text-xs text-muted-foreground">
          A separate grader is checking the transcript against your
          trainer&apos;s methodology.
        </p>
      </div>
    </div>
  );
}
