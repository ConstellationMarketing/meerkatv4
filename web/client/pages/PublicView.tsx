import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleOutline } from "@/types/article";
import { useState, useEffect } from "react";
import { getArticleBySlug } from "@/lib/storage";
import DevViewPageContent from "./DevViewPageContent";

export default function PublicView() {
  const { clientName = "", keyword = "" } = useParams<{
    clientName: string;
    keyword: string;
  }>();
  const navigate = useNavigate();
  const [outline, setOutline] = useState<ArticleOutline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        console.log("PublicView - Fetching article:", { clientName, keyword });

        if (!clientName || !keyword) {
          setError("Invalid article URL");
          setOutline(null);
          setIsLoading(false);
          return;
        }

        const article = await getArticleBySlug(clientName, keyword);
        console.log("PublicView - Fetched article:", article);

        if (!article) {
          setError("Article not found");
          setOutline(null);
        } else {
          setOutline(article);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching article:", err);
        setError("Failed to load article");
        setOutline(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [clientName, keyword]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
          <p className="text-sm text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !outline) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-foreground font-medium mb-4">
            {error || "Article not found"}
          </p>
          <Button onClick={() => navigate(-1)} variant="default">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return <DevViewPageContent outline={outline} />;
}
