import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, FileText } from "lucide-react";
import { ArticleOutline } from "@/types/article";
import {
  getArticleOutlines,
  deleteArticleOutline,
  generateId,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getUserRole } from "@/lib/team-members";

export default function HomePage() {
  const [outlines, setOutlines] = useState<ArticleOutline[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadArticles = async () => {
      try {
        const user = await getCurrentUser();
        let userId: string | undefined;
        let userRole: "admin" | "member" | undefined;

        if (user) {
          userId = user.id;
          userRole = (await getUserRole(user.id)) || undefined;
        }

        const articles = await getArticleOutlines({
          userId,
          userRole: userRole as "admin" | "member" | undefined,
        });
        setOutlines(articles);
      } catch (error) {
        console.error("Error loading articles:", error);
        const articles = await getArticleOutlines();
        setOutlines(articles);
      }
    };
    loadArticles();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      await deleteArticleOutline(id);
      const articles = await getArticleOutlines();
      setOutlines(articles);
    }
  };

  const handleNewProject = () => {
    navigate("/new-outline");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground">
                Article Outline Manager
              </h1>
              <p className="mt-2 text-muted-foreground">
                Organize and manage your article outlines with ease
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Create New Button */}
        <div className="mb-8">
          <Button
            onClick={handleNewProject}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" />
            New Article Outline
          </Button>
        </div>

        {/* Projects Grid */}
        {outlines.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">
              No article outlines yet
            </h2>
            <p className="mt-2 text-muted-foreground">
              Create your first article outline to get started
            </p>
            <Button
              onClick={handleNewProject}
              className="mt-6 gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create First Outline
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {outlines.map((outline) => (
              <div
                key={outline.id}
                className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4">
                  <h3 className="font-heading text-lg font-semibold text-foreground line-clamp-2">
                    {outline.clientName}
                  </h3>
                  <p className="mt-1 text-sm text-primary font-medium">
                    Keyword: {outline.keyword}
                  </p>
                </div>

                <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                  <p>Sections: {outline.sections.length}</p>
                  <p>Created: {formatDate(outline.createdAt)}</p>
                  {outline.receivedArticle && (
                    <p className="text-accent">✓ Article received</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link to={`/edit/${outline.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <button
                    onClick={() => handleDelete(outline.id)}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
