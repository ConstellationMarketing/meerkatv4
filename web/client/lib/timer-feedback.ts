import { supabase } from "./supabase";

interface TimerFeedbackData {
  articleId: string;
  articleTitle: string;
  timeSpent: number; // in seconds
  feedback: string;
  userEmail?: string;
  dateStarted?: string;
  articleKeyword?: string;
  wordCount?: number;
  difficulty?: string;
  client?: string;
}

export interface ExistingTimerRecord {
  article_id?: string;
  "time spent": string;
  feedbacks: string;
  "article title": string;
  "article link": string;
  user: string;
  date_started: string;
  difficulty?: string;
}

// Check if an article already has a timer/feedback record
export async function getExistingTimerRecord(
  articleId: string,
  userEmail?: string
): Promise<ExistingTimerRecord | null> {
  try {
    console.log(`[getExistingTimerRecord] Searching for article_id: ${articleId}`);

    if (!articleId) {
      console.log("[getExistingTimerRecord] No article ID provided");
      return null;
    }

    // Try to find by article_id - don't use .single() because we just want the first match
    const { data, error } = await supabase
      .from("timer_and_feedbacks")
      .select("*")
      .ilike("article_id", articleId); // Using ilike for case-insensitive match

    console.log(`[getExistingTimerRecord] Query for ${articleId} returned:`, { data, error });

    if (error) {
      console.error("[getExistingTimerRecord] Error fetching timer record:", error);
      return null;
    }

    // If we got results, return the first one
    if (Array.isArray(data) && data.length > 0) {
      const record = data[0];
      console.log(`[getExistingTimerRecord] ✅ Found record:`, {
        article_id: record.article_id,
        title: record["article title"],
        user: record.user,
        has_feedbacks: !!record.feedbacks,
        time_spent: record["time spent"],
        difficulty: record.difficulty,
      });
      return record;
    }

    console.log(`[getExistingTimerRecord] ❌ No records found for article_id: ${articleId}`);
    return null;
  } catch (error) {
    console.error("[getExistingTimerRecord] Exception:", error);
    return null;
  }
}

export async function saveTimerAndFeedback(
  data: TimerFeedbackData
): Promise<{ success: boolean; error?: string }> {
  try {
    const hours = Math.floor(data.timeSpent / 3600);
    const minutes = Math.floor((data.timeSpent % 3600) / 60);
    const seconds = data.timeSpent % 60;
    const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    const articleLink = `/edit/${data.articleId}`;
    const now = new Date();
    const dateStarted = data.dateStarted || now.toISOString();

    const { error } = await supabase.from("timer_and_feedbacks").insert([
      {
        article_id: data.articleId,
        "time spent": formattedTime,
        feedbacks: data.feedback,
        "article title": data.articleTitle,
        "article link": articleLink,
        user: data.userEmail || "anonymous",
        date_started: dateStarted,
        article_keyword: data.articleKeyword || null,
        word_count: data.wordCount || null,
        difficulty: data.difficulty || "medium",
        client: data.client || null,
      },
    ]);

    if (error) {
      console.error("Error saving timer and feedback:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error saving timer and feedback:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
