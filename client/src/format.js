/** Formatting helpers shared across screens. */

/** "in 1h 22m" or "overdue by 45m" from an ISO slaTarget. */
export function slaRemaining(slaTarget, now = new Date()) {
  const target = new Date(slaTarget);
  const diffMs = target - now;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);

  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let span;
  if (days > 0) span = `${days}d ${hours % 24}h`;
  else if (hours > 0) span = `${hours}h ${mins % 60}m`;
  else span = `${mins}m`;

  return overdue ? `overdue by ${span}` : `${span} left`;
}

/** "2026-09-26 14:30" style local timestamp. */
export function formatDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
