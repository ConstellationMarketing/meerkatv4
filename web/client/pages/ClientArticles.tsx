import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Grid3x3, List } from "lucide-react";
import { ArticleOutline } from "@/types/article";
import { getArticleOutlines } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/team-members";

interface ClientArticlesProps {
  clientName: string;
  clientId?: string | null;
  onBack: () => void;
  onSelectArticle: (id: string) => void;
  onCreateNew?: () => void;
  refreshKey?: number;
}

export function ClientArticles({
  clientName,
  clientId,
  onBack,
  onSelectArticle,
  onCreateNew,
  refreshKey = 0,
}: ClientArticlesProps) {
  const [articles, setArticles] = useState<ArticleOutline[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        let userId: string | undefined;
        let userRole: "admin" | "member" | undefined;

        if (user) {
          userId = user.id;
          userRole = (await getUserRole(user.id)) || undefined;
        }

        const allArticles = await getArticleOutlines({
          userId,
          userRole: userRole as "admin" | "member" | undefined,
        });
        const clientArticles = allArticles.filter((article) =>
          clientId
            ? article.clientId === clientId
            : article.clientName === clientName,
        );
        setArticles(clientArticles);
      } catch (error) {
        console.error("Error fetching articles:", error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [clientName, refreshKey]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const filteredArticles = articles.filter((article) =>
    article.keyword.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card p-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
              title="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {clientName}
              </h1>
              {clientId && (
                <p className="text-xs text-muted-foreground">ID: {clientId}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {filteredArticles.length} of {articles.length} article
                {articles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <div className="flex gap-1 border border-border rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 w-8 p-0"
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "gallery" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("gallery")}
                className="h-8 w-8 p-0"
                title="Gallery view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
            {onCreateNew && (
              <Button onClick={onCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                New Article
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <Input
          placeholder="Search articles by keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-muted-foreground text-center">
              No articles created for {clientName} yet.
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Create a new outline or head back to the client list to work on
              another project.
            </p>
            <Button onClick={onBack} variant="outline">
              Back
            </Button>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-muted-foreground text-center">
              No articles match your search.
            </p>
            <Button
              onClick={() => setSearchQuery("")}
              variant="outline"
              className="gap-2"
            >
              Clear search
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <div className="max-w-4xl">
            <div className="space-y-2">
              {filteredArticles.map((article) => (
                <button
                  key={article.articleId || article.id}
                  onClick={() =>
                    onSelectArticle(article.articleId || article.id)
                  }
                  className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors hover:border-primary/50 group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {article.keyword}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {article.sections.length} section
                        {article.sections.length !== 1 ? "s" : ""} •{" "}
                        {formatDate(article.createdAt)} at{" "}
                        {formatTime(article.createdAt)}
                        {article.version && (
                          <> • <span className="text-foreground font-medium">{article.version}</span></>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        Article ID:{" "}
                        <span className="text-foreground">
                          {article.articleId}
                        </span>
                      </p>
                    </div>
                    {article.webhookSent && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">
                        ✓
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {filteredArticles.map((article) => (
              <button
                key={article.articleId || article.id}
                onClick={() => onSelectArticle(article.articleId || article.id)}
                className="text-left p-5 rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors hover:border-primary/50 group hover:shadow-md"
              >
                <div className="flex flex-col h-full gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {article.keyword}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      {article.sections.length} section
                      {article.sections.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="border-t border-border/30 pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(article.createdAt)}
                      <br />
                      {formatTime(article.createdAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      ID: {article.articleId}
                    </p>
                    {article.version && (
                      <p className="text-[10px] font-medium text-foreground">
                        {article.version}
                      </p>
                    )}
                  </div>

                  {article.webhookSent && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ✓ Processed
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
