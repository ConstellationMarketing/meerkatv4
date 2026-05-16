import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Plus,
  X,
  ArrowLeft,
  Save,
} from "lucide-react";
import { ArticleOutline, ArticleSection } from "@/types/article";
import {
  getArticleOutlineById,
  saveArticleOutline,
  generateId,
} from "@/lib/storage";
import {
  calculateWordCount,
  calculateFleschScore,
} from "@/lib/article-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useArticleUpdates } from "@/hooks/use-article-updates";

export default function EditOutline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Listen for article updates and show notifications
  useArticleUpdates();

  const [outline, setOutline] = useState<ArticleOutline | null>(null);
  const [activeTab, setActiveTab] = useState<"outline" | "article">("outline");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Initial load of article outline
  useEffect(() => {
    const loadArticle = async () => {
      if (id) {
        const found = await getArticleOutlineById(id);
        if (found) {
          setOutline(found);
          const contentLength = found?.receivedArticle?.content?.length || 0;
          const hasContent = contentLength > 0;
          const hasArticleId = !!found?.articleId;

          console.log("📥 Initial article load - COMPLETE:", {
            id,
            outlineId: found.id,
            articleId: found.articleId,
            hasReceivedArticle: !!found.receivedArticle,
            hasContent,
            contentLength,
            hasArticleId,
            updatedAt: found.updatedAt,
            contentPreview: found.receivedArticle?.content?.substring(0, 100) || "(empty)",
          });
        } else {
          console.warn("⚠️ Initial article load - NOT FOUND for id:", id);
        }
      }
    };
    loadArticle();
  }, [id]);

  // Poll for article updates (webhook callback)
  // CRITICAL: Only depend on id, not outline - outline is captured in the closure
  useEffect(() => {
    if (!id) return;

    let pollInterval: NodeJS.Timeout;
    let pollCount = 0;
    let contentDetected = false;

    // Get the initial content length to detect when NEW content arrives
    const initialContentLength = outline?.receivedArticle?.content?.length || 0;

    const checkForUpdate = async () => {
      try {
        pollCount++;
        let updated = await getArticleOutlineById(id);

        // If not found, try searching by current outline's articleId
        // (in case webhook saved it under a different ID)
        if (!updated && outline?.articleId) {
          console.log(`🔍 [Poll #${pollCount}] Not found by outline ID, trying articleId: ${outline.articleId}`);
          updated = await getArticleOutlineById(outline.articleId);
        }

        if (updated) {
          // Check if we got new content
          const newContentLength = updated.receivedArticle?.content?.length || 0;

          if (pollCount === 1) {
            console.log(`🔍 [Poll #${pollCount}] Initial check:`, {
              searchId: id,
              foundId: updated.id,
              contentLength: newContentLength,
              articleId: updated.articleId,
              hasContent: newContentLength > 0,
              source: updated.receivedArticle?.content ? "✓ has content" : "✗ no content",
            });
          } else if (newContentLength > 0 && initialContentLength === 0 && !contentDetected) {
            console.log(`✅ [Poll #${pollCount}] ARTICLE GENERATION COMPLETE! Content detected:`, {
              contentLength: newContentLength,
              contentPreview: updated.receivedArticle?.content?.substring(0, 100) || "",
              articleId: updated.articleId,
              hasArticleId: !!updated.articleId,
            });
            contentDetected = true;

            // CRITICAL: Stop polling immediately after content is detected
            // Polling every 1 second was OVERWRITING user edits with old Supabase data!
            clearInterval(pollInterval);
            console.log(`🛑 STOPPED POLLING - Content detected! No more interruptions during editing.`);
          } else if (newContentLength > 0 && pollCount % 10 === 0) {
            console.log(`🔍 [Poll #${pollCount}] Polling... content: ${newContentLength} chars`);
          }

          // ONLY update if this is NEW content from webhook (was empty, now has content)
          if (newContentLength > initialContentLength && !contentDetected) {
            console.log(`[Poll #${pollCount}] Received new article content from webhook!`);
            setOutline(updated);
          }
        } else {
          if (pollCount % 10 === 0) {
            console.log(`🔍 [Poll #${pollCount}] No article data found for ID: ${id}`);
          }
        }
      } catch (error) {
        console.error("Error fetching article during polling:", error);
      }
    };

    // Only start polling if there's NO content yet (article hasn't been generated)
    if (initialContentLength === 0) {
      console.log("🔄 Starting polling - waiting for article generation...");
      checkForUpdate();
      pollInterval = setInterval(checkForUpdate, 1000);
    } else {
      console.log("⏸️ Skipping polling - article already has content");
    }

    return () => {
      clearInterval(pollInterval);
      console.log(`🛑 Stopped polling after ${pollCount} attempts, content was detected: ${contentDetected}`);
    };
  }, [id]);

  // Auto-switch to article tab when article is generated, but don't redirect
  // (let user stay on outline page to see the generated article)
  useEffect(() => {
    if (!outline) return;

    const hasArticleId = typeof outline?.articleId === "string" && outline.articleId.length > 0;
    const contentStr = outline?.receivedArticle?.content;
    const hasContent = typeof contentStr === "string" && contentStr.trim().length > 0;

    // Only auto-switch to article tab if article was just created (has articleId but no previous content)
    // This prevents infinite loops
    if (hasArticleId && !hasContent && activeTab === "outline") {
      console.log("📄 Article created, switching to article tab to display it");
      setActiveTab("article");
    }
  }, [outline?.articleId, activeTab]);

  // Cleanup on unmount - save to localStorage as backup
  useEffect(() => {
    return () => {
      if (outline && outline.receivedArticle?.content) {
        try {
          console.log("💾 Saving to localStorage on unmount (backup)");
          const outlines = JSON.parse(localStorage.getItem("article_outlines") || "[]");
          const index = outlines.findIndex((o: ArticleOutline) => o.id === outline.id);
          if (index >= 0) {
            outlines[index] = outline;
          } else {
            outlines.push(outline);
          }
          localStorage.setItem("article_outlines", JSON.stringify(outlines));
          console.log("✅ Backed up to localStorage on unmount");
        } catch (error) {
          console.error("Error backing up to localStorage:", error);
        }
      }
    };
  }, [outline]);

  if (!outline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground">Article outline not found.</p>
          <Link to="/">
            <Button className="mt-4">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleClientNameChange = (value: string) => {
    setOutline((prev) => (prev ? { ...prev, clientName: value } : null));
  };

  const handleKeywordChange = (value: string) => {
    setOutline((prev) => (prev ? { ...prev, keyword: value } : null));
  };

  const handleSectionChange = (
    sectionId: string,
    field: "title" | "description",
    value: string,
  ) => {
    setOutline((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id === sectionId ? { ...s, [field]: value } : s,
            ),
          }
        : null,
    );
  };


  const addSection = () => {
    setOutline((prev) =>
      prev
        ? {
            ...prev,
            sections: [
              ...prev.sections,
              { id: generateId(), title: "", description: "" },
            ],
          }
        : null,
    );
  };

  const removeSection = (sectionId: string) => {
    setOutline((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.filter((s) => s.id !== sectionId),
          }
        : null,
    );
  };

  const handleSave = async () => {
    if (!outline) return;

    setIsSaving(true);
    try {
      const htmlContent = outline.receivedArticle?.content || "";

      // Calculate metrics
      const wordCount = calculateWordCount(htmlContent);
      const fleschData = calculateFleschScore(htmlContent);

      const updated = {
        ...outline,
        "word count": wordCount,
        "flesch score": `${fleschData.scoreRounded} - ${fleschData.readability}`,
        updatedAt: new Date().toISOString(),
      };

      // Save to both localStorage AND Supabase
      // saveArticleOutline will handle both automatically
      console.log("💾 Saving article...", {
        id: updated.id,
        keyword: updated.keyword,
        contentLength: htmlContent.length,
      });

      await saveArticleOutline(updated);
      setOutline(updated);
      setSaveMessage("✅ Saved successfully! (offline + cloud)");
      setTimeout(() => setSaveMessage(""), 3000);

      console.log("✅ Save complete - data is in both localStorage and Supabase!");
    } catch (error) {
      console.error("Error saving:", error);
      setSaveMessage("❌ Error saving to Supabase. Data is in localStorage.");
    } finally {
      setIsSaving(false);
    }
  };

  // Update state AND backup to localStorage (no Supabase until Save is clicked)
  const handleArticleContentChange = (value: string) => {
    const newOutline = outline
      ? {
          ...outline,
          receivedArticle: outline.receivedArticle
            ? { ...outline.receivedArticle, content: value }
            : { content: value, receivedAt: new Date().toISOString() },
        }
      : null;

    if (newOutline) {
      setOutline(newOutline);

      // Backup to localStorage on every keystroke (no auto-save to Supabase)
      try {
        const outlines = JSON.parse(localStorage.getItem("article_outlines") || "[]");
        const index = outlines.findIndex((o: ArticleOutline) => o.id === newOutline.id);
        if (index >= 0) {
          outlines[index] = newOutline;
        } else {
          outlines.push(newOutline);
        }
        localStorage.setItem("article_outlines", JSON.stringify(outlines));
      } catch (error) {
        console.error("Error backing up to localStorage:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground">
            {outline.clientName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Keyword:{" "}
            <span className="text-primary font-medium">{outline.keyword}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Article ID:{" "}
            <span className="text-primary font-medium">
              {outline.articleId}
            </span>
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8 flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab("outline")}
            className={`pb-3 font-medium transition-colors ${
              activeTab === "outline"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Article Outline
          </button>
          <button
            onClick={() => setActiveTab("article")}
            className={`pb-3 font-medium transition-colors ${
              activeTab === "article"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            disabled={!outline.receivedArticle && !outline.articleId}
          >
            Article Content
            {(outline.receivedArticle || outline.articleId) && (
              <span className="ml-2 text-xs text-accent">✓</span>
            )}
          </button>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className="mb-6 rounded-lg border border-accent/50 bg-accent/10 p-4 text-accent">
            {saveMessage}
          </div>
        )}

        {/* Outline Tab */}
        {activeTab === "outline" && (
          <div className="max-w-4xl">
            {/* Sections */}
            <div className="mb-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  Article Sections
                </h2>
                <span className="text-sm text-muted-foreground">
                  {outline.sections.length} section
                  {outline.sections.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-4">
                {outline.sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="rounded-lg border border-border bg-card p-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-heading text-sm font-semibold text-foreground">
                        Section {index + 1}
                      </h3>
                      {outline.sections.length > 1 && (
                        <button
                          onClick={() => removeSection(section.id)}
                          className="rounded-md p-2 hover:bg-destructive/10 transition-colors"
                          title="Remove section"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label
                          htmlFor={`section-title-${section.id}`}
                          className="text-sm font-medium"
                        >
                          Section Title
                        </Label>
                        <Input
                          id={`section-title-${section.id}`}
                          value={section.title}
                          onChange={(e) =>
                            handleSectionChange(
                              section.id,
                              "title",
                              e.target.value,
                            )
                          }
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor={`section-desc-${section.id}`}
                          className="text-sm font-medium"
                        >
                          Section Description
                        </Label>
                        <Textarea
                          id={`section-desc-${section.id}`}
                          value={section.description}
                          onChange={(e) =>
                            handleSectionChange(
                              section.id,
                              "description",
                              e.target.value,
                            )
                          }
                          className="mt-2"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={addSection}
                variant="outline"
                className="mt-6 gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Link to="/">
                <Button variant="outline">Back to Projects</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Article Content Tab */}
        {(() => {
          const hasReceivedArticle = !!outline.receivedArticle;
          const hasContent = !!outline.receivedArticle?.content;
          const contentLength = outline.receivedArticle?.content?.length || 0;
          const hasArticleId = !!outline.articleId;
          const isArticleTab = activeTab === "article";

          // Show article tab if: (1) we have received article data, OR (2) article was created (has articleId and we're on article tab)
          const shouldShow = isArticleTab && (hasReceivedArticle || hasArticleId);

          console.log("🎨 Article tab condition check:", {
            activeTab,
            isArticleTab,
            hasReceivedArticle,
            hasContent,
            contentLength,
            hasArticleId,
            shouldShow,
          });

          if (shouldShow) {
            console.log("📄 Rendering article content tab:", {
              contentLength,
              hasMeta: !!outline.receivedArticle?.meta,
              hasTitle: !!outline.receivedArticle?.title,
              hasArticleId,
            });
          }
          return shouldShow;
        })() && (
          <div className="max-w-4xl">
            <div className="rounded-lg border border-border bg-card p-8 mb-8">
              {outline.receivedArticle.meta && (
                <div className="mb-6 rounded-lg bg-muted p-4">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">
                    Meta Description
                  </Label>
                  <p className="mt-2 text-sm text-foreground">
                    {outline.receivedArticle.meta}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <Label className="text-sm font-medium block mb-4">Article Content</Label>
                <RichTextEditor
                  value={outline.receivedArticle?.content || ""}
                  onChange={handleArticleContentChange}
                  placeholder="Article content..."
                  rows={22}
                  titleText={outline.receivedArticle?.title || undefined}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Link to="/">
                  <Button variant="outline">Back to Projects</Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Loading State for Article Tab */}
        {(() => {
          const isArticleTab = activeTab === "article";
          const hasContent = !!outline.receivedArticle?.content;
          const hasArticleId = !!outline.articleId;

          // Hide loading if: (1) we have content, OR (2) article was created (has articleId)
          const shouldShow = isArticleTab && !hasContent && !hasArticleId;

          console.log("🎯 Loading indicator render:", {
            activeTab,
            isArticleTab,
            hasContent,
            contentLength: outline.receivedArticle?.content?.length || 0,
            hasArticleId,
            articleId: outline.articleId,
            shouldShow,
          });
          return shouldShow;
        })() && (
          <LoadingIndicator
            title="Generating Article"
            description="Meerkat is creating your article content. This typically takes 1-3 minutes. You'll see the article appear here as soon as it's ready."
          />
        )}
      </main>
    </div>
  );
}
