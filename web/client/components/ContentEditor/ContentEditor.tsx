/**
 * Content Editor with AI Optimizer - TipTap Edition
 *
 * A rich text editor component with integrated AI optimizer for content editing.
 * Features include formatting toolbar, metadata management, and AI-powered suggestions.
 *
 * @example
 * ```tsx
 * <ContentEditor
 *   initialContent="<h1>Welcome</h1>"
 *   onContentChange={(content) => console.log(content)}
 * />
 * ```
 */

import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatingContextToolbar } from "./FloatingContextToolbar";
import { AIAssistantSidePanel } from "./AIAssistantSidePanel";
import {
  Heading1,
  List,
  ListOrdered,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link2,
  ChevronDown,
  X,
  Code,
  Eye,
  Undo2,
  Redo2,
  Save,
  Copy,
  Maximize2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ContentEditorProps,
} from "./ContentEditor.types";

const DEFAULT_CONTENT = `<h1>Welcome to Content Editor</h1><p>This is a text editor where you can create and edit your content. Highlight any text to see formatting options.</p><h2>Key Features</h2><p>The AI assistant on the right can help you improve your text, suggest edits, and make changes directly.</p><h3>Get Started</h3><p>Ask the AI assistant for help with your content!</p>`;

const DEFAULT_TITLE = "My Article";
const DEFAULT_DESCRIPTION =
  "Edit your article content here. Use the formatting toolbar to style your text and the AI assistant to get suggestions.";

