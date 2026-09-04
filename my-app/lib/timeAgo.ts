/**
 * Instagram-style relative timestamp: "now", "5s", "12m", "3h", "4d", "2w",
 * then falls back to a short date ("Aug 12" / "Aug 12, 2024").
 */
export function timeAgo(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "";

  const date = new Date(dateInput);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "";

  const seconds = Math.floor((Date.now() - ms) / 1000);

  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
