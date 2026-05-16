import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Heading {
  id: string;
  level: number;
  text: string;
}

interface HeadingsNavigatorProps {
  content: string;
  editorRef?: React.RefObject<HTMLDivElement>;
  isHidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
}

export function HeadingsNavigator({
  content,
  editorRef,
  isHidden: controlledIsHidden = false,
  onHiddenChange,
}: HeadingsNavigatorProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalIsHidden, setInternalIsHidden] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const extractTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled prop if provided, otherwise use internal state
  const isHidden = controlledIsHidden || internalIsHidden;

  const handleSetHidden = (hidden: boolean) => {
    if (onHiddenChange) {
      onHiddenChange(hidden);
    } else {
      setInternalIsHidden(hidden);
    }
  };

  // Extract headings from the actual rendered DOM
  const extractHeadingsFromDOM = useCallback(() => {
    if (!editorRef?.current) {
      return [];
    }

    const editor = editorRef.current;
    const headingElements = Array.from(
      editor.querySelectorAll("h1, h2, h3"),
    ) as HTMLElement[];

    if (headingElements.length === 0) {
      return [];
    }

    const extractedHeadings: Heading[] = [];
    headingElements.forEach((element, index) => {
      const tagName = element.tagName.toLowerCase();
      const level = parseInt(tagName[1]);
      const text = element.textContent || "";

      if (text.trim()) {
        extractedHeadings.push({
          id: `heading-${index}-${level}`,
          level,
          text: text.trim(),
        });
      }
    });

    return extractedHeadings;
  }, [editorRef]);

  // Initial extraction - wait for content to render
  useEffect(() => {
    if (!content) {
      setHeadings([]);
      return;
    }

    // Clear any pending timers
    if (extractTimerRef.current) {
      clearTimeout(extractTimerRef.current);
    }

    // Try to extract immediately (in case DOM is ready)
    const immediate = extractHeadingsFromDOM();
    if (immediate.length > 0) {
      setHeadings(immediate);
      return;
    }

    // If no headings found, wait for DOM to update and try again
    extractTimerRef.current = setTimeout(() => {
      const delayed = extractHeadingsFromDOM();
      if (delayed.length > 0) {
        setHeadings(delayed);
      } else {
        setHeadings([]);
      }
    }, 500);

    return () => {
      if (extractTimerRef.current) {
        clearTimeout(extractTimerRef.current);
      }
    };
  }, [content, extractHeadingsFromDOM]);

  // Handle navigation to heading
  const navigateToHeading = useCallback(
    (heading: Heading) => {
      if (!editorRef?.current) return;

      const editor = editorRef.current;
      const headingElements = Array.from(
        editor.querySelectorAll("h1, h2, h3"),
      ) as HTMLElement[];

      // Find matching heading
      let targetElement: HTMLElement | null = null;
      for (const element of headingElements) {
        const tagName = element.tagName.toLowerCase();
        const level = parseInt(tagName[1]);
        const text = element.textContent?.trim() || "";

        if (level === heading.level && text === heading.text) {
          targetElement = element;
          break;
        }
      }

      if (!targetElement) {
        return;
      }

      // Find scrollable container
      const scrollableContainer = editor.querySelector(
        '[class*="overflow-y-auto"]',
      ) as HTMLElement | null;

      if (scrollableContainer) {
        const containerTop = scrollableContainer.getBoundingClientRect().top;
        const elementTop = targetElement.getBoundingClientRect().top;
        const scrollOffset = elementTop - containerTop;
        scrollableContainer.scrollTop += scrollOffset - 100;
      } else {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      setActiveHeadingId(heading.id);
    },
    [editorRef],
  );

  // Track scroll to update active heading
  useEffect(() => {
    if (!editorRef?.current || headings.length === 0) return;

    const handleScroll = () => {
      const editor = editorRef.current;
      if (!editor) return;

      const scrollableContainer = editor.querySelector(
        '[class*="overflow-y-auto"]',
      ) as HTMLElement | null;

      if (!scrollableContainer) return;

      const headingElements = Array.from(
        editor.querySelectorAll("h1, h2, h3"),
      ) as HTMLElement[];

      let activeHeading: Heading | null = null;
      let closestDistance = Infinity;

      const containerTop = scrollableContainer.getBoundingClientRect().top;

      headingElements.forEach((element) => {
        const tagName = element.tagName.toLowerCase();
        const level = parseInt(tagName[1]);
        const text = element.textContent?.trim() || "";

        const headingObj = headings.find(
          (h) => h.level === level && h.text === text,
        );

        if (!headingObj) return;

        const elementTop = element.getBoundingClientRect().top - containerTop;
        const distance = Math.abs(elementTop - 120);

        if (distance < closestDistance) {
          closestDistance = distance;
          activeHeading = headingObj;
        }
      });

      if (activeHeading) {
        setActiveHeadingId(activeHeading.id);
      }
    };

    const editor = editorRef.current;
    const scrollableContainer = editor?.querySelector('[class*="overflow-y-auto"]');

    scrollableContainer?.addEventListener("scroll", handleScroll);

    return () => {
      scrollableContainer?.removeEventListener("scroll", handleScroll);
    };
  }, [headings, editorRef]);

  // If hidden, don't render the sidebar (will show as button in toolbar instead)
  if (isHidden) {
    return null;
  }

  const getPaddingLeft = (level: number) => {
    return `${(level - 1) * 16}px`;
  };

  return (
    <div className="w-64 border-r border-border bg-card shadow-lg flex flex-col overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="border-b border-border px-4 py-4 flex items-center justify-between bg-white/50 backdrop-blur-sm flex-shrink-0">
        <h3 className="font-semibold text-sm text-foreground">Document</h3>
        <div className="flex gap-1">
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-secondary"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={() => handleSetHidden(true)}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-secondary"
            title="Hide navigation"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {headings.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <div className="text-lg mb-2">📄</div>
              <p className="font-medium">No headings found</p>
              <p className="text-xs mt-2 opacity-75">
                Add H1, H2, or H3 headings to your content to see them here.
              </p>
            </div>
          ) : (
            <nav className="px-2 py-4 space-y-0.5">
              {headings.map((heading) => {
                const isH1 = heading.level === 1;
                const isH2 = heading.level === 2;
                const isH3 = heading.level === 3;

                return (
                  <button
                    key={heading.id}
                    onClick={() => navigateToHeading(heading)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors",
                      isH1 && "ml-0 pl-3",
                      isH2 && "ml-4 pl-3",
                      isH3 && "ml-8 pl-3",
                      "hover:bg-secondary/50 text-muted-foreground hover:text-foreground",
                      activeHeadingId === heading.id &&
                        "bg-primary/10 text-primary font-medium",
                    )}
                  >
                    <span className={cn(
                      "line-clamp-2 break-words",
                      isH1 && "font-semibold text-sm",
                      isH2 && "font-medium text-sm",
                      isH3 && "text-sm"
                    )}>
                      {heading.text}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 bg-white/30 backdrop-blur-sm text-xs text-muted-foreground flex-shrink-0">
        {headings.length} heading{headings.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
