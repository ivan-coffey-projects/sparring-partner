/** Human-ish label for a simulated duration in minutes. Client-safe. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? "an hour" : `${hours} hours`;
  }
  const days = Math.round(minutes / (24 * 60));
  return days === 1 ? "a day" : `${days} days`;
}
