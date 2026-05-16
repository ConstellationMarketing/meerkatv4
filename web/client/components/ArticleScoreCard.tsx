import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ScoringDimension {
  name: string;
  status: "pass" | "flag" | "fail";
  notes: string;
}

export interface ArticleScore {
  readability: ScoringDimension;
  structure: ScoringDimension;
  localSignals: ScoringDimension;
  brandSignals: ScoringDimension;
  accuracy: ScoringDimension;
  legalEthics: ScoringDimension;
  answerSurfacing: ScoringDimension;
  internalExternalLinking: ScoringDimension;
  overallRating: "strong" | "needs-work" | "major-rework";
  topThreeIssues: string[];
  whatWorkedWell: string[];
}

interface ArticleScoreCardProps {
  articleId: string;
  articleTitle: string;
  userEmail: string;
  client: string;
  articleLink: string;
  timeSpent?: string;
  onScoreChange: (score: ArticleScore) => void;
  onSave?: (score: ArticleScore) => Promise<void>;
  initialScore?: Partial<ArticleScore>;
  isExpanded?: boolean;
  onToggleExpanded?: (articleId: string) => void;
}

const DIMENSIONS = [
  { key: "readability", label: "Readability" },
  { key: "structure", label: "Structure" },
  { key: "localSignals", label: "Local Signals" },
  { key: "brandSignals", label: "Brand Signals" },
  { key: "accuracy", label: "Accuracy" },
  { key: "legalEthics", label: "Legal Ethics" },
  { key: "answerSurfacing", label: "Answer Surfacing" },
  { key: "internalExternalLinking", label: "Internal/External Linking" },
];

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-green-50 text-green-700 border-green-200",
  flag: "bg-yellow-50 text-yellow-700 border-yellow-200",
  fail: "bg-red-50 text-red-700 border-red-200",
};

const OVERALL_RATING_COLORS: Record<string, string> = {
  "strong": "bg-green-50 text-green-700 border-green-200",
  "needs-work": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "major-rework": "bg-red-50 text-red-700 border-red-200",
};

