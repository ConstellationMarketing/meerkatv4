import { supabase } from "@/lib/supabase";

export interface WebhookLogEntry {
  id?: string;
  articleid: string;
  clientid: number | null;
  keyword: string;
  status: string;
  payload: any;
  receivedat: string;
  createdat?: string;
}

export async function logWebhookPayload(payload: any): Promise<void> {
  try {
    const entry: WebhookLogEntry = {
      articleid: payload.articleid || "unknown",
      clientid: payload.clientid || null,
      keyword: payload.keyword || "unknown",
      status: payload.status || "received",
      payload: payload,
      receivedat: new Date().toISOString(),
    };

    const { error } = await supabase.from("webhook_logs").insert([entry]);

    if (error) {
      console.error("Failed to log webhook payload:", error);
    } else {
      console.log("✓ Webhook payload logged successfully");
    }
  } catch (error) {
    console.error("Error logging webhook payload:", error);
  }
}

export async function getWebhookLogs(
  limit: number = 100,
): Promise<WebhookLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from("webhook_logs")
      .select("*")
      .order("receivedat", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch webhook logs:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching webhook logs:", error);
    return [];
  }
}

export async function clearWebhookLogs(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webhook_logs")
      .delete()
      .neq("id", "");

    if (error) {
      console.error("Failed to clear webhook logs:", error);
      return false;
    }

    console.log("✓ Webhook logs cleared");
    return true;
  } catch (error) {
    console.error("Error clearing webhook logs:", error);
    return false;
  }
}
