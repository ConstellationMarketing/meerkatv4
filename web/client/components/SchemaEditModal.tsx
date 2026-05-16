import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SchemaEditModalProps {
  visible: boolean;
  schema: string | undefined;
  onSave: (schema: string) => void;
  onCancel: () => void;
}

export function SchemaEditModal({
  visible,
  schema = "",
  onSave,
  onCancel,
}: SchemaEditModalProps) {
  const [schemaText, setSchemaText] = useState(schema);

  const extractQAPairs = (obj: any): Array<{ q: string; a: string }> => {
    const pairs: Array<{ q: string; a: string }> = [];

    const traverse = (item: any) => {
      if (!item) return;

      if (typeof item === "object") {
        // Check if this object has question/answer fields
        if (item.question && item.answer) {
          pairs.push({
            q: String(item.question),
            a: String(item.answer),
          });
        }

        // Recursively traverse nested objects and arrays
        if (Array.isArray(item)) {
          item.forEach((el) => traverse(el));
        } else {
          Object.values(item).forEach((value) => traverse(value));
        }
      }
    };

    traverse(obj);
    return pairs;
  };

  const formatSchema = (schemaString: string): string => {
    if (!schemaString || !schemaString.trim()) {
      return "";
    }

    try {
      const parsed = JSON.parse(schemaString);
      const pairs = extractQAPairs(parsed);

      if (pairs.length > 0) {
        // Format: question on line, blank line, answer on line, 2 blank lines before next question
        return pairs.map((p) => `question: ${p.q}\n\nanswer: ${p.a}`).join("\n\n\n");
      }

      // If no Q&A pairs found, return formatted JSON
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.warn("Could not parse schema JSON, returning as-is:", error);
      return schemaString;
    }
  };

  useEffect(() => {
    const formatted = formatSchema(schema || "");
    setSchemaText(formatted);
  }, [schema, visible]);

  const handleSave = () => {
    onSave(schemaText);
  };

  if (!visible) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[999]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-card rounded-lg shadow-lg z-[1000] w-[90vw] max-w-2xl max-h-[80vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 sticky top-0 bg-card">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Edit Schema
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter question and answer pairs for your schema. Format: question: [text] / answer: [text]
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <Textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            placeholder='question: What is...?&#10;answer: The answer is...&#10;&#10;question: How to...?&#10;answer: You can...'
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6 bg-background flex justify-end gap-3 sticky bottom-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90"
          >
            Save Schema
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
