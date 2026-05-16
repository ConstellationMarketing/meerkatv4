import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActivityTimer } from "./use-activity-timer";
import { fireTrusted, fireSynthetic } from "@/test/events";

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    value: hidden,
    configurable: true,
  });
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
}

describe("useActivityTimer", () => {
  let hasFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setDocumentHidden(false);
    hasFocusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    hasFocusSpy.mockRestore();
    vi.useRealTimers();
  });

  it("starts at zero when no persisted value exists", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));
    expect(result.current.activeSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it("counts seconds after a trusted keystroke", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireTrusted("keydown");
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.activeSeconds).toBe(3);
  });

  it("ignores synthetic (untrusted) events", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireSynthetic("keydown");
      fireSynthetic("input");
      fireSynthetic("scroll");
    });

    expect(result.current.isActive).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.activeSeconds).toBe(0);
  });

  it("pauses when document becomes hidden", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.activeSeconds).toBe(2);

    act(() => {
      setDocumentHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.isActive).toBe(false);

    // Further "activity" while hidden should not advance the counter.
    act(() => {
      fireTrusted("keydown");
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.activeSeconds).toBe(2);
  });

  it("pauses on window blur", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.activeSeconds).toBe(1);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.isActive).toBe(false);

    // hasFocus() returns false once the window has blurred — simulate that.
    hasFocusSpy.mockReturnValue(false);
    act(() => {
      fireTrusted("keydown");
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.activeSeconds).toBe(1);
  });

  it("pauses after the idle timeout", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.activeSeconds).toBe(30);
    expect(result.current.isActive).toBe(true);

    // 60s of no activity triggers the idle pause.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isActive).toBe(false);
  });

  it("persists tracked seconds to localStorage per article", () => {
    const { result } = renderHook(() => useActivityTimer(true, "article-a"));

    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.activeSeconds).toBe(4);

    const stored = window.localStorage.getItem("meerkat_activity_timer_article-a");
    expect(stored).toBe("4");
  });

  it("rehydrates from localStorage on mount", () => {
    window.localStorage.setItem("meerkat_activity_timer_article-a", "120");

    const { result } = renderHook(() => useActivityTimer(true, "article-a"));
    expect(result.current.activeSeconds).toBe(120);
  });

  it("reset clears both counter and persisted value", () => {
    window.localStorage.setItem("meerkat_activity_timer_article-a", "300");

    const { result } = renderHook(() => useActivityTimer(true, "article-a"));
    expect(result.current.activeSeconds).toBe(300);

    act(() => {
      result.current.reset();
    });
    expect(result.current.activeSeconds).toBe(0);
    expect(window.localStorage.getItem("meerkat_activity_timer_article-a")).toBeNull();
  });

  it("ignores activity when disabled", () => {
    const { result } = renderHook(() => useActivityTimer(false, "article-a"));

    act(() => {
      fireTrusted("keydown");
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.activeSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  // The feedback modal disables the hook while open. The counter must freeze at
  // the pre-modal value (no ticks, no additions from typing in the form) and
  // resume cleanly if the editor closes the modal and goes back to editing.
  it("freezes counter while disabled and resumes when re-enabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useActivityTimer(enabled, "article-a"),
      { initialProps: { enabled: true } },
    );

    // Accumulate 2 seconds while enabled.
    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.activeSeconds).toBe(2);

    // Disable — counter should stop moving but preserve its value.
    rerender({ enabled: false });
    expect(result.current.isActive).toBe(false);

    act(() => {
      fireTrusted("keydown");
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.activeSeconds).toBe(2);

    // Re-enable — next trusted event should restart ticking from the preserved value.
    rerender({ enabled: true });
    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.activeSeconds).toBe(5);
  });

  // Regression test: switching articles must not leak ticks from article A's
  // still-running interval into article B's counter.
  it("does not bleed tracked time across an article switch", () => {
    window.localStorage.setItem("meerkat_activity_timer_article-b", "0");

    const { result, rerender } = renderHook(
      ({ articleId }) => useActivityTimer(true, articleId),
      { initialProps: { articleId: "article-a" } },
    );

    // Activity on article A — interval now running.
    act(() => {
      fireTrusted("keydown");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.activeSeconds).toBe(3);

    // Switch to article B without any activity.
    rerender({ articleId: "article-b" });

    // B should start from its persisted value (0). Any ticks before the editor
    // interacts with B would be leftover from A's activation.
    expect(result.current.activeSeconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Without any trusted activity on B, counter must stay at 0.
    expect(result.current.activeSeconds).toBe(0);
    expect(window.localStorage.getItem("meerkat_activity_timer_article-b")).toBe("0");

    // A's persisted value must be preserved, not overwritten with bleed time.
    expect(window.localStorage.getItem("meerkat_activity_timer_article-a")).toBe("3");
  });
});
