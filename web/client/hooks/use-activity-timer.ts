import { useState, useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 60_000; // 1 minute of no activity = paused
const ACTIVITY_EVENTS = [
  "keydown",
  "mousedown",
  "pointerdown",
  "click",
  "input",
  "paste",
  "cut",
  "scroll",
  "wheel",
];
const STORAGE_KEY_PREFIX = "meerkat_activity_timer_";

function storageKey(articleId?: string): string | null {
  return articleId ? STORAGE_KEY_PREFIX + articleId : null;
}

function loadPersisted(articleId?: string): number {
  const key = storageKey(articleId);
  if (!key) return 0;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePersisted(articleId: string | undefined, seconds: number) {
  const key = storageKey(articleId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(seconds));
  } catch {
    // localStorage may be blocked (private mode, quota) — fall back to in-memory
  }
}

function clearPersisted(articleId?: string) {
  const key = storageKey(articleId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Tracks active editing time based on user activity.
 *
 * Controls to improve trust in the signal:
 *  - Only counts events with isTrusted=true (excludes extensions / scripted input)
 *  - Pauses when tab is hidden (visibilitychange) or window loses focus (blur)
 *  - Capture-phase listeners so rich editors can't swallow events
 *  - Persists per-article to localStorage (survives reloads)
 *  - 1-minute idle timeout (shorter than the original 2 min to limit phantom tail)
 *
 * Returns:
 *  - activeSeconds: total seconds of active editing
 *  - isActive: whether the timer is currently counting
 *  - reset: function to zero the counter and clear persistence
 */
export function useActivityTimer(enabled: boolean = true, articleId?: string) {
  const [activeSeconds, setActiveSeconds] = useState<number>(() =>
    loadPersisted(articleId),
  );
  const [isActive, setIsActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articleIdRef = useRef<string | undefined>(articleId);

  // Keep the ref in sync so persistence writes go to the current article's key.
  useEffect(() => {
    articleIdRef.current = articleId;
  }, [articleId]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    setIsActive(false);
  }, []);

  // When the active article changes, stop any interval still running from the
  // previous article's activity, then rehydrate from the new article's key.
  // Otherwise ticks from A's in-flight idle window would bleed into B.
  useEffect(() => {
    pause();
    setActiveSeconds(loadPersisted(articleId));
  }, [articleId, pause]);

  const markActive = useCallback(
    (event?: Event) => {
      if (!enabled) return;

      // Ignore synthetic events (browser extensions, scripted input, etc.)
      if (event && event.isTrusted === false) return;

      // Don't count time while the tab is hidden or the window is unfocused.
      if (typeof document !== "undefined" && document.hidden) return;
      if (typeof document !== "undefined" && !document.hasFocus()) return;

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      if (!intervalRef.current) {
        setIsActive(true);
        intervalRef.current = setInterval(() => {
          setActiveSeconds((prev) => {
            const next = prev + 1;
            writePersisted(articleIdRef.current, next);
            return next;
          });
        }, 1000);
      }

      idleTimeoutRef.current = setTimeout(() => {
        pause();
      }, IDLE_TIMEOUT_MS);
    },
    [enabled, pause],
  );

  // Activity listeners on document, capture phase so rich editors can't swallow them.
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: Event) => markActive(e);

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handler, { passive: true, capture: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handler, { capture: true } as any);
      });
    };
  }, [enabled, markActive]);

  // Pause on visibility change / window blur. Nothing resumes it automatically —
  // the next real user event will start it again via markActive.
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) pause();
    };
    const handleBlur = () => pause();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, pause]);

  // Clean up any outstanding timers on unmount or when disabled.
  useEffect(() => {
    if (enabled) return;
    pause();
  }, [enabled, pause]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setActiveSeconds(0);
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    clearPersisted(articleIdRef.current);
  }, []);

  return { activeSeconds, isActive, reset };
}
