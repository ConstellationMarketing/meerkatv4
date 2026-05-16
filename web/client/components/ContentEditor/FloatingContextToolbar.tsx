import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  Heading1,
  ChevronDown,
  List,
  ListOrdered,
  Table2,
} from "lucide-react";

interface FloatingContextToolbarProps {
  visible: boolean;
  x: number;
  y: number;
  onApplyFormatting: (command: string, value?: string) => void;
  onApplyBlockFormatting?: (tag: string) => void;
  selectedHeading?: string;
  setSelectedHeading?: (heading: string) => void;
}

export function FloatingContextToolbar({
  visible,
  x,
  y,
  onApplyFormatting,
  onApplyBlockFormatting,
  selectedHeading = "paragraph",
  setSelectedHeading,
}: FloatingContextToolbarProps) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        headingMenuRef.current &&
        !headingMenuRef.current.contains(e.target as Node)
      ) {
        setShowHeadingMenu(false);
      }
    };

    if (showHeadingMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showHeadingMenu]);

  const toolbarStyle = useMemo(() => {
    const toolbarWidth = Math.min(500, windowSize.width - 40);
    let adjustedX = x;
    let adjustedY = y;

    adjustedX = Math.max(toolbarWidth / 2 + 20, adjustedX);
    adjustedX = Math.min(windowSize.width - toolbarWidth / 2 - 20, adjustedX);

    return {
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
      transform: "translateX(-50%)",
      maxWidth: `min(${toolbarWidth}px, 90vw)`,
    };
  }, [x, y, windowSize]);

  if (!visible) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed bg-white border border-border rounded-lg shadow-xl z-[9999] flex items-center gap-1 p-1.5 sm:p-2 flex-wrap"
      style={toolbarStyle}
    >
      {/* Text Formatting */}
      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApplyFormatting("bold")}
        title="Bold (Ctrl+B)"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Bold className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApplyFormatting("italic")}
        title="Italic (Ctrl+I)"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Italic className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApplyFormatting("underline")}
        title="Underline (Ctrl+U)"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Underline className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <div className="h-5 sm:h-6 w-px bg-border/30" />

      {/* Block Formatting */}
      <div className="relative" ref={headingMenuRef}>
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          title="Heading"
          className="h-7 sm:h-8 gap-0.5 sm:gap-1 px-1 sm:px-2 hover:bg-primary/10 hover:text-primary transition-colors flex items-center text-xs sm:text-sm"
        >
          {selectedHeading === "paragraph" && (
            <span className="text-xs">P</span>
          )}
          {selectedHeading === "h1" && (
            <Heading1 className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
          {selectedHeading === "h2" && (
            <span className="text-xs sm:text-sm font-bold">H2</span>
          )}
          {selectedHeading === "h3" && (
            <span className="text-xs sm:text-sm font-bold">H3</span>
          )}
          {selectedHeading === "h4" && (
            <span className="text-xs sm:text-sm font-bold">H4</span>
          )}
          {selectedHeading === "h5" && (
            <span className="text-xs sm:text-sm font-bold">H5</span>
          )}
          <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </Button>

        {showHeadingMenu && (
          <div
            className="absolute top-full mt-1 left-0 bg-white border border-border/30 rounded-lg shadow-lg z-[10000] min-w-max text-xs sm:text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onApplyBlockFormatting?.("p");
                setSelectedHeading?.("paragraph");
                setShowHeadingMenu(false);
              }}
              className="w-full px-2 sm:px-3 py-1 sm:py-2 text-left text-foreground hover:bg-primary/10 transition-colors active:bg-primary/20"
            >
              Paragraph
            </button>
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onApplyBlockFormatting?.(`h${level}`);
                  setSelectedHeading?.(`h${level}`);
                  setShowHeadingMenu(false);
                }}
                className="w-full px-2 sm:px-3 py-1 sm:py-2 text-left text-foreground hover:bg-primary/10 transition-colors active:bg-primary/20"
              >
                Heading {level}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 sm:h-6 w-px bg-border/30" />

      {/* Lists */}
      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApplyFormatting("insertUnorderedList")}
        title="Bullet List"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <List className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApplyFormatting("insertOrderedList")}
        title="Numbered List"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <ListOrdered className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <div className="h-5 sm:h-6 w-px bg-border/30" />

      {/* Advanced Tools */}
      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const url = prompt("Enter URL:", "https://");
          if (url) {
            onApplyFormatting("createLink", url);
          }
        }}
        title="Insert Link"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Link2 className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          alert("Table tool coming soon");
        }}
        title="Insert Table"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <Table2 className="w-3 h-3 sm:w-4 sm:h-4" />
      </Button>
    </div>,
    document.body,
  );
}
