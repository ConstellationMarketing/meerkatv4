import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, ArrowLeft } from "lucide-react";
import { ArticleOutline, ArticleSection } from "@/types/article";
import { generateId, saveArticleOutline } from "@/lib/storage";
import { sendOutlineToWebhook } from "@/lib/webhook";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";

interface FormData {
  clientName: string;
  keyword: string;
  sections: ArticleSection[];
}

export default function NewOutline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    clientName: "",
    keyword: "",
    sections: [{ id: generateId(), title: "", description: "" }],
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error("Error getting current user:", error);
      } finally {
        setIsUserLoaded(true);
      }
    };
    loadUser();
  }, []);

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, clientName: e.target.value }));
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, keyword: e.target.value }));
  };

  const handleSectionChange = (
    id: string,
    field: "title" | "description",
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

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.clientName.trim()) {
      newErrors.push("Client name is required");
    }

    if (!formData.keyword.trim()) {
      newErrors.push("Keyword is required");
    }

    if (formData.sections.length === 0) {
      newErrors.push("At least one section is required");
    }

    const incompleteSections = formData.sections.some(
      (s) => !s.title.trim() || !s.description.trim(),
    );

    if (incompleteSections) {
      newErrors.push("All sections must have a title and description");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const id = generateId();
      const outline: ArticleOutline = {
        id: id,
        articleId: id,
        clientName: formData.clientName,
        keyword: formData.keyword,
        sections: formData.sections,
        createdAt: now,
        updatedAt: now,
        webhookSent: false,
        userId: userId || undefined,
      };

      // Save article to Supabase FIRST with userId so n8n updates preserve it
      console.log("💾 Saving outline to Supabase with userId:", userId);
      await saveArticleOutline(outline);
      console.log("✓ Outline saved to Supabase");

      // Send to webhook to trigger article generation
      console.log(
        "📤 Sending outline to webhook for generation with userId:",
        userId,
      );
      const webhookResponse = await sendOutlineToWebhook(outline);

      if (webhookResponse.status === "success") {
        console.log("✓ Webhook sent successfully, redirecting to edit page");
        navigate(`/edit/${outline.articleId}`, {
          state: { message: "Outline created! Article generation started..." },
        });
      } else {
        setErrors([
          webhookResponse.message || "Failed to trigger article generation",
        ]);
      }
    } catch (error) {
      console.error("Error creating outline:", error);
      setErrors([
        "An error occurred while creating the outline. Please try again.",
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground">
            Create New Article Outline
          </h1>
          <p className="mt-2 text-muted-foreground">
            Define your article structure with client details and sections
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <form onSubmit={handleSubmit} className="max-w-3xl">
          {/* Error Messages */}
          {(errors.length > 0 || (!userId && isUserLoaded)) && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-semibold text-destructive mb-2">
                {!userId && isUserLoaded
                  ? "Unable to verify user"
                  : "Please fix the following errors:"}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                {!userId && isUserLoaded && (
                  <li>
                    Could not load user information. Please refresh the page and
                    try again.
                  </li>
                )}
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Client Info Section */}
          <div className="rounded-lg border border-border bg-card p-8 mb-8">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-6">
              Article Information
            </h2>

            <div className="space-y-6">
              <div>
                <Label htmlFor="clientName" className="text-sm font-medium">
                  Client Name *
                </Label>
                <Input
                  id="clientName"
                  placeholder="e.g., Acme Corporation"
                  value={formData.clientName}
                  onChange={handleClientNameChange}
                  className="mt-2"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="keyword" className="text-sm font-medium">
                  Target Keyword *
                </Label>
                <Input
                  id="keyword"
                  placeholder="e.g., best content marketing strategies"
                  value={formData.keyword}
                  onChange={handleKeywordChange}
                  className="mt-2"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                Article Sections
              </h2>
              <span className="text-sm text-muted-foreground">
                {formData.sections.length} section
                {formData.sections.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-4">
              {formData.sections.map((section, index) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-heading text-sm font-semibold text-foreground">
                      Section {index + 1}
                    </h3>
                    {formData.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        className="rounded-md p-2 hover:bg-destructive/10 transition-colors"
                        title="Remove section"
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label
                        htmlFor={`section-title-${section.id}`}
                        className="text-sm font-medium"
                      >
                        Section Title *
                      </Label>
                      <Input
                        id={`section-title-${section.id}`}
                        placeholder="e.g., Introduction"
                        value={section.title}
                        onChange={(e) =>
                          handleSectionChange(
                            section.id,
                            "title",
                            e.target.value,
                          )
                        }
                        className="mt-2"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor={`section-desc-${section.id}`}
                        className="text-sm font-medium"
                      >
                        Section Description *
                      </Label>
                      <Textarea
                        id={`section-desc-${section.id}`}
                        placeholder="Describe what should be covered in this section..."
                        value={section.description}
                        onChange={(e) =>
                          handleSectionChange(
                            section.id,
                            "description",
                            e.target.value,
                          )
                        }
                        className="mt-2"
                        rows={3}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={addSection}
              variant="outline"
              className="mt-6 gap-2"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Button
              type="submit"
              className="gap-2 bg-primary hover:bg-primary/90"
              disabled={isLoading || !isUserLoaded || !userId}
              title={
                !userId && isUserLoaded ? "Unable to load user information" : ""
              }
            >
              {isLoading ? "Creating..." : "Create Outline"}
            </Button>
            <Link to="/">
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
