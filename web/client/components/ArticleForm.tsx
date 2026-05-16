import { useState, useEffect, useCallback } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { ArticleOutline, ArticleSection } from "@/types/article";
import { saveArticleOutline, generateId, getTemplates } from "@/lib/storage";
import {
  sendOutlineToWebhook,
  sendConstellationWebhook,
  type WebhookError,
} from "@/lib/webhook";
import { OUTLINE_TEMPLATES } from "@/lib/templates";
import { OutlineTemplate } from "@/lib/templates";
import {
  getClientFolders,
  ClientFolder,
  CLIENT_FOLDERS_UPDATED_EVENT,
} from "@/lib/client-folders";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { WebhookErrorDisplay } from "@/components/WebhookErrorDisplay";
import { WebhookDebugPanel } from "@/components/WebhookDebugPanel";

interface ArticleFormProps {
  onSuccess: (articleId: string) => void;
  initialClientName?: string;
  refreshKey?: number;
}

interface FormData {
  clientName: string;
  clientId: string;
  keyword: string;
  sections: ArticleSection[];
}

export function ArticleForm({
  onSuccess,
  initialClientName,
  refreshKey = 0,
}: ArticleFormProps) {
  const { toast } = useToast();
  const [clientFolders, setClientFolders] = useState<ClientFolder[]>([]);
  const [formData, setFormData] = useState<FormData>({
    clientName: initialClientName || "",
    clientId: "",
    keyword: "",
    sections: [],
  });
  const refreshClientFolders = useCallback(async (): Promise<
    ClientFolder[]
  > => {
    const folders = await getClientFolders();
    setClientFolders(folders);
    return folders;
  }, []);

  const [templates, setTemplates] = useState<OutlineTemplate[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [webhookErrors, setWebhookErrors] = useState<WebhookError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<
    "idle" | "sending" | "processing" | "success" | "error"
  >("idle");
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [templateSelected, setTemplateSelected] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          console.log("✓ User loaded in ArticleForm:", user.id);
          setUserId(user.id);
        } else {
          console.warn("⚠️ getCurrentUser returned null in ArticleForm");
        }
      } catch (error) {
        console.error("❌ Error getting current user in ArticleForm:", error);
      } finally {
        setIsUserLoaded(true);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const folders = await refreshClientFolders();

      // If initialClientName was provided, set the clientId
      if (initialClientName) {
        const selectedFolder = folders.find(
          (f) => f.name === initialClientName,
        );
        if (selectedFolder) {
          setFormData((prev) => ({
            ...prev,
            clientId: selectedFolder.client_id,
          }));
        }
      }

      // Load templates from storage or use defaults
      const storedTemplates = await getTemplates();
      if (storedTemplates.length > 0) {
        setTemplates(storedTemplates);
      } else {
        setTemplates(OUTLINE_TEMPLATES);
      }
    };
    fetchData();
  }, [initialClientName, refreshKey, refreshClientFolders]);

  const handleClientNameChange = (value: string) => {
    const selectedFolder = clientFolders.find((f) => f.name === value);
    setFormData((prev) => ({
      ...prev,
      clientName: value,
      clientId: selectedFolder?.client_id || "",
    }));
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, keyword: e.target.value }));
  };

  const handleSectionChange = (
    id: string,
    field: "title" | "description" | "content",
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === id ? { ...section, [field]: value } : section,
      ),
    }));
  };

  const addSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { id: generateId(), title: "", description: "" },
      ],
    }));
  };

  const removeSection = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== id),
    }));
  };

  const toggleSectionExpanded = (id: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        sections: template.sections.map((section) => ({
          id: generateId(),
          title: section.title,
          description: section.description,
          content: "",
          examples: section.examples || "",
          targetWordCount: section.targetWordCount,
        })),
      }));
      setSelectedTemplateName(template.name);
      setTemplateSelected(true);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.clientName.trim()) {
      newErrors.push("Client name is required");
    }

    if (!formData.clientId.trim()) {
      newErrors.push("Client ID is required");
    }

    if (!formData.keyword.trim()) {
      newErrors.push("Keyword is required");
    }

    if (formData.sections.length === 0) {
      newErrors.push("At least one section is required");
    }

    const incompleteSections = formData.sections.some((s) => !s.title.trim());

    if (incompleteSections) {
      newErrors.push("All sections must have a title");
    }

    setErrors(newErrors);

    // Don't show toast - error will be displayed in form

    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors([]); // Clear any previous errors
    setWebhookErrors([]); // Clear webhook errors
    try {
      const now = new Date().toISOString();
      const id = generateId();
      const outline: ArticleOutline = {
        id: id,
        articleId: id,
        clientName: formData.clientName,
        clientId: formData.clientId,
        keyword: formData.keyword,
        template: selectedTemplateName || undefined,
        sections: formData.sections,
        createdAt: now,
        updatedAt: now,
        webhookSent: false,
        userId: userId || undefined,
      };

      console.log("📝 Creating article outline with userId:", userId);
      console.log("📝 Outline data:", {
        id: outline.id,
        keyword: outline.keyword,
        clientName: outline.clientName,
        userId: outline.userId,
        sectionsCount: outline.sections.length,
      });

      // Do NOT save on frontend - let n8n be the sole creator to avoid duplicate key errors
      // The webhook payload includes userId so n8n can save with the correct user_id

      // Send to appropriate webhook based on client
      setWebhookStatus("sending");

      let webhookResponse: any;
      if (formData.clientId === "client_mk422mq9") {
        // Constellation client - send only to Constellation webhook
        console.log(
          "🔔 Sending to Constellation webhook for client:",
          formData.clientId,
        );
        webhookResponse = await sendConstellationWebhook(outline);
      } else {
        // All other clients - send to main n8n webhook
        console.log(
          "📝 Sending to main n8n webhook for client:",
          formData.clientId,
        );
        webhookResponse = await sendOutlineToWebhook(outline);
      }

      if (webhookResponse.status === "success") {
        setWebhookStatus("processing");

        toast({
          title: "Success",
          description:
            "Sent! Give Meerkat a couple of minutes and you'll receive the completed article.",
          duration: 3000,
        });

        setWebhookStatus("success");
      } else if (webhookResponse.status === "validation_failed") {
        setWebhookStatus("error");
        setWebhookErrors(webhookResponse.errors || []);
        setShowDebugPanel(true);

        toast({
          title: "Webhook Validation Error",
          description:
            "The webhook received validation errors. Check the error details below.",
          variant: "destructive",
        });
      } else if (webhookResponse.status === "error") {
        setWebhookStatus("error");
        setWebhookErrors(webhookResponse.errors || []);
        setShowDebugPanel(true);

        toast({
          title: "Warning",
          description:
            "Article outline created but failed to send to webhook. Check the error details below.",
          variant: "destructive",
        });
      }

      onSuccess(outline.articleId);
    } catch (error) {
      console.error("Error saving:", error);
      setErrors(["Failed to save. Please try again."]);
      setWebhookStatus("error");
      toast({
        title: "Error",
        description: "Failed to create article outline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleClientFolderUpdate = () => {
      refreshClientFolders();
    };
    window.addEventListener(
      CLIENT_FOLDERS_UPDATED_EVENT,
      handleClientFolderUpdate,
    );
    return () => {
      window.removeEventListener(
        CLIENT_FOLDERS_UPDATED_EVENT,
        handleClientFolderUpdate,
      );
    };
  }, [refreshClientFolders]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-4xl p-8">
          {/* User Loading Error */}
          {isUserLoaded && !userId && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-semibold text-destructive">
                Unable to verify user information
              </p>
              <p className="text-sm text-destructive mt-2">
                Could not load user information. Please refresh the page and try
                again.
              </p>
            </div>
          )}

          {/* Validation Error Messages */}
          {errors.length > 0 && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-semibold text-destructive">
                Error: All fields are required to be filled out to proceed. 🐱
              </p>
            </div>
          )}

          {/* Webhook Error Messages */}
          {webhookErrors.length > 0 && (
            <>
              <WebhookErrorDisplay errors={webhookErrors} />
              <div className="mb-6 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebugPanel(true)}
                  className="gap-2"
                >
                  ��� View Debug Info
                </Button>
              </div>
            </>
          )}

          {/* Webhook Status Message */}
          {webhookStatus === "processing" && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                <div>
                  <p className="font-semibold text-blue-900">
                    ⏳ Processing Article
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    n8n is generating your article. This typically takes 30-60
                    seconds. You'll be notified when it's ready.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Client Info Section */}
          <div className="rounded-lg border border-border bg-background p-6 mb-6">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Article Information
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Fields marked with * are required
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="clientName" className="text-sm font-medium">
                  Client Name *
                </Label>
                <SearchableSelect
                  id="clientName"
                  placeholder="Select a client..."
                  value={formData.clientName}
                  onChange={handleClientNameChange}
                  options={clientFolders.map((f) => f.name)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="keyword" className="text-sm font-medium">
                  {formData.clientId === "client_mk422mq9"
                    ? "Context *"
                    : "Target Keyword *"}
                </Label>
                <Input
                  id="keyword"
                  placeholder={
                    formData.clientId === "client_mk422mq9"
                      ? "e.g., product overview, use cases, features"
                      : "e.g., best content marketing strategies"
                  }
                  value={formData.keyword}
                  onChange={handleKeywordChange}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          {/* Template Selector */}
          <div className="rounded-lg border border-border bg-background p-6 mb-6">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
              Outline Template
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Fields marked with * are required
            </p>

            <div>
              <Label htmlFor="template" className="text-sm font-medium">
                Choose a Template *
              </Label>
              <Select
                id="template"
                placeholder="Select a template..."
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="mt-2"
                defaultValue=""
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Selecting a template will replace your current sections with the
                template's sections.
              </p>
            </div>
          </div>

          {/* Sections - Only show after template is selected */}
          {templateSelected && (
            <div className="mb-6">
              <div className="mb-6">
                <Button
                  type="submit"
                  disabled={isSaving || !isUserLoaded || !userId}
                  className="gap-2 bg-primary hover:bg-primary/90"
                  title={
                    !userId && isUserLoaded
                      ? "Unable to load user information"
                      : ""
                  }
                >
                  {isSaving ? "Creating..." : "Create Article"}
                </Button>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Article Sections
                </h3>
                <span className="text-sm text-muted-foreground">
                  {formData.sections.length} section
                  {formData.sections.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {formData.sections.map((section, index) => {
                  const isExpanded = expandedSections.has(section.id);
                  return (
                    <div
                      key={section.id}
                      className="rounded-lg border border-border bg-card overflow-hidden"
                    >
                      {/* Header */}
                      <button
                        type="button"
                        onClick={() => toggleSectionExpanded(section.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <ChevronDown
                            className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              Section {index + 1}: {section.title}
                            </h4>
                            {section.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {section.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-4 bg-background space-y-4">
                          <div>
                            <Label
                              htmlFor={`section-title-${section.id}`}
                              className="text-xs font-medium"
                            >
                              Section Name *
                            </Label>
                            <Input
                              id={`section-title-${section.id}`}
                              placeholder="e.g., Definition, Introduction"
                              value={section.title}
                              onChange={(e) =>
                                handleSectionChange(
                                  section.id,
                                  "title",
                                  e.target.value,
                                )
                              }
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`section-description-${section.id}`}
                              className="text-xs font-medium"
                            >
                              Details
                            </Label>
                            <Textarea
                              id={`section-description-${section.id}`}
                              placeholder="What should this section cover?"
                              value={section.description}
                              onChange={(e) =>
                                handleSectionChange(
                                  section.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          {section.examples && (
                            <div>
                              <Label
                                htmlFor={`section-examples-${section.id}`}
                                className="text-xs font-medium"
                              >
                                Examples
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                {section.examples}
                              </p>
                            </div>
                          )}

                          {section.targetWordCount && (
                            <div>
                              <Label className="text-xs font-medium">
                                Target Word Count
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                {section.targetWordCount} words
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end pt-2 border-t border-border">
                            <Button
                              type="button"
                              onClick={() => removeSection(section.id)}
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Debug Panel */}
      <WebhookDebugPanel
        isVisible={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />
    </div>
  );
}
