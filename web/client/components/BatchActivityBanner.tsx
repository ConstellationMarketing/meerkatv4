import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { listBatches, type BatchStatus } from "@/lib/batch";
import { getTeamMembers } from "@/lib/team-members";

/**
 * Sticky banner that surfaces in-progress batches across any admin tab.
 * Polls batch_jobs every 5 seconds while at least one batch is in
 * 'processing' status; stops polling when none are. Click navigates the
 * caller to the Batch Generate tab via the optional onNavigate handler.
 *
 * Designed to mount near the top of the admin layout (above the tab
 * switcher). When no batch is processing, renders nothing.
 */
export function BatchActivityBanner({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const [active, setActive] = useState<BatchStatus | null>(null);
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // One-time fetch of team members to resolve created_by → email for the
  // "started by" suffix. Non-blocking — banner still renders without it.
  useEffect(() => {
    let cancelled = false;
    getTeamMembers()
      .then((members) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const m of members) {
          if (m.user_id) map[m.user_id] = m.email_address || "";
        }
        setUserEmailMap(map);
      })
      .catch(() => { /* non-blocking */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const all = await listBatches();
        if (cancelled) return;
        const processing = all.find((b) => b.status === "processing") ?? null;
        setActive(processing);
        // If nothing is processing, stop polling. We'll resume on next mount.
        if (!processing && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // Silently ignore — banner stays in last-known state
      }
    };

    // Always do an initial fetch on mount.
    refresh();

    // Poll periodically; the polling kicks in even if the initial fetch
    // returned nothing, so a batch started later is picked up.
    pollRef.current = setInterval(refresh, 5000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  if (!active) return null;

  const total = active.total_articles || 0;
  const done = (active.completed_count || 0) + (active.failed_count || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div
      role="status"
      onClick={onNavigate}
      className={`sticky top-0 z-40 border-b border-blue-200 bg-blue-50 ${
        onNavigate ? "cursor-pointer hover:bg-blue-100" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-blue-900">
              Batch in progress
            </span>
            <span className="text-blue-800">
              {done}/{total} articles
            </span>
            {active.created_by && userEmailMap[active.created_by] && (
              <span className="text-blue-700/80">
                • started by {userEmailMap[active.created_by]}
              </span>
            )}
            {active.current_keyword && (
              <span className="text-blue-700/80 truncate">
                • currently: {active.current_keyword}
              </span>
            )}
            {active.failed_count > 0 && (
              <span className="text-red-700">
                • {active.failed_count} failed
              </span>
            )}
          </div>
          <div className="mt-1 h-1 w-full bg-blue-200 rounded">
            <div
              className="h-1 bg-blue-600 rounded transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {onNavigate && (
          <span className="text-xs text-blue-700/80 shrink-0 hidden sm:inline">
            View →
          </span>
        )}
      </div>
    </div>
  );
}