export default function ArticleScoreCard({
  articleId,
  articleTitle,
  userEmail,
  client,
  articleLink,
  timeSpent,
  onScoreChange,
  onSave,
  initialScore,
  isExpanded = false,
  onToggleExpanded,
}: ArticleScoreCardProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const defaultScore: ArticleScore = {
    readability: { name: "Readability", status: "flag", notes: "" },
    structure: { name: "Structure", status: "flag", notes: "" },
    localSignals: { name: "Local Signals", status: "flag", notes: "" },
    brandSignals: { name: "Brand Signals", status: "flag", notes: "" },
    accuracy: { name: "Accuracy", status: "flag", notes: "" },
    legalEthics: { name: "Legal Ethics", status: "flag", notes: "" },
    answerSurfacing: { name: "Answer Surfacing", status: "flag", notes: "" },
    internalExternalLinking: {
      name: "Internal/External Linking",
      status: "flag",
      notes: "",
    },
    overallRating: "needs-work",
    topThreeIssues: ["", "", ""],
    whatWorkedWell: ["", "", ""],
  };

  const [score, setScore] = useState<ArticleScore>(
    initialScore ? { ...defaultScore, ...initialScore } : defaultScore
  );

  // Update score when initialScore changes (when data is loaded from Supabase)
  useEffect(() => {
    if (initialScore && Object.keys(initialScore).length > 0) {
      setScore((prevScore) => ({
        ...defaultScore,
        ...prevScore,
        ...initialScore,
      }));
      console.log("[ArticleScoreCard] Updated score from Supabase data:", initialScore);
    }
  }, [articleId]); // Update when article changes

  const handleDimensionStatusChange = (
    dimensionKey: string,
    newStatus: "pass" | "flag" | "fail"
  ) => {
    const updatedScore = {
      ...score,
      [dimensionKey]: {
        ...score[dimensionKey as keyof ArticleScore],
        status: newStatus,
      },
    };
    setScore(updatedScore);
    onScoreChange(updatedScore);
  };

  const handleDimensionNotesChange = (
    dimensionKey: string,
    newNotes: string
  ) => {
    const updatedScore = {
      ...score,
      [dimensionKey]: {
        ...score[dimensionKey as keyof ArticleScore],
        notes: newNotes,
      },
    };
    setScore(updatedScore);
    onScoreChange(updatedScore);
  };

  const handleOverallRatingChange = (
    newRating: "strong" | "needs-work" | "major-rework"
  ) => {
    const updatedScore = {
      ...score,
      overallRating: newRating,
    };
    setScore(updatedScore);
    onScoreChange(updatedScore);
  };

  const handleTopIssueChange = (index: number, value: string) => {
    const updatedScore = {
      ...score,
      topThreeIssues: [
        ...score.topThreeIssues.slice(0, index),
        value,
        ...score.topThreeIssues.slice(index + 1),
      ],
    };
    setScore(updatedScore);
    onScoreChange(updatedScore);
  };

  const handleWhatWorkedChange = (index: number, value: string) => {
    const updatedScore = {
      ...score,
      whatWorkedWell: [
        ...score.whatWorkedWell.slice(0, index),
        value,
        ...score.whatWorkedWell.slice(index + 1),
      ],
    };
    setScore(updatedScore);
    onScoreChange(updatedScore);
  };

  const passCount = DIMENSIONS.filter(
    (dim) =>
      score[dim.key as keyof ArticleScore]?.status === "pass"
  ).length;
  const flagCount = DIMENSIONS.filter(
    (dim) =>
      score[dim.key as keyof ArticleScore]?.status === "flag"
  ).length;
  const failCount = DIMENSIONS.filter(
    (dim) =>
      score[dim.key as keyof ArticleScore]?.status === "fail"
  ).length;

  const handleSaveAndCollapse = async () => {
    try {
      setIsSaving(true);

      // Prepare data for Supabase - use articleTitle as Article_Title for identification
      const scoringData = {
        Readability_Status: score.readability.status,
        Structure_Status: score.structure.status,
        Local_Signals_Status: score.localSignals.status,
        Brand_Signals_Status: score.brandSignals.status,
        Accuracy_Status: score.accuracy.status,
        Legal_Ethics_Status: score.legalEthics.status,
        Answer_Surfacing_Status: score.answerSurfacing.status,
        "Internal/External_Linking_Status": score.internalExternalLinking.status,
        Readability_Notes: score.readability.notes,
        Structure_Notes: score.structure.notes,
        Local_Signals_Notes: score.localSignals.notes,
        Brand_Signals_Notes: score.brandSignals.notes,
        Accuracy_Notes: score.accuracy.notes,
        Legal_Ethics_Notes: score.legalEthics.notes,
        Answer_Surfacing_Notes: score.answerSurfacing.notes,
        "Internal/External_Linking_Notes": score.internalExternalLinking.notes,
        Top_3_Issues: score.topThreeIssues.filter(Boolean).join(" | "),
        What_Work_Well: score.whatWorkedWell.filter(Boolean).join(" | "),
        Overall_Rating: score.overallRating,
        Article_Title: articleTitle,
        User: userEmail,
        Article_Link: articleLink,
        Client: client,
        Time_Spent: timeSpent || "",
      };

      // Save to Supabase
      console.log("[ArticleScoreCard] Saving scoring data:", scoringData);
      const { error } = await supabase
        .from("8_scoring_dimensions")
        .insert([scoringData]);

      if (error) {
        console.error("[ArticleScoreCard] Error saving scoring:", error);
        toast({
          title: "Error",
          description: `Failed to save scoring: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log("[ArticleScoreCard] Scoring saved successfully for:", articleTitle);
      toast({
        title: "Success",
        description: "Scoring saved successfully",
      });

      // Call the optional onSave callback
      if (onSave) {
        await onSave(score);
      }

      // Collapse the card
      onToggleExpanded?.(articleId);
    } catch (error) {
      console.error("Error saving scoring:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save scoring",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-secondary/10 hover:shadow-sm transition-shadow">
      {/* Header - Hidden */}
      <button
        onClick={() => onToggleExpanded?.(articleId)}
        className="w-full p-3 flex items-center justify-between hover:bg-secondary/30 transition-colors hidden h-0 overflow-hidden"
      >
        <div className="flex-1 text-left hidden">
          <div className="flex gap-2 text-xs flex-wrap">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
              Pass: {passCount}
            </span>
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">
              Flag: {flagCount}
            </span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
              Fail: {failCount}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                OVERALL_RATING_COLORS[score.overallRating]
              }`}
            >
              {score.overallRating.replace("-", " ")}
            </span>
          </div>
        </div>
        <div className="ml-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <div className="p-3 space-y-4 bg-secondary/20 max-h-96 overflow-y-auto">
          {/* Scoring Dimensions */}
          <div className="space-y-2 hidden">
            <h4 className="font-semibold text-xs">Scoring Dimensions</h4>
            <div className="grid grid-cols-2 gap-3">
              {DIMENSIONS.map((dimension) => {
                const dimKey = dimension.key as keyof ArticleScore;
                const dimensionData = score[dimKey];
                return (
                  <div
                    key={dimension.key}
                    className="border-2 border-border rounded-lg p-4 bg-card space-y-3 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold">
                        {dimension.label}
                      </label>
                      <select
                        value={dimensionData?.status || "flag"}
                        onChange={(e) =>
                          handleDimensionStatusChange(
                            dimension.key,
                            e.target.value as "pass" | "flag" | "fail"
                          )
                        }
                        className={`h-8 text-xs px-2 border-2 rounded font-medium ${
                          dimensionData?.status === "pass"
                            ? "border-green-300 bg-green-50 text-green-700"
                            : dimensionData?.status === "fail"
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-yellow-300 bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        <option value="pass">✓ Pass</option>
                        <option value="flag">⚠ Flag</option>
                        <option value="fail">✗ Fail</option>
                      </select>
                    </div>
                    <Textarea
                      placeholder={`Notes...`}
                      value={dimensionData?.notes || ""}
                      onChange={(e) =>
                        handleDimensionNotesChange(
                          dimension.key,
                          e.target.value
                        )
                      }
                      className="text-xs min-h-[80px] resize-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Rating */}
          <div className="border-t border-border pt-2 space-y-2 hidden">
            <div>
              <label className="text-xs font-semibold block mb-1">Overall Rating</label>
              <select
                value={score.overallRating}
                onChange={(e) =>
                  handleOverallRatingChange(
                    e.target.value as "strong" | "needs-work" | "major-rework"
                  )
                }
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              >
                <option value="strong">Strong</option>
                <option value="needs-work">Needs Work</option>
                <option value="major-rework">Major Rework</option>
              </select>
            </div>
          </div>

          {/* Top 3 Issues and What Worked Well */}
          <div className="border-t border-border pt-2 grid grid-cols-2 gap-2 hidden">
            {/* Top 3 Issues */}
            <div className="border-2 border-red-200 rounded-lg p-2 bg-red-50/30 space-y-2">
              <label className="text-xs font-semibold text-red-800 block">
                🚨 Top Issues
              </label>
              <div className="grid grid-cols-2 gap-1">
                {[0, 1, 2].map((index) => (
                  <input
                    key={`issue-${index}`}
                    type="text"
                    placeholder={`Issue ${index + 1}`}
                    value={score.topThreeIssues[index] || ""}
                    onChange={(e) =>
                      handleTopIssueChange(index, e.target.value)
                    }
                    className="px-3 py-2 text-xs border border-red-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                ))}
              </div>
            </div>

            {/* What Worked Well */}
            <div className="border-2 border-green-200 rounded-lg p-2 bg-green-50/30 space-y-2">
              <label className="text-xs font-semibold text-green-800 block">
                ✨ What Worked
              </label>
              <div className="grid grid-cols-2 gap-1">
                {[0, 1, 2].map((index) => (
                  <input
                    key={`worked-${index}`}
                    type="text"
                    placeholder={`Point ${index + 1}`}
                    value={score.whatWorkedWell[index] || ""}
                    onChange={(e) =>
                      handleWhatWorkedChange(index, e.target.value)
                    }
                    className="px-3 py-2 text-xs border border-green-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border pt-2 flex gap-2 hidden">
            <Button
              onClick={handleSaveAndCollapse}
              disabled={isSaving}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? "Saving..." : "✓ Save & Collapse"}
            </Button>
          </div>
      </div>
    </div>
  );
}
