import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { HelpCircle, MessageCircle, Clock } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ArticleForm } from "@/components/ArticleForm";
import { ArticleEditor } from "@/components/ArticleEditor";
import { EmptyState } from "@/components/EmptyState";
import { Settings } from "@/pages/Settings";
import { ClientArticles } from "@/pages/ClientArticles";
import { SupportForm } from "@/components/SupportForm";
import { AIAssistantSidePanel } from "@/components/ContentEditor/AIAssistantSidePanel";
import { FeedbackSection } from "@/components/FeedbackSection";
import { EditingFeedbackModal } from "@/components/EditingFeedbackModal";
import {
  getClientFolders,
  saveClientFolder,
  generateId,
} from "@/lib/client-folders";
import { useArticleUpdates } from "@/hooks/use-article-updates";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/team-members";
import { getArticleOutlineById } from "@/lib/storage";
import { saveTimerAndFeedback, getExistingTimerRecord, type ExistingTimerRecord } from "@/lib/timer-feedback";
import { saveEditingFeedback } from "@/lib/editing-feedback";
import { useActivityTimer } from "@/hooks/use-activity-timer";
import { useToast } from "@/hooks/use-toast";

interface AppLayoutProps {
  onLogout?: () => void;
}

export function AppLayout({ onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();
  const { toast } = useToast();

  // Parse the current view from the URL path
  const isEditing = !!projectId;
  const isCreatingNew = location.pathname === "/create";
  const isSettingsOpen = location.pathname.startsWith("/settings");
  const isViewingClient = location.pathname.startsWith("/client/");
  const selectedClientName = isViewingClient
    ? decodeURIComponent(location.pathname.split("/client/")[1])
    : null;

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [userRole, setUserRole] = useState<"admin" | "member" | null>(null);
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isTimeRecorderOpen, setIsTimeRecorderOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isEditingFeedbackOpen, setIsEditingFeedbackOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [articleTimers, setArticleTimers] = useState<Record<string, number>>({});
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Activity-based time tracking — DISABLED 2026-05-07. Hook still imported and
  // invoked (so call sites that read trackedActiveSeconds keep working), but
  // enabled=false short-circuits the listener attachment + interval inside the
  // hook. No event listeners, no intervals, no DB writes (trackedActiveSeconds
  // stays 0 → tracked_time_seconds writes as null on feedback submit).
  // To re-enable: replace `false` below with `isEditing && !isEditingFeedbackOpen`.
  const { activeSeconds: trackedActiveSeconds, reset: resetActivityTimer } = useActivityTimer(
    false,
    projectId,
  );
  const [articleFeedback, setArticleFeedback] = useState<Record<string, string>>({});
  const [articleTitles, setArticleTitles] = useState<Record<string, string>>({});
  const [sessionStartDates, setSessionStartDates] = useState<Record<string, string>>({});
  const [articleKeywords, setArticleKeywords] = useState<Record<string, string>>({});
  const [articleWordCounts, setArticleWordCounts] = useState<Record<string, number>>({});
  const [articleDifficulties, setArticleDifficulties] = useState<Record<string, string>>({});
  const [articleClients, setArticleClients] = useState<Record<string, string>>({});
  const [articleVersions, setArticleVersions] = useState<Record<string, string>>({});
  const [shouldShowSummary, setShouldShowSummary] = useState(false);
  const [articleDataLoaded, setArticleDataLoaded] = useState<Record<string, boolean>>({});

  // Listen for article updates via webhook
  useArticleUpdates();

  // Fetch user role and email on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserId(user.id);
          setUserEmail(user.email);
          const role = await getUserRole(user.id);
          setUserRole(role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

  // Fetch article title and check for existing timer records when projectId changes
  // This always does a fresh check from Supabase, ignoring cached state
  useEffect(() => {
    const fetchArticleData = async () => {
      if (projectId) {
        // Activity timer re-hydrates from localStorage per-article inside the hook —
        // don't reset here, or we'd wipe progress when the editor navigates away and back.
        setIsTimerRunning(false);
        setIsFeedbackOpen(false);
        setShouldShowSummary(false);

        // Fetch article title, keyword, and word count
        setArticleDataLoaded((prev) => ({ ...prev, [projectId]: false }));
        try {
          const article = await getArticleOutlineById(projectId);
          if (article) {
            // Use titleTag first (most reliable), then receivedArticle title, then keyword
            const title = article.titleTag || article.receivedArticle?.title || article.keyword;
            setArticleTitles((prev) => ({
              ...prev,
              [projectId]: title,
            }));

            // Store the keyword
            if (article.keyword) {
              setArticleKeywords((prev) => ({
                ...prev,
                [projectId]: article.keyword,
              }));
            }

            // Store the word count if available
            if (article["word count"]) {
              const wordCount = article["word count"];
              setArticleWordCounts((prev) => ({
                ...prev,
                [projectId]: typeof wordCount === 'string' ? parseInt(wordCount) : wordCount,
              }));
            }

            // Store the client name if available
            if (article.clientName) {
              setArticleClients((prev) => ({
                ...prev,
                [projectId]: article.clientName,
              }));
            }

            // Store the version if available
            if (article.version) {
              setArticleVersions((prev) => ({
                ...prev,
                [projectId]: article.version!,
              }));
            }
          }
          setArticleDataLoaded((prev) => ({ ...prev, [projectId]: true }));
        } catch (error) {
          console.error("Error fetching article title:", error);
          setArticleDataLoaded((prev) => ({ ...prev, [projectId]: true }));
        }

        // Always check Supabase fresh for timer/feedback records (no caching)
        // Note: We don't filter by userEmail here so admins can see any user's edited articles
        if (projectId) {
          try {
            console.log(`[AppLayout] Fetching timer record for article: ${projectId}`);
            const existingRecord = await getExistingTimerRecord(projectId);
            console.log(`[AppLayout] Timer record result:`, existingRecord);
            if (existingRecord) {
              // Parse the time string to get seconds
              const timeParts = existingRecord["time spent"].split(":");
              const totalSeconds =
                parseInt(timeParts[0]) * 3600 +
                parseInt(timeParts[1]) * 60 +
                parseInt(timeParts[2]);

              setArticleTimers((prev) => ({
                ...prev,
                [projectId]: totalSeconds,
              }));

              setArticleFeedback((prev) => ({
                ...prev,
                [projectId]: existingRecord.feedbacks,
              }));

              // Store difficulty if available
              if (existingRecord.difficulty) {
                setArticleDifficulties((prev) => ({
                  ...prev,
                  [projectId]: existingRecord.difficulty,
                }));
              }

              // DO NOT auto-display the summary - only show when user clicks the clock icon
              // Summary data is loaded and available for display on demand
              console.log(`[AppLayout] ✅ Timer record found and cached (data available on demand)`);
              // setShouldShowSummary is NOT set here - user must click icon to see summary
            } else {
              // No record found - clear the state for this article
              setArticleTimers((prev) => {
                const updated = { ...prev };
                delete updated[projectId];
                return updated;
              });

              setArticleFeedback((prev) => {
                const updated = { ...prev };
                delete updated[projectId];
                return updated;
              });

              setArticleDifficulties((prev) => {
                const updated = { ...prev };
                delete updated[projectId];
                return updated;
              });

              setShouldShowSummary(false);
            }
          } catch (error) {
            console.error("Error checking existing timer record:", error);
          }
        }
      }
    };

    fetchArticleData();
  }, [projectId, userId, userEmail]);

  // Effect to open the popup when should ShowSummary becomes true
  useEffect(() => {
    if (shouldShowSummary && projectId) {
      console.log(`[AppLayout] shouldShowSummary is now TRUE, opening popup`);
      setIsTimeRecorderOpen(true);
    }
  }, [shouldShowSummary, projectId]);

  // Timer effect - keeps track of article editing time
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && projectId) {
      // Set session start date if not already set
      if (!sessionStartDates[projectId]) {
        setSessionStartDates((prev) => ({
          ...prev,
          [projectId]: new Date().toISOString(),
        }));
      }

      interval = setInterval(() => {
        setArticleTimers((prev) => ({
          ...prev,
          [projectId]: (prev[projectId] || 0) + 1,
        }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, projectId, sessionStartDates]);

  // Update page title based on current page
  useEffect(() => {
    let pageTitle = "Article Outline Generator";

    if (isSettingsOpen) {
      pageTitle = "Settings | Article Outline Generator";
    } else if (isCreatingNew) {
      pageTitle = "Create New Article | Article Outline Generator";
    } else if (selectedClientName) {
      pageTitle = `${selectedClientName} Articles | Article Outline Generator`;
    } else if (projectId) {
      pageTitle = "Edit Outline | Article Outline Generator";
    }

    document.title = pageTitle;
  }, [isSettingsOpen, isCreatingNew, selectedClientName, projectId]);

  // Initialize default client folders on app startup
  useEffect(() => {
    const initializeClientFolders = async () => {
      const folders = await getClientFolders();
      const existingFoldersByName = new Map(folders.map((f) => [f.name, f]));

      const initialFolders = [
        { name: "Abdin Law", client_id: "86dxhw7vt" },
        { name: "Amircani Law LLC", client_id: "12675802" },
        { name: "Andrew T. Thomas, Attorneys at Law", client_id: "115701009" },
      ];

      for (const folderData of initialFolders) {
        const existing = existingFoldersByName.get(folderData.name);
        if (existing) {
          if (existing.client_id !== folderData.client_id) {
            await saveClientFolder({
              ...existing,
              client_id: folderData.client_id,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          const newFolder = {
            id: generateId(),
            name: folderData.name,
            client_id: folderData.client_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await saveClientFolder(newFolder);
        }
      }
    };

    initializeClientFolders();
  }, []);

  // Auto-collapse sidebar when editing article, expand otherwise
  useEffect(() => {
    if (isEditing) {
      setIsSidebarCollapsed(true);
    } else if (!isCreatingNew && !isSettingsOpen) {
      setIsSidebarCollapsed(false);
    }
  }, [isEditing, isCreatingNew, isSettingsOpen]);

  const handleSelectProject = (articleId: string | null) => {
    if (articleId) {
      navigate(`/editor/${articleId}`);
    } else {
      navigate("/");
    }
  };

  const handleSelectClient = (clientName: string, clientId?: string) => {
    setSelectedClientId(clientId || null);
    navigate(`/client/${encodeURIComponent(clientName)}`);
  };

  const handleBackFromClient = () => {
    setSelectedClientId(null);
    navigate("/");
  };

  const handleCreateNew = () => {
    navigate("/create");
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  const handleAdmin = () => {
    navigate("/admin");
  };

  const handleProjectCreated = (articleId: string) => {
    navigate(`/editor/${articleId}`);
    setRefreshKey((prev) => prev + 1);
  };

  const handleProjectUpdated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleCloseSettings = () => {
    navigate("/");
    setRefreshKey((prev) => prev + 1);
  };

  const handleClientFolderChanged = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        onSelectProject={handleSelectProject}
        onSelectClient={handleSelectClient}
        onCreateNew={handleCreateNew}
        onSettings={handleSettings}
        onAdmin={handleAdmin}
        onLogout={onLogout}
        selectedProjectId={projectId || null}
        selectedClientName={selectedClientName}
        refreshKey={refreshKey}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        userRole={userRole}
        userId={userId}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {isSettingsOpen ? (
          <Settings
            onClose={handleCloseSettings}
            onClientFolderChanged={handleClientFolderChanged}
          />
        ) : isCreatingNew ? (
          <ArticleForm
            onSuccess={handleProjectCreated}
            initialClientName={selectedClientName || undefined}
            refreshKey={refreshKey}
          />
        ) : isViewingClient ? (
          <ClientArticles
            clientName={selectedClientName!}
            clientId={selectedClientId}
            onBack={handleBackFromClient}
            onSelectArticle={handleSelectProject}
            onCreateNew={handleCreateNew}
            refreshKey={refreshKey}
          />
        ) : isEditing ? (
          <ArticleEditor
            projectId={projectId!}
            onUpdate={handleProjectUpdated}
          />
        ) : (
          <EmptyState onCreateNew={handleCreateNew} />
        )}
      </div>

      {/* Floating Time Icon - Only visible when editing an article, disabled until article data loaded */}
      {isEditing && (
        <button
          onClick={() => setIsEditingFeedbackOpen(true)}
          disabled={!projectId || !articleDataLoaded[projectId]}
          className={`fixed bottom-40 right-8 h-14 w-14 rounded-full text-white shadow-lg transition-all flex items-center justify-center z-40 ${
            projectId && articleDataLoaded[projectId]
              ? "bg-slate-600 hover:bg-slate-700 hover:shadow-xl"
              : "bg-slate-400 cursor-not-allowed opacity-60"
          }`}
          title={projectId && articleDataLoaded[projectId] ? "Editing Feedback" : "Loading article data..."}
        >
          <Clock className="h-6 w-6" />
        </button>
      )}

      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setIsAIAssistantOpen(true)}
        className="fixed bottom-24 right-8 h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="Open AI Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Floating Support Button */}
      <button
        onClick={() => setIsSupportFormOpen(true)}
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="Open support request"
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {/* AI Assistant Side Panel */}
      <AIAssistantSidePanel
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        position="right"
      />

      {/* Support Form Dialog */}
      <SupportForm
        isOpen={isSupportFormOpen}
        onOpenChange={setIsSupportFormOpen}
        userEmail={userEmail}
      />

      {/* Feedback Section */}
      <FeedbackSection
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmit={async (feedback, difficulty) => {
          if (projectId) {
            setArticleFeedback((prev) => ({
              ...prev,
              [projectId]: feedback,
            }));

            setArticleDifficulties((prev) => ({
              ...prev,
              [projectId]: difficulty,
            }));

            const result = await saveTimerAndFeedback({
              articleId: projectId,
              articleTitle: articleTitles[projectId] || projectId,
              timeSpent: articleTimers[projectId] || 0,
              feedback: feedback,
              userEmail: userEmail,
              dateStarted: sessionStartDates[projectId],
              articleKeyword: articleKeywords[projectId],
              wordCount: articleWordCounts[projectId],
              difficulty: difficulty,
              client: articleClients[projectId],
            });

            if (result.success) {
              console.log("Timer and feedback saved successfully");
              // Close feedback form and show the summary instead
              setIsFeedbackOpen(false);
              setShouldShowSummary(true);
              // Keep the TimeRecorderPopup open to display the summary
            } else {
              console.error("Error saving timer and feedback:", result.error);
            }
          }
        }}
      />

      {/* Editing Feedback Modal */}
      <EditingFeedbackModal
        isOpen={isEditingFeedbackOpen}
        onClose={() => setIsEditingFeedbackOpen(false)}
        articleTitle={projectId ? articleTitles[projectId] : undefined}
        articleId={projectId}
        onSubmit={async (data) => {
          try {
            console.log("[AppLayout] Editing feedback submitted:", data);

            // Save to Supabase
            const result = await saveEditingFeedback({
              articleId: projectId,
              articleTitle: data.articleTitle || (projectId && articleTitles[projectId]) || "Unknown Article",
              userEmail: userEmail || data.userEmail || "unknown@example.com",
              timeSpent: data.timeSpent,
              trackedTimeSeconds: trackedActiveSeconds,
              issues: data.issues,
              articleLink: data.articleLink,
              version: projectId ? articleVersions[projectId] : undefined,
            });

            if (result.success) {
              toast({
                title: "Success",
                description: "Your feedback has been saved",
              });
              setIsEditingFeedbackOpen(false);
              // Reset the tracked counter so the next submission measures fresh time.
              resetActivityTimer();
            } else {
              toast({
                title: "Error",
                description: result.error || "Failed to save feedback",
                variant: "destructive",
              });
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            console.error("[AppLayout] Error submitting feedback:", errorMessage);
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}
