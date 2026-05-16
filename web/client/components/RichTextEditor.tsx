import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit2, Eye } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  titleText?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter content...",
  rows = 10,
  titleText,
}: RichTextEditorProps) {
  // Start in edit mode by default so users can edit immediately
  const [isEditMode, setIsEditMode] = useState(true);

  // Check if content looks like HTML (but show edit mode regardless)
  const isHTML = /<[^>]+>/.test(value);

  const stripMetaBlocks = (html: string): string => {
    let out = html;

    // Remove the first table if it contains metadata
    out = out.replace(/^[\s\n]*<table[\s\S]*?<\/table>[\s\n]*/i, "");

    // Remove any remaining tables with metadata
    out = out.replace(/<table[\s\S]*?<\/table>/gi, (m) => {
      const lower = m.toLowerCase();
      if (
        lower.includes("client name") ||
        lower.includes("keyword") ||
        lower.includes("title")
      ) {
        return "";
      }
      return m;
    });

    // Remove paragraphs or divs containing metadata labels
    out = out.replace(
      /<(?:p|div)[^>]*>[\s\S]*?(?:Client Name|Keyword|Title)[\s\S]*?<\/(?:p|div)>/gi,
      "",
    );

    // Remove all hr tags
    out = out.replace(/<hr[^>]*>/gi, "");

    // Clean up extra whitespace at the start
    out = out.replace(/^[\s\n]+/g, "");

    return out;
  };

  const renderedHtml = titleText ? stripMetaBlocks(value) : value;

  // ALWAYS show textarea - no preview mode, just direct editing
  // This ensures onChange handler is always called

  return (
    <div className="space-y-3">
      {isHTML && isEditMode && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(false)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono"
        rows={rows}
      />
    </div>
  );
}
