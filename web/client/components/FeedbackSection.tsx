import { useState } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackSectionProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string, difficulty: string) => void;
}

export function FeedbackSection({
  isOpen,
  onClose,
  onSubmit,
}: FeedbackSectionProps) {
  const [feedback, setFeedback] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      onSubmit(feedback, difficulty);
      setFeedback("");
      setDifficulty("medium");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600 text-white px-8 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Your Feedback Matters</h2>
              <p className="text-blue-100 text-sm mt-1">Help us improve</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200 hover:scale-110"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="mb-6">
            <p className="text-gray-700 font-medium mb-4 leading-relaxed">
              As you edit the article, what feedback do you have that would help us improve the Meerkat article generator and reduce your editing time?
            </p>
          </div>

          {/* Editing Difficulty Dropdown */}
          <div className="mb-6">
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
              Editing Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-700 bg-white"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Textarea */}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your feedback here... (e.g., What was unclear? What took the most time? What could be improved?)"
            className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-gray-700 placeholder-gray-400"
          />

          {/* Character count */}
          <div className="text-xs text-gray-500 mt-2 text-right">
            {feedback.length} characters
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-6 bg-white border-t border-gray-200">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !feedback.trim()}
            className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-11 text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
