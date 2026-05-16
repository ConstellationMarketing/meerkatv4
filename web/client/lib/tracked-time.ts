// Utilities for interpreting tracked editing time alongside self-reported time.

/**
 * Format a raw seconds value as "HH:MM", rounded to the nearest minute.
 * Matches the HH:MM format editors use in the feedback modal so the admin
 * dashboard's Reported and Tracked columns read in the same units.
 *
 * Any non-zero value rounds up to at least "00:01" so genuinely-tracked
 * rows don't visually collapse to the same "00:00" as untracked ones.
 */
export function formatSecondsAsHM(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return "00:00";
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export const TRACKED_TIME_CEILING_SECONDS = 4 * 3600; // Above this = likely a tracking bug
export const TRACKED_OVER_REPORTED_RATIO = 3;
export const TRACKED_UNDER_REPORTED_RATIO = 0.3;
export const TRACKED_MIN_FOR_UNDER_CHECK_SECONDS = 60;

/**
 * Parse a "HH:MM" reported time string into seconds. Returns null if unparseable.
 */
export function parseReportedSeconds(timeSpent: string | undefined | null): number | null {
  if (!timeSpent) return null;
  const match = timeSpent.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 3600 + minutes * 60;
}

/**
 * Classify a tracked-time row as anomalous so admins know when to dig in.
 * Returns a human-readable reason, or null if the row looks normal.
 */
export function trackedTimeAnomaly(
  trackedSeconds: number | undefined | null,
  reportedSpent: string | undefined | null,
): string | null {
  if (!trackedSeconds || trackedSeconds <= 0) return null;

  if (trackedSeconds > TRACKED_TIME_CEILING_SECONDS) {
    return "Tracked time exceeds 4 hours — likely a tracking anomaly (e.g. browser kept events firing while idle).";
  }

  const reportedSeconds = parseReportedSeconds(reportedSpent);
  if (reportedSeconds && reportedSeconds > 0) {
    if (trackedSeconds > reportedSeconds * TRACKED_OVER_REPORTED_RATIO) {
      return "Tracked time is more than 3× the reported time — check for synthetic browser events or a long idle window.";
    }
    if (
      trackedSeconds > TRACKED_MIN_FOR_UNDER_CHECK_SECONDS &&
      trackedSeconds < reportedSeconds * TRACKED_UNDER_REPORTED_RATIO
    ) {
      return "Tracked time is under a third of reported — editor may have worked in a background tab or across reloads.";
    }
  }

  return null;
}
