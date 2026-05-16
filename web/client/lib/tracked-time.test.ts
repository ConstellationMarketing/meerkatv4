import { describe, it, expect } from "vitest";
import { parseReportedSeconds, trackedTimeAnomaly, formatSecondsAsHM } from "./tracked-time";

describe("formatSecondsAsHM", () => {
  it("returns 00:00 for zero, null, undefined", () => {
    expect(formatSecondsAsHM(0)).toBe("00:00");
    expect(formatSecondsAsHM(null)).toBe("00:00");
    expect(formatSecondsAsHM(undefined)).toBe("00:00");
  });

  it("rounds any non-zero value up to at least 00:01", () => {
    expect(formatSecondsAsHM(1)).toBe("00:01");
    expect(formatSecondsAsHM(29)).toBe("00:01");
    expect(formatSecondsAsHM(47)).toBe("00:01");
  });

  it("rounds to nearest minute for typical values", () => {
    expect(formatSecondsAsHM(60)).toBe("00:01");
    expect(formatSecondsAsHM(90)).toBe("00:02"); // 1.5 min rounds up
    expect(formatSecondsAsHM(119)).toBe("00:02"); // just under 2 min rounds to 2
    expect(formatSecondsAsHM(30 * 60)).toBe("00:30");
  });

  it("shows hours when tracked time crosses 60 minutes", () => {
    expect(formatSecondsAsHM(60 * 60)).toBe("01:00");
    expect(formatSecondsAsHM(90 * 60)).toBe("01:30");
    expect(formatSecondsAsHM(4 * 3600)).toBe("04:00");
    expect(formatSecondsAsHM(17 * 3600)).toBe("17:00");
  });
});

describe("parseReportedSeconds", () => {
  it("parses hours and minutes", () => {
    expect(parseReportedSeconds("01:30")).toBe(5400);
    expect(parseReportedSeconds("00:36")).toBe(2160);
    expect(parseReportedSeconds("02:10")).toBe(7800);
  });

  it("accepts single-digit hours", () => {
    expect(parseReportedSeconds("1:05")).toBe(3900);
  });

  it("returns null for unparseable input", () => {
    expect(parseReportedSeconds(undefined)).toBeNull();
    expect(parseReportedSeconds("")).toBeNull();
    expect(parseReportedSeconds("90 min")).toBeNull();
    expect(parseReportedSeconds("1:2")).toBeNull();
  });
});

describe("trackedTimeAnomaly", () => {
  it("returns null for no tracked time", () => {
    expect(trackedTimeAnomaly(undefined, "00:30")).toBeNull();
    expect(trackedTimeAnomaly(0, "00:30")).toBeNull();
  });

  it("flags tracked time above 4 hours regardless of reported", () => {
    const result = trackedTimeAnomaly(5 * 3600, "02:00");
    expect(result).not.toBeNull();
    expect(result).toMatch(/exceeds 4 hours/);
  });

  it("flags the real 17-hour Moya case", () => {
    // 2h 10m reported, ~17h tracked
    const result = trackedTimeAnomaly(17 * 3600, "02:10");
    expect(result).toMatch(/exceeds 4 hours/);
  });

  it("flags tracked > 3× reported", () => {
    // Reported 30 min, tracked 2 hours — over 3x ratio, under 4h ceiling
    const result = trackedTimeAnomaly(2 * 3600, "00:30");
    expect(result).toMatch(/3× the reported time/);
  });

  it("flags tracked much lower than reported", () => {
    // Reported 90 min, tracked 15 min — under 30% ratio
    const result = trackedTimeAnomaly(15 * 60, "01:30");
    expect(result).toMatch(/under a third of reported/);
  });

  it("returns null when reported and tracked roughly agree", () => {
    expect(trackedTimeAnomaly(30 * 60, "00:30")).toBeNull();
    expect(trackedTimeAnomaly(45 * 60, "00:30")).toBeNull(); // 1.5x, within tolerance
    expect(trackedTimeAnomaly(25 * 60, "00:30")).toBeNull();
  });

  it("does not flag sub-minute tracked as under-reported", () => {
    // Tracked under 60s is too small to meaningfully compare to reported 1h
    expect(trackedTimeAnomaly(30, "01:00")).toBeNull();
  });

  it("ignores reported when unparseable but still applies the 4h ceiling", () => {
    expect(trackedTimeAnomaly(30 * 60, "invalid")).toBeNull();
    expect(trackedTimeAnomaly(5 * 3600, "invalid")).toMatch(/exceeds 4 hours/);
  });

  it("does not flag when reported is 0", () => {
    // Reported 00:00 means editor didn't fill in — don't infer anomaly from ratio
    expect(trackedTimeAnomaly(10 * 60, "00:00")).toBeNull();
  });
});
