import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Save, X } from "lucide-react";
import { useState } from "react";

interface MetadataField {
  label: string;
  key: string;
  value: string | number | null;
}

interface EditableMetadataProps {
  fields: MetadataField[];
  isEditMode: boolean;
  copiedSection: string | null;
  onCopy: () => void;
  onSave?: (field: string, value: string) => void;
}

export function EditableMetadata({
  fields,
  isEditMode,
  copiedSection,
  onCopy,
  onSave,
}: EditableMetadataProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleEditStart = (field: MetadataField) => {
    setEditingField(field.key);
    setEditValue(String(field.value || ""));
  };

  const handleEditSave = (key: string) => {
    onSave?.(key, editValue);
    setEditingField(null);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {fields.map((field) => (
        <div key={field.label}>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {field.label}
          </label>
          {isEditMode && editingField === field.key ? (
            <div className="flex gap-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="bg-white text-sm"
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditSave(field.key)}
                className="h-8 w-8 p-0"
              >
                <Save className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingField(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div
              className={`bg-muted/40 border border-border/30 rounded-lg p-3 text-sm text-foreground break-words ${
                isEditMode ? "cursor-pointer hover:bg-muted/60" : ""
              }`}
              onClick={() =>
                isEditMode && handleEditStart(field)
              }
            >
              {field.value || (
                <span className="text-muted-foreground italic">—</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