const ContentEditor = forwardRef<HTMLDivElement, ContentEditorProps>(
  (
    {
      initialContent = DEFAULT_CONTENT,
      initialTitle = DEFAULT_TITLE,
      initialDescription = DEFAULT_DESCRIPTION,
      onContentChange,
      onTitleChange,
      onDescriptionChange,
      onExport,
      onImport,
      titleMaxLength = 70,
      descriptionMaxLength = 156,
      showMetadataByDefault = false,
      containerClassName = "",
      onSchemaClick,
      onShowNavigation,
      isNavigationHidden = false,
      onSave,
      isSaveDisabled = false,
      articleKeyword,
      clientName,
      onExpand,
      isEditFocus = false,
      onDevView,
      onClientView,
      currentView = "seo",
      onSeoView,
      onEditView,
      onPublicView,
      onClientViewClick,
    },
    ref,
  ) => {
    // Editor state
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [showHeadingMenu, setShowHeadingMenu] = useState(false);

    const updateSelectedHeading = useCallback((editorInstance: any) => {
      // Guard against undefined editor instance
      if (!editorInstance || !editorInstance.isActive) {
        setSelectedHeading("paragraph");
        return;
      }
      // Check heading levels first
      for (let level = 1; level <= 5; level++) {
        if (editorInstance.isActive("heading", { level })) {
          setSelectedHeading(`h${level}`);
          return;
        }
      }
      // If no heading is active, it's a paragraph
      setSelectedHeading("paragraph");
    }, []);

    // UI state
    const [floatingToolbarVisible, setFloatingToolbarVisible] = useState(false);
    const [floatingToolbarPos, setFloatingToolbarPos] = useState({
      x: 0,
      y: 0,
    });
    const [selectedHeading, setSelectedHeading] = useState("paragraph");
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
    const savedSelectionRef = useRef<any>(null);

    // Refs
    const headingButtonRef = useRef<HTMLDivElement>(null);

    // TipTap Editor
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5],
          },
          bulletList: true,
          orderedList: true,
          listItem: true,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-primary underline cursor-pointer",
          },
        }),
        Placeholder.configure({
          placeholder: "Start typing your content here...",
        }),
        CharacterCount,
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class:
            "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none w-full h-full px-6 pt-1 pb-0",
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        onContentChange?.(html);
        updateSelectedHeading(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        updateSelectedHeading(editor);
      },
      onTransaction: ({ editor }) => {
        updateSelectedHeading(editor);
      },
    });

    // Effects

    useEffect(() => {
      if (editor) {
        // Check heading levels first
        for (let level = 1; level <= 5; level++) {
          if (editor.isActive("heading", { level })) {
            setSelectedHeading(`h${level}`);
            return;
          }
        }
        // If no heading is active, it's a paragraph
        setSelectedHeading("paragraph");
      }
    }, [editor]);

    // Format article content for copying
    const formatArticleForCopy = useCallback(() => {
      let formattedText = "";

      // Add Keyword
      formattedText += "Keyword: ";
      if (articleKeyword) {
        formattedText += articleKeyword;
      }
      formattedText += "\n";

      // Add Title Tag
      formattedText += "Title Tag: ";
      if (initialTitle) {
        formattedText += initialTitle;
      }
      formattedText += "\n";

      // Add Meta Description
      formattedText += "Meta Description: ";
      if (initialDescription) {
        formattedText += initialDescription;
      }
      formattedText += "\n\n";

      // Add separator line
      formattedText += "_______________________________________________\n\n";

      // Extract text while preserving heading hierarchy and structure
      const htmlContent = editor?.getHTML() || initialContent;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;

      const extractText = (element: Element, inList = false): string => {
        let text = "";

        for (const child of Array.from(element.children)) {
          const tagName = (child.tagName || "").toUpperCase();

          if (tagName.match(/^H[1-6]$/)) {
            const childText = child.textContent || "";
            // Add heading with blank lines before and after for spacing
            text += "\n" + childText + "\n";
          } else if (tagName === "P") {
            const content = child.textContent || "";
            if (content.trim()) {
              text += content + "\n\n";
            }
          } else if (tagName === "UL") {
            // Handle unordered lists
            const listItems = Array.from(child.children).filter(
              (el) => (el.tagName || "").toUpperCase() === "LI",
            );
            for (const li of listItems) {
              const liText = li.textContent || "";
              text += "• " + liText.trim() + "\n";
            }
            text += "\n";
          } else if (tagName === "OL") {
            // Handle ordered lists
            let itemIndex = 1;
            const listItems = Array.from(child.children).filter(
              (el) => (el.tagName || "").toUpperCase() === "LI",
            );
            for (const li of listItems) {
              const liText = li.textContent || "";
              text += itemIndex + ". " + liText.trim() + "\n";
              itemIndex++;
            }
            text += "\n";
          } else if (tagName === "LI") {
            if (!inList) {
              text += "• " + (child.textContent || "").trim() + "\n";
            }
          } else if (tagName === "BLOCKQUOTE") {
            text += "> " + (child.textContent || "").trim() + "\n\n";
          } else if (tagName === "PRE") {
            text += "```\n" + (child.textContent || "") + "\n```\n\n";
          } else if (tagName !== "STYLE" && tagName !== "SCRIPT") {
            text += extractText(child, inList);
          }
        }
        return text;
      };

      formattedText += extractText(tempDiv);

      // Normalize spacing: collapse multiple blank lines to maximum one blank line
      formattedText = formattedText.replace(/\n\n\n+/g, "\n\n");

      return formattedText.trim();
    }, [
      editor,
      initialContent,
      initialTitle,
      initialDescription,
      articleKeyword,
    ]);

    const handleCopy = async () => {
      try {
        const editorHtmlContent = editor?.getHTML() || initialContent;

        // Aggressively strip ALL style attributes from HTML string
        const stripStylesFromHtml = (html: string): string => {
          // Remove all style attributes and their values
          let cleaned = html.replace(/\s+style="[^"]*"/gi, "");
          cleaned = cleaned.replace(/\s+style='[^']*'/gi, "");
          cleaned = cleaned.replace(/\s+style=`[^`]*`/gi, "");
          // Also remove class attributes that might carry styling
          cleaned = cleaned.replace(/\s+class="[^"]*"/gi, "");
          cleaned = cleaned.replace(/\s+class='[^']*'/gi, "");
          return cleaned;
        };

        // Clean the editor content first
        const cleanedContent = stripStylesFromHtml(editorHtmlContent);

        // Build formatted HTML with metadata
        let htmlContent = "";
        htmlContent +=
          "<p><strong>Keyword:</strong> " + (articleKeyword || "") + "</p>";
        htmlContent +=
          "<p><strong>Title Tag:</strong> " + (initialTitle || "") + "</p>";
        htmlContent +=
          "<p><strong>Meta Description:</strong> " +
          (initialDescription || "") +
          "</p>";
        htmlContent += "<p>_______________________________________________</p>";
        htmlContent += cleanedContent;

        // Create a hidden container with proper styling to ensure bullets render
        const container = document.createElement("div");
        container.innerHTML = htmlContent;
        container.style.position = "fixed";
        container.style.left = "-99999px";
        container.style.top = "-99999px";
        container.style.opacity = "0";
        container.style.pointerEvents = "none";
        container.style.whiteSpace = "normal";

        // Add CSS to ensure lists render properly without any background styling
        const styleEl = document.createElement("style");
        styleEl.textContent = `
          div[data-copy-container] * {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
          }
          div[data-copy-container] ul { list-style-type: disc; margin-left: 20px; padding-left: 20px; }
          div[data-copy-container] ol { list-style-type: decimal; margin-left: 20px; padding-left: 20px; }
          div[data-copy-container] li { display: list-item; margin: 5px 0; }
          div[data-copy-container] p { margin: 10px 0; }
        `;
        document.head.appendChild(styleEl);
        container.setAttribute("data-copy-container", "true");
        document.body.appendChild(container);

        // Select and copy the content
        const range = document.createRange();
        range.selectNodeContents(container);
        const sel = window.getSelection();

        let successful = false;
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          successful = document.execCommand("copy");
          sel.removeAllRanges();
        }

        // Clean up
        document.body.removeChild(container);
        if (styleEl.parentNode) {
          document.head.removeChild(styleEl);
        }

        if (successful) {
          console.debug(
            "HTML content copied with formatting and no background styles",
          );

          // Dispatch success event for toast notification
          const event = new CustomEvent("article-copied", {
            detail: { message: "Article copied to clipboard" },
          });
          window.dispatchEvent(event);
        } else {
          throw new Error("execCommand copy returned false");
        }
      } catch (error) {
        console.error("Failed to copy:", error);
        const event = new CustomEvent("article-copy-failed", {
          detail: { message: "Failed to copy article" },
        });
        window.dispatchEvent(event);
      }
    };

    // Close heading menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          headingButtonRef.current &&
          !headingButtonRef.current.contains(e.target as Node)
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

    // Sync initial content only on component mount - do NOT update on prop changes
    const initialContentRef = useRef(true);
    const initialContentStored = useRef(initialContent);

    useEffect(() => {
      if (initialContentRef.current && editor) {
        editor.commands.setContent(initialContentStored.current);
        initialContentRef.current = false;
      }
    }, [editor]);

    // Track text selection for floating toolbar
    useEffect(() => {
      if (!editor) return;

      const handleSelectionUpdate = () => {
        const { state } = editor;
        const { selection } = state;

        // Check if there's a non-empty selection
        if (selection.empty) {
          setFloatingToolbarVisible(false);
          return;
        }

        // Get the actual DOM selection to position the toolbar
        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) {
          setFloatingToolbarVisible(false);
          return;
        }

        try {
          const range = domSelection.getRangeAt(0);
          const rects = range.getClientRects();

          if (rects.length > 0) {
            // Get the topmost and leftmost positions of the selection
            let topY = Number.MAX_VALUE;
            let leftX = 0;
            let rightX = 0;
            let count = 0;

            for (let i = 0; i < rects.length; i++) {
              const rect = rects[i];
              topY = Math.min(topY, rect.top);
              leftX += rect.left;
              rightX += rect.right;
              count++;
            }

            // Calculate center X position
            const centerX = (leftX + rightX) / (count * 2);

            // Position toolbar 10px above the selection, accounting for toolbar height (~40px) and some padding
            const toolbarY = topY - 50;

            // Save the selection state for later restoration
            if (editor.state && editor.view) {
              savedSelectionRef.current = editor.state.selection;
            }

            setFloatingToolbarPos({
              x: centerX,
              y: Math.max(10, toolbarY), // Keep toolbar at least 10px from top
            });
            // Update the selected heading state when toolbar becomes visible
            updateSelectedHeading(editor);
            setFloatingToolbarVisible(true);
          }
        } catch (error) {
          console.error("Error positioning floating toolbar:", error);
          setFloatingToolbarVisible(false);
        }
      };

      // Use a small delay to ensure selection is finalized
      const handleMouseUp = () => {
        setTimeout(handleSelectionUpdate, 10);
      };

      editor.on("selectionUpdate", handleSelectionUpdate);
      editor.view.dom.addEventListener("mouseup", handleMouseUp);
      editor.view.dom.addEventListener("keyup", handleSelectionUpdate);

      return () => {
        editor.off("selectionUpdate", handleSelectionUpdate);
        editor.view.dom.removeEventListener("mouseup", handleMouseUp);
        editor.view.dom.removeEventListener("keyup", handleSelectionUpdate);
      };
    }, [editor, updateSelectedHeading]);

    // Handle floating toolbar formatting
    const handleFloatingToolbarFormat = useCallback(
      (command: string, value?: string) => {
        if (!editor) return;

        // Ensure editor has focus
        editor.view.focus();

        // Apply formatting directly - the selection should still be active
        switch (command) {
          case "bold":
            editor.chain().toggleBold().run();
            break;
          case "italic":
            editor.chain().toggleItalic().run();
            break;
          case "underline":
            editor.chain().toggleUnderline().run();
            break;
          case "insertUnorderedList":
            editor.chain().toggleBulletList().run();
            break;
          case "insertOrderedList":
            editor.chain().toggleOrderedList().run();
            break;
          case "createLink":
            if (value) {
              editor.chain().setLink({ href: value }).run();
            }
            break;
        }
      },
      [editor],
    );

    // Handle floating toolbar block formatting
    const handleFloatingToolbarBlockFormat = useCallback(
      (tag: string) => {
        if (!editor) return;

        // Ensure editor has focus
        editor.view.focus();

        // Apply block formatting - the selection should still be active
        if (tag === "p") {
          editor.chain().setParagraph().run();
        } else {
          const level = parseInt(tag.replace("h", "")) as any;
          editor.chain().toggleHeading({ level }).run();
        }
      },
      [editor],
    );

    useEffect(() => {
      setTitle(initialTitle);
    }, [initialTitle]);

    useEffect(() => {
      setDescription(initialDescription);
    }, [initialDescription]);

    // Callback functions - debounce to avoid excessive updates
    useEffect(() => {
      const timer = setTimeout(() => {
        onTitleChange?.(title);
      }, 100);
      return () => clearTimeout(timer);
    }, [title, onTitleChange]);

    useEffect(() => {
      const timer = setTimeout(() => {
        onDescriptionChange?.(description);
      }, 100);
      return () => clearTimeout(timer);
    }, [description, onDescriptionChange]);

    // Handler functions
    const setLink = useCallback(() => {
      if (!editor) return;

      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("URL", previousUrl);

      // cancelled
      if (url === null) {
        return;
      }

      // empty
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      // update link
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }, [editor]);

    if (!editor) {
      return null;
    }

    return (
      <div
        className={cn(
          "h-full flex gap-0 p-0 bg-background",
          containerClassName,
        )}
      >
        {/* Main Editor Container - includes editor and AI assistant panel */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Text Editor Section */}
          <div
            ref={ref}
            className="flex-1 flex flex-col bg-card overflow-hidden min-h-0"
          >
            {/* Editor Header */}
            <div className="bg-white/50 backdrop-blur-sm px-6 py-1 relative z-20">
              {/* Formatting Toolbar */}
              <div className="border-b border-border/30 -mx-6 px-6 py-1 flex items-center gap-1 flex-wrap bg-white/20 relative z-10">
              {/* Show Navigation Button */}
              {isNavigationHidden && onShowNavigation && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onShowNavigation}
                    className="h-8 px-2 hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                    title="Show navigation"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Show Nav
                  </Button>
                  <div className="border-r border-border/30 pr-1 h-5 mx-1"></div>
                </>
              )}

              {/* View Mode Buttons - Hidden when in expanded edit focus mode */}
              {!isEditFocus && (
                <>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-purple-200 hover:text-purple-800 transition-colors"
                      onClick={onSeoView}
                      title="SEO View - Official front page"
                    >
                      SEO View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-purple-200 hover:text-purple-800 transition-colors"
                      onClick={onEditView}
                      title="Edit View - Expanded editing mode"
                    >
                      Edit View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-purple-200 hover:text-purple-800 transition-colors"
                      onClick={onPublicView}
                      title="Public View - Public page view"
                    >
                      Public View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-purple-200 hover:text-purple-800 transition-colors"
                      onClick={onClientViewClick}
                      title="Client View - Client facing view"
                    >
                      Client View
                    </Button>
                  </div>
                  <div className="h-6 w-px bg-border/30 mx-2" />
                </>
              )}

              {/* Text Formatting */}
              <div className="flex items-center gap-1 border-r border-border/30 pr-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("bold") && "bg-primary/10 text-primary",
                  )}
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("italic") && "bg-primary/10 text-primary",
                  )}
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("underline") &&
                      "bg-primary/10 text-primary",
                  )}
                  title="Underline"
                >
                  <UnderlineIcon className="w-4 h-4" />
                </Button>
              </div>

              {/* Block Formatting */}
              <div className="flex items-center gap-1 border-r border-border/30 px-2 relative">
                <div className="relative" ref={headingButtonRef}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                    className="h-8 gap-1.5 px-2 hover:bg-primary/10 hover:text-primary transition-colors text-xs font-medium flex items-center"
                  >
                    {selectedHeading === "paragraph" && (
                      <span className="text-xs">P</span>
                    )}
                    {selectedHeading === "h1" && (
                      <Heading1 className="w-4 h-4" />
                    )}
                    {selectedHeading === "h2" && (
                      <span className="text-sm font-bold">H2</span>
                    )}
                    {selectedHeading === "h3" && (
                      <span className="text-sm font-bold">H3</span>
                    )}
                    {selectedHeading === "h4" && (
                      <span className="text-sm font-bold">H4</span>
                    )}
                    {selectedHeading === "h5" && (
                      <span className="text-sm font-bold">H5</span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  {showHeadingMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-border/30 rounded-lg shadow-lg z-50 min-w-max">
                      <button
                        onClick={() => {
                          editor.chain().focus().setParagraph().run();
                          setSelectedHeading("paragraph");
                          setShowHeadingMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10 transition-colors",
                          editor.isActive("paragraph") && "bg-primary/10",
                        )}
                      >
                        Paragraph
                      </button>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            editor
                              .chain()
                              .focus()
                              .toggleHeading({ level: level as any })
                              .run();
                            setSelectedHeading(`h${level}`);
                            setShowHeadingMenu(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10 transition-colors",
                            editor.isActive("heading", { level }) &&
                              "bg-primary/10",
                          )}
                        >
                          Heading {level}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Lists */}
              <div className="flex items-center gap-1 border-r border-border/30 px-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("bulletList") &&
                      "bg-primary/10 text-primary",
                  )}
                  title="Bullet List"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("orderedList") &&
                      "bg-primary/10 text-primary",
                  )}
                  title="Numbered List"
                >
                  <ListOrdered className="w-4 h-4" />
                </Button>
              </div>

              {/* Advanced Tools */}
              <div className="flex items-center gap-1 px-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={setLink}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
                    editor.isActive("link") && "bg-primary/10 text-primary",
                  )}
                  title="Insert Link"
                >
                  <Link2 className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSchemaClick}
                  className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Edit Schema"
                >
                  <Code className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  className={cn(
                    "h-8 w-8 p-0 transition-colors",
                    editor.can().undo()
                      ? "hover:bg-primary/10 hover:text-primary"
                      : "opacity-50 cursor-not-allowed",
                  )}
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  className={cn(
                    "h-8 w-8 p-0 transition-colors",
                    editor.can().redo()
                      ? "hover:bg-primary/10 hover:text-primary"
                      : "opacity-50 cursor-not-allowed",
                  )}
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600 transition-colors",
                    isAIAssistantOpen && "bg-blue-100 text-blue-600",
                  )}
                  title="Open AI Assistant"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>

                {!isEditFocus && <></>}
              </div>

              {/* Save and Copy Buttons - Pushed to Right */}
              <div className="flex items-center gap-1 px-2 ml-auto">
                {onSave && <div className="w-px h-6 bg-border/30 mx-1" />}

                {onSave && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onSave}
                    disabled={isSaveDisabled}
                    className="gap-2 h-8 px-3 bg-primary hover:bg-primary/90"
                    title="Save Changes"
                  >
                    <Save className="w-4 h-4" />
                    <span className="text-xs font-medium">Save</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-2 h-8 px-3 hover:bg-accent"
                  title="Copy article to clipboard"
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-xs font-medium">Copy</span>
                </Button>
              </div>
            </div>
          </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto relative bg-white/30 backdrop-blur-sm">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* AI Assistant Modal Dialog */}
        <AIAssistantSidePanel
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
          position="right"
          positionType="absolute"
        />

        {/* Floating Context Toolbar */}
        <FloatingContextToolbar
          visible={floatingToolbarVisible}
          x={floatingToolbarPos.x}
          y={floatingToolbarPos.y}
          onApplyFormatting={handleFloatingToolbarFormat}
          onApplyBlockFormatting={handleFloatingToolbarBlockFormat}
          selectedHeading={selectedHeading}
          setSelectedHeading={setSelectedHeading}
        />
      </div>
    );
  },
);

ContentEditor.displayName = "ContentEditor";

export default ContentEditor;
