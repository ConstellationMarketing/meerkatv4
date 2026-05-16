import { useEffect, createElement } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface ArticleUpdate {
  id: string;
  article_id: string;
  client_name: string;
  keyword: string;
  updated_at?: string;
  received_article: {
    title?: string;
    content: string;
    receivedAt?: string;
  } | null;
}

// Track which articles have been notified to avoid duplicate toasts
const notifiedArticles = new Set<string>();
const LAST_SEEN_KEY = "article_updates_last_seen";

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if ("message" in obj) {
      return String(obj.message);
    }
    if ("error" in obj && typeof obj.error === "string") {
      return obj.error;
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return "[Unable to parse error]";
    }
  }
  return String(error);
}

export function useArticleUpdates() {
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Polling is disabled - ArticleEditor.tsx handles polling more efficiently
    // This prevents redundant network requests and "Failed to fetch" errors
    return;

    let pollInterval: NodeJS.Timeout | null = null;
    let isEnabled = true;

    const existingLastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (!existingLastSeen) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    }

    const checkForUpdates = async () => {
      // Skip if polling is disabled
      if (!isEnabled) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from("article_outlines")
          .select("id, client_name, keyword, received_article, updated_at")
          .not("received_article", "is", null);

        if (error) {
          throw error;
        }

        const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY);
        const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
        let maxSeen = lastSeen;

        if (data && Array.isArray(data)) {
          for (const article of data as ArticleUpdate[]) {
            const articleId = article.article_id;
            const receivedAtStr =
              article.received_article?.receivedAt || article.updated_at;
            const receivedAt = receivedAtStr
              ? new Date(receivedAtStr).getTime()
              : 0;

            if (
              article.received_article?.content &&
              receivedAt > lastSeen &&
              !notifiedArticles.has(articleId)
            ) {
              notifiedArticles.add(articleId);
              toast({
                title: "✓ Article Generated",
                description: `"${article.keyword}" is now available`,
                duration: 3000,
                action: createElement(Button, {
                  variant: "outline",
                  size: "sm",
                  onClick: () => navigate(`/editor/${articleId}`),
                  className: "h-8",
                  children: "View",
                }),
              });
            }

            if (receivedAt > maxSeen) maxSeen = receivedAt;
          }
        }

        if (maxSeen > lastSeen) {
          localStorage.setItem(LAST_SEEN_KEY, new Date(maxSeen).toISOString());
        }
      } catch (error) {
        // Silently handle transient network errors
        // They're expected during polling and will retry on next interval
        const errorMsg = formatError(error);
        if (
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("Network") ||
          errorMsg.includes("fetch") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("CORS")
        ) {
          // Network error - silently skip this check, will retry next interval
          return;
        }

        // Log unexpected errors only
        console.debug("Article updates polling error:", errorMsg);
      }
    };

    // Delay initial check by 2 seconds to allow app to stabilize
    const initialTimeout = setTimeout(() => {
      if (isEnabled) {
        checkForUpdates();
      }
    }, 2000);

    // Then check every 10 seconds (only if enabled)
    pollInterval = setInterval(() => {
      if (isEnabled) {
        checkForUpdates();
      }
    }, 10000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [toast, navigate]);
}
