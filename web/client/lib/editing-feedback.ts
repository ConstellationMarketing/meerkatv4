import { supabase } from "@/lib/supabase";

export interface EditingFeedbackData {
  id?: string;
  articleId?: string;
  articleTitle: string;
  userEmail: string;
  timeSpent: string;
  trackedTimeSeconds?: number;
  issues: string;
  articleLink?: string;
  createdAt?: string;
  version?: string;
}

export async function saveEditingFeedback(
  data: EditingFeedbackData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    console.log("[EditingFeedback] Saving feedback:", {
      article: data.articleTitle,
      user: data.userEmail,
      timeSpent: data.timeSpent,
    });

    const { data: result, error } = await supabase
      .from("editing_feedback")
      .insert([
        {
          article_id: data.articleId || null,
          article_title: data.articleTitle,
          user_email: data.userEmail,
          time_spent: data.timeSpent,
          issues: data.issues,
          article_link: data.articleLink,
          version: data.version || null,
          tracked_time_seconds: data.trackedTimeSeconds || null,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[EditingFeedback] Error saving feedback:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("[EditingFeedback] Feedback saved successfully:", result?.id);
    return {
      success: true,
      id: result?.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[EditingFeedback] Exception:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function getEditingFeedback(
  filters?: {
    userEmail?: string;
    articleTitle?: string;
  }
): Promise<EditingFeedbackData[]> {
  try {
    let query = supabase.from("editing_feedback").select("*");

    if (filters?.userEmail) {
      query = query.eq("user_email", filters.userEmail);
    }

    if (filters?.articleTitle) {
      query = query.eq("article_title", filters.articleTitle);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("[EditingFeedback] Error fetching feedback:", error);
      return [];
    }

    const feedback: EditingFeedbackData[] =
      data?.map((item: any) => ({
        id: item.id,
        articleId: item.article_id || undefined,
        articleTitle: item.article_title,
        userEmail: item.user_email,
        timeSpent: item.time_spent,
        issues: item.issues,
        articleLink: item.article_link,
        createdAt: item.created_at,
        version: item.version || undefined,
        trackedTimeSeconds: item.tracked_time_seconds || undefined,
      })) || [];

    // Enrich rows with "Unknown Article" or missing version from article_outlines
    const needsEnrichment = feedback.filter(
      (f) =>
        (f.articleTitle === "Unknown Article" || !f.version) &&
        (f.articleId || f.articleLink)
    );

    if (needsEnrichment.length > 0) {
      const articleIds = needsEnrichment
        .map((f) => f.articleId || f.articleLink?.match(/\/editor\/([^/?]+)/)?.[1])
        .filter((id): id is string => !!id);

      if (articleIds.length > 0) {
        const uniqueIds = [...new Set(articleIds)];
        const { data: outlines } = await supabase
          .from("article_outlines")
          .select("article_id, title_tag, version")
          .in("article_id", uniqueIds);

        if (outlines && outlines.length > 0) {
          const outlineMap = new Map(outlines.map((o: any) => [o.article_id, o]));
          for (const f of needsEnrichment) {
            const lookupId = f.articleId || f.articleLink?.match(/\/editor\/([^/?]+)/)?.[1];
            if (!lookupId) continue;
            const outline = outlineMap.get(lookupId);
            if (outline) {
              if (f.articleTitle === "Unknown Article" && outline.title_tag) {
                f.articleTitle = outline.title_tag;
              }
              if (!f.version && outline.version) {
                f.version = outline.version;
              }
            }
          }
        }
      }
    }

    return feedback;
  } catch (err) {
    console.error("[EditingFeedback] Exception:", err);
    return [];
  }
}
