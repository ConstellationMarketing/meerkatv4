import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface SelectableArticleContentProps {
  content: string;
  articleId: string;
  onCommentClick?: (text: string, position?: { x: number; y: number }) => void;
}

export function SelectableArticleContent({
  content,
  articleId,
  onCommentClick,
}: SelectableArticleContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleMouseUp = () => {
    const selection = window.getSelection();

    if (selection && selection.toString().length > 0) {
      const selectedStr = selection.toString();
      setSelectedText(selectedStr);

      // Get the position of the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current?.getBoundingClientRect();

      if (containerRect) {
        // Position the comment button at the end of the selection line, slightly to the right
        const relativeX = rect.right - containerRect.left + 4;
        const relativeY = rect.top - containerRect.top - 8;

        setTooltipPos({
          x: relativeX,
          y: relativeY,
        });
      }
    } else {
      setSelectedText("");
      setTooltipPos(null);
    }
  };

  const handleCommentClick = () => {
    if (selectedText) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onCommentClick?.(selectedText, {
          x: rect.left,
          y: rect.top,
        });
      } else {
        onCommentClick?.(selectedText, tooltipPos || undefined);
      }
      setSelectedText("");
      setTooltipPos(null);
    }
  };

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="article-content w-full p-6 bg-white rounded-lg border border-border/30 select-text relative"
        dangerouslySetInnerHTML={{ __html: content }}
        onMouseUp={handleMouseUp}
        style={{
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      />

      {selectedText && tooltipPos && (
        <div
          className="absolute z-50"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            pointerEvents: "auto",
          }}
        >
          <Button
            onClick={handleCommentClick}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-8 h-8 p-0 shadow-lg transition-all"
            title="Comment on selection"
            size="sm"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
