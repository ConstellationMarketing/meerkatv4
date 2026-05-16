import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  Copy,
  Download,
  Lock,
  ExternalLink,
  GripVertical,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { sendTestWebhook } from "@/lib/webhook";
import { OutlineTemplate, OUTLINE_TEMPLATES } from "@/lib/templates";
import {
  ClientFolder,
  getClientFolders,
  saveClientFolder,
  deleteClientFolder,
  generateId,
  triggerClientFoldersUpdate,
} from "@/lib/client-folders";
import { getTemplates, saveTemplates, deleteTemplate } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { webhookLogger } from "@/lib/webhook-logger";
import {
  getWebhookStatusList,
  calculateWaitTime,
  formatWebhookStatusDate,
  type WebhookStatusItem,
} from "@/lib/webhook-status";
import { updatePassword, getCurrentUser } from "@/lib/auth";
import { User } from "@/lib/auth";

interface TemplateFormData {
  name: string;
  description: string;
  sections: Array<{
    id: string;
    title: string;
    description: string;
    targetWordCount?: number;
  }>;
}

type SettingsTab =
  | "profile"
  | "templates"
  | "clients"
  | "error-logs"
  | "webhook-status"
  | "password";

export function Settings({
  onClose,
  onClientFolderChanged,
}: {
  onClose: () => void;
  onClientFolderChanged?: () => void;
}) {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [templates, setTemplates] =
    useState<OutlineTemplate[]>(OUTLINE_TEMPLATES);
  const [clientFolders, setClientFolders] = useState<ClientFolder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showClientFolderForm, setShowClientFolderForm] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [clientFolderForm, setClientFolderForm] = useState({
    name: "",
    client_id: "",
    client_info: "",
    website: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [debugHistory, setDebugHistory] = useState<any[]>([]);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusItem[]>([]);
  const [loadingWebhookStatus, setLoadingWebhookStatus] = useState(false);
  const [sendingTestWebhook, setSendingTestWebhook] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    description: "",
    sections: [
      {
        id: "1",
        title: "",
        description: "",
        targetWordCount: undefined,
      },
    ],
  });
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(
    null,
  );
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  // Sync active tab and template selection from URL
  useEffect(() => {
    const path = location.pathname.replace(/^\/settings\/?/, "");
    let tab: SettingsTab = "profile";

    if (path.startsWith("profile")) {
      tab = "profile";
    } else if (path.startsWith("templates")) {
      tab = "templates";
    } else if (path.startsWith("clients")) {
      tab = "clients";
    } else if (path.startsWith("error-logs")) {
      tab = "error-logs";
    } else if (path.startsWith("webhook-status")) {
      tab = "webhook-status";
    } else if (path.startsWith("password")) {
      tab = "password";
    }

    setActiveTab(tab);

    if (path.startsWith("templates/")) {
      const slug = decodeURIComponent(path.split("/")[1] || "");
      if (slug === "new") {
        setEditingId(null);
        setFormData({
          name: "",
          description: "",
          sections: [
            {
              id: "1",
              title: "",
              description: "",
              targetWordCount: undefined,
            },
          ],
        });
        setShowForm(true);
      } else if (slug) {
        const existing = templates.find((t) => t.id === slug);
        if (existing) {
          setEditingId(existing.id);
          setFormData({
            name: existing.name,
            description: existing.description,
            sections: existing.sections.map((s) => ({
              ...s,
              targetWordCount: s.targetWordCount,
            })),
          });
          setShowForm(true);
        }
      }
    } else if (tab === "templates") {
      setShowForm(false);
      setEditingId(null);
    }
  }, [location.pathname, templates]);

  useEffect(() => {
    const fetchData = async () => {
      const storedTemplates = await getTemplates();
      if (storedTemplates.length > 0) {
        setTemplates(storedTemplates);
      } else {
        // Show the hardcoded defaults in the UI but do NOT auto-write them to
        // Supabase. An empty getTemplates() result is not the same as an empty
        // table — it can come from a transient query failure or RLS, and the
        // previous auto-seed was the trigger that wiped existing templates
        // when paired with saveTemplates' destructive delete-missing-IDs
        // pattern. If users want to seed defaults, they create them
        // explicitly via the Settings UI.
        setTemplates(OUTLINE_TEMPLATES);
      }

      const folders = await getClientFolders();
      const existingFoldersByName = new Map(folders.map((f) => [f.name, f]));

      const initialFoldersToAdd = [
        { name: "Abdin Law", client_id: "86dxhw7vt" },
        { name: "Amircani Law LLC", client_id: "12675802" },
        { name: "Andrew T. Thomas, Attorneys at Law", client_id: "115701009" },
      ];

      let updatedFolders = [...folders];

      for (const folderData of initialFoldersToAdd) {
        const existing = existingFoldersByName.get(folderData.name);
        if (existing) {
          if (existing.client_id !== folderData.client_id) {
            const updated: ClientFolder = {
              ...existing,
              client_id: folderData.client_id,
              updated_at: new Date().toISOString(),
            };
            await saveClientFolder(updated);
            updatedFolders = updatedFolders.map((f) =>
              f.id === existing.id ? updated : f,
            );
          }
        } else {
          const newFolder: ClientFolder = {
            id: generateId(),
            name: folderData.name,
            client_id: folderData.client_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await saveClientFolder(newFolder);
          updatedFolders.push(newFolder);
        }
      }

      setClientFolders(updatedFolders);
      const history = webhookLogger.getDebugHistory();
      setDebugHistory(history);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "error-logs") {
      const history = webhookLogger.getDebugHistory();
      setDebugHistory(history);
    } else if (activeTab === "webhook-status") {
      const loadWebhookStatus = async () => {
        setLoadingWebhookStatus(true);
        const status = await getWebhookStatusList();
        setWebhookStatus(status);
        setLoadingWebhookStatus(false);
      };
      loadWebhookStatus();
    }
  }, [activeTab]);

  const handleSendTestWebhook = async () => {
    setSendingTestWebhook(true);
    try {
      const result = await sendTestWebhook();
      if (result.status === "success") {
        toast({
          title: "✓ Test Webhook Sent",
          description:
            "Test webhook sent successfully. Check the webhook status table for updates.",
          variant: "default",
        });
      } else if (result.status === "validation_failed") {
        toast({
          title: "✗ Validation Failed",
          description:
            result.message ||
            "The webhook received validation errors. Check the error logs for details.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "✗ Error Sending Webhook",
          description:
            result.errors?.[0]?.message || "Failed to send test webhook",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "✗ Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to send test webhook",
        variant: "destructive",
      });
    } finally {
      setSendingTestWebhook(false);
    }
  };

  const handleAddTemplate = () => {
    navigate("/settings/templates/new");
  };

  const handleEditTemplate = (template: OutlineTemplate) => {
    navigate(`/settings/templates/${encodeURIComponent(template.id)}`);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      alert("Template name is required");
      return;
    }

    if (formData.sections.some((s) => !s.title.trim())) {
      alert("All sections must have a title");
      return;
    }

    let updatedTemplates: OutlineTemplate[];

    if (editingId) {
      updatedTemplates = templates.map((t) =>
        t.id === editingId
          ? {
              id: t.id,
              name: formData.name,
              description: formData.description,
              sections: formData.sections,
            }
          : t,
      );
    } else {
      const newTemplate: OutlineTemplate = {
        id: `template-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        sections: formData.sections,
      };
      updatedTemplates = [...templates, newTemplate];
    }

    setTemplates(updatedTemplates);
    await saveTemplates(updatedTemplates);
    setShowForm(false);
    setEditingId(null);
    navigate("/settings/templates");
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      // Use the explicit deleteTemplate(id) path. The previous version
      // computed a filtered array and called saveTemplates(updatedTemplates),
      // which relied on saveTemplates' implicit "delete missing IDs" behavior
      // — the same pattern that wiped templates in the Apr 27/28 incident
      // when invoked with stale state. This call deletes exactly one row.
      try {
        await deleteTemplate(id);
        setTemplates(templates.filter((t) => t.id !== id));
      } catch {
        alert("Failed to delete template. Please try again.");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    navigate("/settings/templates");
  };

  const handleAddClientFolder = () => {
    setEditingFolderId(null);
    // Generate a unique Client ID automatically
    const uniqueId = `client_${generateId().substring(0, 8)}`;
    setClientFolderForm({
      name: "",
      client_id: uniqueId,
      client_info: "",
      website: "",
    });
    setShowClientFolderForm(true);
  };

  const handleEditClientFolder = (folder: ClientFolder) => {
    setEditingFolderId(folder.id);
    setClientFolderForm({
      name: folder.name,
      client_id: folder.client_id,
      client_info: folder.client_info || "",
      website: folder.website || "",
    });
    setShowClientFolderForm(true);
  };

  const handleSaveClientFolder = async () => {
    if (!clientFolderForm.name.trim()) {
      toast({
        title: "Error",
        description: "Folder name is required",
        variant: "destructive",
      });
      return;
    }

    if (!clientFolderForm.client_id.trim()) {
      toast({
        title: "Error",
        description: "Client ID is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const folder: ClientFolder = {
        id: editingFolderId || generateId(),
        name: clientFolderForm.name,
        client_id: clientFolderForm.client_id,
        client_info: clientFolderForm.client_info,
        website: clientFolderForm.website,
        created_at: editingFolderId
          ? clientFolders.find((f) => f.id === editingFolderId)?.created_at ||
            new Date().toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Attempting to save folder:", folder);
      await saveClientFolder(folder);
      console.log("Folder saved successfully");

      if (editingFolderId) {
        setClientFolders((prev) =>
          prev.map((f) => (f.id === editingFolderId ? folder : f)),
        );
      } else {
        setClientFolders((prev) => [folder, ...prev]);
      }

      setShowClientFolderForm(false);
      setClientFolderForm({
        name: "",
        client_id: "",
        client_info: "",
        website: "",
      });
      setEditingFolderId(null);

      toast({
        title: "Success",
        description: editingFolderId
          ? "Client folder updated"
          : "Client folder created",
      });
      onClientFolderChanged?.();
      triggerClientFoldersUpdate();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save client folder";

      console.error("Error saving client folder:", errorMessage);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClientFolder = async (id: string) => {
    if (confirm("Are you sure you want to delete this client folder?")) {
      try {
        await deleteClientFolder(id);
        setClientFolders((prev) => prev.filter((f) => f.id !== id));
        toast({
          title: "Success",
          description: "Client folder deleted",
        });
        onClientFolderChanged?.();
        triggerClientFoldersUpdate();
      } catch (error) {
        console.error("Error deleting client folder:", error);
        toast({
          title: "Error",
          description: "Failed to delete client folder",
          variant: "destructive",
        });
      }
    }
  };

  const handleCancelClientFolder = () => {
    setShowClientFolderForm(false);
    setEditingFolderId(null);
    setClientFolderForm({
      name: "",
      client_id: "",
      client_info: "",
      website: "",
    });
  };

  const handleSectionChange = (
    index: number,
    field: "title" | "description" | "targetWordCount",
    value: string | number | undefined,
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) =>
        i === index
          ? {
              ...s,
              [field]:
                field === "targetWordCount"
                  ? value === "" || value === undefined
                    ? undefined
                    : Number(value)
                  : value,
            }
          : s,
      ),
    }));
  };

  const handleAddSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: `section-${Date.now()}`,
          title: "",
          description: "",
          targetWordCount: undefined,
        },
      ],
    }));
  };

  const handleRemoveSection = (index: number) => {
    if (formData.sections.length > 1) {
      setFormData((prev) => ({
        ...prev,
        sections: prev.sections.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSectionDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    setDraggedSectionIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  };

  const handleSectionDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();

    const sourceIndexData = event.dataTransfer.getData("text/plain");
    const sourceIndex =
      sourceIndexData !== "" ? Number(sourceIndexData) : draggedSectionIndex;

    if (
      sourceIndex === null ||
      Number.isNaN(sourceIndex) ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    setFormData((prev) => {
      const updated = [...prev.sections];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return {
        ...prev,
        sections: updated,
      };
    });

    setDraggedSectionIndex(null);
  };

  const handleCopyDebugInfo = async (index: number) => {
    const debugInfo = debugHistory[index];
    if (!debugInfo) return;

    const text = webhookLogger.exportDebugInfo(debugInfo);
    const success = await webhookLogger.copyToClipboard(text);
    if (success) {
      toast({
        title: "Copied",
        description: "Debug info copied to clipboard",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExportAllLogs = () => {
    if (debugHistory.length === 0) {
      toast({
        title: "No Logs",
        description: "There are no error logs to export",
      });
      return;
    }

    const lines: string[] = [];
    lines.push("==========================================");
    lines.push("WEBHOOK ERROR LOG EXPORT");
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Total Entries: ${debugHistory.length}`);
    lines.push("==========================================");
    lines.push("");

    debugHistory.forEach((info, index) => {
      lines.push(`--- Entry ${index + 1} ---`);
      lines.push(webhookLogger.exportDebugInfo(info));
      lines.push("");
    });

    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Success",
        description: "All logs copied to clipboard",
      });
    });
  };

  const handleClearLogs = () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      webhookLogger.clearHistory();
      setDebugHistory([]);
      toast({
        title: "Success",
        description: "Error logs cleared",
      });
    }
  };

  const handleDownloadLogs = () => {
    if (debugHistory.length === 0) {
      toast({
        title: "No Logs",
        description: "There are no error logs to download",
      });
      return;
    }

    const lines: string[] = [];
    lines.push("==========================================");
    lines.push("WEBHOOK ERROR LOG EXPORT");
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Total Entries: ${debugHistory.length}`);
    lines.push("==========================================");
    lines.push("");

    debugHistory.forEach((info, index) => {
      lines.push(`--- Entry ${index + 1} ---`);
      lines.push(webhookLogger.exportDebugInfo(info));
      lines.push("");
    });

    const text = lines.join("\n");
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    );
    element.setAttribute("download", `webhook-logs-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast({
      title: "Success",
      description: "Logs downloaded",
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await updatePassword(newPassword);
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update password";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const filteredClientFolders = clientFolders
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((folder) => {
      const query = clientSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        folder.name.toLowerCase().includes(query) ||
        folder.client_id.toLowerCase().includes(query)
      );
    });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl p-8">
          {/* Page Header */}
          <div className="mb-8">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Settings
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage templates, clients, and error logs
            </p>

            {/* Tab Navigation */}
            <div className="mt-6 flex gap-2 border-b border-border">
              <button
                onClick={() => navigate("/settings/profile")}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === "profile"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Profile
              </button>
              {currentUser?.role === "admin" && (
                <button
                  onClick={() => navigate("/settings/templates")}
                  className={`px-4 py-3 font-medium text-sm transition-colors ${
                    activeTab === "templates"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Templates
                </button>
              )}
              {currentUser?.role === "admin" && (
                <button
                  onClick={() => navigate("/settings/clients")}
                  className={`px-4 py-3 font-medium text-sm transition-colors ${
                    activeTab === "clients"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Client Folders
                </button>
              )}
              <button
                onClick={() => navigate("/settings/error-logs")}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === "error-logs"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Error Logs{" "}
                {debugHistory.length > 0 && `(${debugHistory.length})`}
              </button>
              <button
                onClick={() => navigate("/settings/webhook-status")}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === "webhook-status"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Webhook Status{" "}
                {webhookStatus.length > 0 && `(${webhookStatus.length})`}
              </button>
              <button
                onClick={() => navigate("/settings/password")}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === "password"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Change Password
              </button>
            </div>
          </div>

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="max-w-2xl space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {currentUser?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Account Information
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      View and manage your account
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-border pt-6">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Email Address
                    </Label>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-base text-foreground font-medium">
                        {currentUser?.email || "Loading..."}
                      </p>
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        ✓ Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      User ID
                    </Label>
                    <p className="mt-2 text-xs text-foreground font-mono break-all">
                      {currentUser?.id || "Loading..."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-4">
                      Want to secure your account?
                    </p>
                    <Button
                      onClick={() => navigate("/settings/password")}
                      className="gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      Change Password
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Account Security:</strong> Keep your password strong
                  and never share your login credentials. You can change your
                  password anytime from the settings.
                </p>
              </div>
            </div>
          )}

          {/* Error Logs Tab */}
          {activeTab === "error-logs" && (
            <div className="space-y-6">
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={handleExportAllLogs}
                  variant="outline"
                  className="gap-2"
                  disabled={debugHistory.length === 0}
                >
                  <Copy className="h-4 w-4" />
                  Copy All Logs
                </Button>
                <Button
                  onClick={handleDownloadLogs}
                  variant="outline"
                  className="gap-2"
                  disabled={debugHistory.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download Logs
                </Button>
                <Button
                  onClick={handleClearLogs}
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={debugHistory.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Logs
                </Button>
              </div>

              {debugHistory.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground">
                    No webhook errors logged yet. Error logs will appear here
                    when webhooks fail.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {debugHistory.map((log, index) => {
                    const hasError = !!log.error;
                    const responseStatus = log.responseStatus;

                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`h-3 w-3 rounded-full flex-shrink-0 ${
                                hasError
                                  ? "bg-destructive"
                                  : responseStatus && responseStatus < 400
                                    ? "bg-green-500"
                                    : "bg-yellow-500"
                              }`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm">
                                {hasError
                                  ? "❌ " + log.error.name
                                  : responseStatus && responseStatus >= 400
                                    ? `🟡 HTTP ${responseStatus}`
                                    : "🟢 Success"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(log.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyDebugInfo(index)}
                            className="gap-2 flex-shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        </div>

                        <div className="space-y-3 text-sm bg-background rounded p-3">
                          {log.webhookUrl && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                URL
                              </p>
                              <p className="text-xs break-all text-foreground font-mono">
                                {log.webhookUrl}
                              </p>
                            </div>
                          )}

                          {log.responseStatus !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Response Status
                              </p>
                              <p className="text-xs text-foreground font-mono">
                                {log.responseStatus}
                              </p>
                            </div>
                          )}

                          {hasError && log.error && (
                            <div className="border-t border-border pt-3">
                              <p className="text-xs font-semibold text-destructive mb-1">
                                Error
                              </p>
                              <p className="text-xs text-foreground font-mono">
                                {log.error.message}
                              </p>
                            </div>
                          )}

                          {log.payload && (
                            <details className="border-t border-border pt-3">
                              <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                                View Payload
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </details>
                          )}

                          {log.responseText && (
                            <details className="border-t border-border pt-3">
                              <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                                View Response
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                {log.responseText}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Webhook Status Tab */}
          {activeTab === "webhook-status" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Test Webhook</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send a test webhook with sample data to verify your webhook
                  configuration and endpoint are working correctly.
                </p>
                <Button
                  onClick={handleSendTestWebhook}
                  disabled={sendingTestWebhook}
                  className="gap-2"
                >
                  {sendingTestWebhook ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Sending...
                    </>
                  ) : (
                    "Send Test Webhook"
                  )}
                </Button>
              </div>

              {loadingWebhookStatus ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground">
                      Loading webhook status...
                    </p>
                  </div>
                </div>
              ) : webhookStatus.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground">
                    No articles have been sent via webhook yet.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">
                            Keyword
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">
                            Client
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">
                            Status
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">
                            Sent
                          </th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">
                            Wait Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhookStatus.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-border hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-6 py-3 text-sm text-foreground font-medium">
                              {item.keyword}
                            </td>
                            <td className="px-6 py-3 text-sm text-muted-foreground">
                              {item.clientName}
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  item.status === "received"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                }`}
                              >
                                {item.status === "received"
                                  ? "✓ Received"
                                  : "⏳ Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-xs text-muted-foreground">
                              {formatWebhookStatusDate(item.sentAt)}
                            </td>
                            <td className="px-6 py-3 text-xs text-muted-foreground font-mono">
                              {calculateWaitTime(item.sentAt, item.receivedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Password Change Tab */}
          {activeTab === "password" && (
            <div className="max-w-2xl">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Change Password
                  </h3>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <Label
                      htmlFor="new-password"
                      className="text-sm font-medium"
                    >
                      New Password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      className="mt-2"
                      disabled={isUpdatingPassword}
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="confirm-password"
                      className="text-sm font-medium"
                    >
                      Confirm Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className="mt-2"
                      disabled={isUpdatingPassword}
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="gap-2"
                    >
                      {isUpdatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>

                  <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                      <strong>Security tip:</strong> Use a strong password with
                      a mix of uppercase, lowercase, numbers, and symbols.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Client Folders Management Section */}
          {currentUser?.role === "admin" && activeTab === "clients" && (
            <div className="rounded-lg border border-border bg-background p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Client Folders
                </h3>
                {!showClientFolderForm && (
                  <div className="flex gap-2">
                    <a
                      href="https://docs.google.com/spreadsheets/d/1FZJJ1ikCbKcTT_tKJynf6pp4SzXTgx-KLvaSz1Tj07g/edit?usp=sharing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Client Info
                      </Button>
                    </a>
                    <Button onClick={handleAddClientFolder} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Client Folder
                    </Button>
                  </div>
                )}
              </div>

              {!showClientFolderForm && (
                <div className="mb-4 max-w-sm">
                  <Label
                    htmlFor="client-search"
                    className="text-sm font-medium"
                  >
                    Search Client Folders
                  </Label>
                  <Input
                    id="client-search"
                    placeholder="Search by name or Client ID"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="mt-2"
                  />
                </div>
              )}

              {showClientFolderForm ? (
                <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
                  <div>
                    <Label
                      htmlFor="folder-name"
                      className="text-sm font-medium"
                    >
                      Folder Name *
                    </Label>
                    <Input
                      id="folder-name"
                      placeholder="e.g., Abdin Law"
                      value={clientFolderForm.name}
                      onChange={(e) =>
                        setClientFolderForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="client-id" className="text-sm font-medium">
                      Client ID *
                    </Label>
                    <Input
                      id="client-id"
                      placeholder="e.g., client_123"
                      value={clientFolderForm.client_id}
                      onChange={(e) =>
                        setClientFolderForm((prev) => ({
                          ...prev,
                          client_id: e.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="website" className="text-sm font-medium">
                      Website
                    </Label>
                    <Input
                      id="website"
                      placeholder="e.g., https://example.com"
                      value={clientFolderForm.website}
                      onChange={(e) =>
                        setClientFolderForm((prev) => ({
                          ...prev,
                          website: e.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="client-info"
                      className="text-sm font-medium"
                    >
                      Client Information
                    </Label>
                    <Textarea
                      id="client-info"
                      placeholder="Describe the client's information, brand voice, tone, and writing style (up to ~300 words)"
                      value={clientFolderForm.client_info}
                      onChange={(e) =>
                        setClientFolderForm((prev) => ({
                          ...prev,
                          client_info: e.target.value,
                        }))
                      }
                      className="mt-2 resize-y min-h-[200px] max-h-[600px]"
                      rows={10}
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-border">
                    <Button
                      type="button"
                      onClick={handleCancelClientFolder}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveClientFolder}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {editingFolderId ? "Save" : "Create Folder"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientFolders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No client folders yet. Create one to get started.
                    </p>
                  ) : filteredClientFolders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No client folders match your search.
                    </p>
                  ) : (
                    filteredClientFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">
                            {folder.name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            ID: {folder.client_id}
                          </p>
                          {folder.client_info && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ✓ Client Info defined ({folder.client_info.length}{" "}
                              characters)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditClientFolder(folder)}
                            className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
                            title="Edit folder"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClientFolder(folder.id)}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
                            title="Delete folder"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Template Management Section */}
          {currentUser?.role === "admin" && activeTab === "templates" && (
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  Outline Templates
                </h3>
                {!showForm && (
                  <Button onClick={handleAddTemplate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Template
                  </Button>
                )}
              </div>

              {showForm ? (
                <div className="space-y-6">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                      <strong>Note:</strong> When creating a template, duplicate the first section. The template should only include up to 10 sections, excluding the duplicated first section.
                    </p>
                  </div>

                  <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
                  <div>
                    <Label
                      htmlFor="template-name"
                      className="text-sm font-medium"
                    >
                      Template Name *
                    </Label>
                    <Input
                      id="template-name"
                      placeholder="e.g., Practice Page"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="template-desc"
                      className="text-sm font-medium"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="template-desc"
                      placeholder="Brief description of this template"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="mt-2"
                      rows={2}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-sm font-medium">Sections *</Label>
                    </div>

                    <div className="space-y-3">
                      {formData.sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`space-y-3 bg-background p-4 rounded-lg border border-border ${
                            draggedSectionIndex === index ? "opacity-75" : ""
                          }`}
                          draggable
                          onDragStart={(event) =>
                            handleSectionDragStart(event, index)
                          }
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (
                              draggedSectionIndex !== null &&
                              event.dataTransfer
                            ) {
                              event.dataTransfer.dropEffect = "move";
                            }
                          }}
                          onDrop={(event) => handleSectionDrop(event, index)}
                          onDragEnd={() => setDraggedSectionIndex(null)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-muted-foreground cursor-move select-none">
                              <GripVertical className="h-4 w-4" />
                              <h4 className="text-sm font-medium text-foreground">
                                Section {index + 1}
                              </h4>
                            </div>
                            {formData.sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSection(index)}
                                className="text-destructive hover:text-destructive/80 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div>
                            <Label
                              htmlFor={`section-title-${index}`}
                              className="text-xs font-medium"
                            >
                              Name
                            </Label>
                            <Input
                              id={`section-title-${index}`}
                              placeholder="e.g., Introduction"
                              value={section.title}
                              onChange={(e) =>
                                handleSectionChange(
                                  index,
                                  "title",
                                  e.target.value,
                                )
                              }
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`section-desc-${index}`}
                                className="text-xs font-medium"
                              >
                                Details
                              </Label>
                              <span className="text-[11px] text-muted-foreground">
                                {(section.description || "").length} characters
                              </span>
                            </div>
                            <Textarea
                              id={`section-desc-${index}`}
                              placeholder="Describe what should be covered in this section..."
                              value={section.description}
                              onChange={(e) =>
                                handleSectionChange(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`section-target-${index}`}
                              className="text-xs font-medium"
                            >
                              Target Word Count
                            </Label>
                            <Input
                              id={`section-target-${index}`}
                              type="number"
                              min={0}
                              placeholder="e.g., 150"
                              value={section.targetWordCount ?? ""}
                              onChange={(e) =>
                                handleSectionChange(
                                  index,
                                  "targetWordCount",
                                  e.target.value,
                                )
                              }
                              className="mt-1 w-32"
                            />
                          </div>

                          <div className="pt-2 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground">
                              Details: Added by user on frontend (not editable
                              here)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <Button
                        type="button"
                        onClick={handleAddSection}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Plus className="h-3 w-3" />
                        Add Section
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-border">
                    <Button
                      type="button"
                      onClick={handleCancel}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {editingId ? "Update Template" : "Create Template"}
                    </Button>
                  </div>
                </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No templates yet. Create one to get started.
                    </p>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-start justify-between p-4 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">
                            {template.name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {template.sections.length} section
                            {template.sections.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
                            title="Edit template"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
