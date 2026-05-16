import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleOutline } from "@/types/article";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DevViewProps {
  outline: ArticleOutline;
  isOpen: boolean;
  onClose: () => void;
}

export function DevView({ outline, isOpen, onClose }: DevViewProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const generateUrlSlug = (keyword: string): string => {
    return keyword
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "")
      .replace(/-+/g, "-");
  };

  if (!isOpen) return null;

  const keyword = outline.keyword || "";
  const clientName = outline.clientName || "";
  const template = outline.template || "Not specified";
  const titleTag = outline.receivedArticle?.title || "";
  const metaDescription = outline.receivedArticle?.meta || "";
  const pageUrl = `https://example.com/${generateUrlSlug(keyword)}`;
  const urlSlug = generateUrlSlug(keyword);
  const schema = outline.schema || "{}";

  // Build the article content with proper heading hierarchy
  const buildArticleContent = (): string => {
    let content = `# ${titleTag}\n\n`;

    // Add the article body content
    if (outline.receivedArticle?.content) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = outline.receivedArticle.content;

      for (const child of Array.from(tempDiv.children)) {
        const tagName = (child.tagName || "").toUpperCase();

        if (tagName.match(/^H[1-6]$/)) {
          const level = parseInt(tagName[1]);
          const heading = child.textContent || "";
          content += `${"#".repeat(level)} ${heading}\n\n`;
        } else if (tagName === "P") {
          const paragraph = child.textContent || "";
          if (paragraph.trim()) {
            content += `${paragraph}\n\n`;
          }
        } else if (tagName === "UL" || tagName === "OL") {
          for (const li of child.querySelectorAll("li")) {
            const listItem = li.textContent || "";
            content += `• ${listItem}\n`;
          }
          content += "\n";
        } else if (tagName === "BLOCKQUOTE") {
          const quote = child.textContent || "";
          content += `> ${quote}\n\n`;
        } else if (tagName === "PRE") {
          const code = child.textContent || "";
          content += `\`\`\`\n${code}\n\`\`\`\n\n`;
        }
      }
    }

    return content.trim();
  };

  const metadataContent = `Keyword: ${keyword}
Client Name: ${clientName}
Content Type: ${template}
Page URL: ${pageUrl}
URL Slug: ${urlSlug}
Title Tag: ${titleTag}
Meta Description: ${metaDescription}`;

  const articleContent = buildArticleContent();
  const schemaContent = schema;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Public View</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Metadata Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Metadata
            </h3>
            <div className="relative border border-border/30 rounded-lg bg-card/50">
              <textarea
                readOnly
                value={metadataContent}
                className="w-full h-40 p-4 bg-transparent text-sm font-mono text-foreground resize-none border-0 focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(metadataContent, "metadata")}
                className="absolute top-2 right-2"
                title="Copy metadata"
              >
                {copiedSection === "metadata" ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Schema Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Schema
            </h3>
            <div className="relative border border-border/30 rounded-lg bg-card/50">
              <textarea
                readOnly
                value={schemaContent}
                className="w-full h-32 p-4 bg-transparent text-sm font-mono text-foreground resize-none border-0 focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(schemaContent, "schema")}
                className="absolute top-2 right-2"
                title="Copy schema"
              >
                {copiedSection === "schema" ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Article Content Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Full Article
            </h3>
            <div className="relative border border-border/30 rounded-lg bg-card/50">
              <textarea
                readOnly
                value={articleContent}
                className="w-full h-64 p-4 bg-transparent text-sm font-mono text-foreground resize-none border-0 focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(articleContent, "article")}
                className="absolute top-2 right-2"
                title="Copy article"
              >
                {copiedSection === "article" ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-6 py-4 flex justify-end">
          <Button
            onClick={onClose}
            variant="default"
            className="bg-primary hover:bg-primary/90"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
