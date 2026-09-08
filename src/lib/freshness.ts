/**
 * Time-based checks kept out of component bodies (react-hooks/purity):
 * server components call these named predicates instead of Date.now().
 */

export function isExpired(expiresAt: number): boolean {
  return expiresAt < Date.now();
}

const GRADING_STALE_AFTER_MS = 3 * 60 * 1000;

export function isGradingStale(report: {
  status: string;
  gradedAt: number | null;
  createdAt: number;
  gradingStartedAt: number | null;
}): boolean {
  const attemptStartedAt = report.gradingStartedAt ?? report.createdAt;
  return (
    report.status === "grading" &&
    report.gradedAt === null &&
    Date.now() - attemptStartedAt > GRADING_STALE_AFTER_MS
  );
}
