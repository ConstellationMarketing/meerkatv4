import { supabase } from "@/lib/supabase";
import { ArticleOutline } from "@/types/article";

export interface WebhookStatusItem {
  id: string;
  articleId: string;
  clientName: string;
  keyword: string;
  status: "pending" | "received";
  sentAt: string;
  receivedAt?: string;
  hasArticleContent: boolean;
}

export async function getWebhookStatusList(): Promise<WebhookStatusItem[]> {
  try {
    const { data, error } = await supabase
      .from("article_outlines")
      .select("*")
      .eq("webhook_sent", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch webhook status:", error);
      return [];
    }

    if (!data) {
      return [];
    }

    const statusItems: WebhookStatusItem[] = data.map((row: any) => ({
      id: row.id,
      articleId: row.article_id,
      clientName: row.client_name,
      keyword: row.keyword,
      status: row.received_article ? "received" : "pending",
      sentAt: row.updated_at,
      receivedAt: row.received_article?.receivedAt,
      hasArticleContent: !!row.received_article?.content,
    }));

    return statusItems;
  } catch (error) {
    console.error("Error fetching webhook status:", error);
    return [];
  }
}

export function calculateWaitTime(sentAt: string, receivedAt?: string): string {
  const sent = new Date(sentAt);
  const received = receivedAt ? new Date(receivedAt) : new Date();
  const diffMs = received.getTime() - sent.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`;
  } else if (diffMins > 0) {
    return `${diffMins}m`;
  } else {
    return "< 1m";
  }
}

export function formatWebhookStatusDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
