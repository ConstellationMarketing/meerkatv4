import { X, Play, Pause, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimeRecorderPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  elapsedSeconds: number;
  isRunning: boolean;
  onPlayClick: () => void;
  onPauseClick: () => void;
  feedback?: string;
  showSummary?: boolean;
  articleId?: string;
  difficulty?: string;
}

export function TimeRecorderPopup({
  isOpen,
  onClose,
  onDone,
  elapsedSeconds,
  isRunning,
  onPlayClick,
  onPauseClick,
  feedback = "",
  showSummary = false,
  articleId = "",
  difficulty = "medium",
}: TimeRecorderPopupProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`text-white px-8 py-6 relative overflow-hidden ${
          showSummary
            ? "bg-gradient-to-br from-green-600 via-green-500 to-green-600"
            : "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800"
        }`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {showSummary ? "Editing Summary" : "Editing Timer"}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {showSummary ? "Review your session" : "Track your editing time"}
              </p>
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

        {showSummary ? (
          <>
            {/* Summary View */}
            <div className="px-8 py-8 bg-gradient-to-b from-gray-50 to-white space-y-6">
              {/* Time Display */}
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium">
                  This is the time spent editing the article
                </p>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl px-8 py-6 border border-green-200">
                  <div className="text-5xl font-bold font-mono text-green-700 text-center">
                    {formatTime(elapsedSeconds)}
                  </div>
                </div>
              </div>

              {/* Feedback Display */}
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium">
                  These are your feedbacks
                </p>
                <div className="bg-gray-100 rounded-2xl px-4 py-4 border border-gray-300 min-h-24">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {feedback || "No feedback provided"}
                  </p>
                </div>
              </div>

              {/* Difficulty Level Display */}
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium">
                  Editing Difficulty
                </p>
                <div className={`rounded-2xl px-4 py-3 border text-center font-semibold capitalize ${
                  difficulty === 'easy'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : difficulty === 'hard'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                }`}>
                  {difficulty || "Not specified"}
                </div>
              </div>

              {/* Note */}
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-xs text-amber-900">
                  <strong>Note:</strong> This timer session has been recorded. You can view the summary above, but you cannot record time again for this article.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <div className="px-8 pb-8 pt-4">
              <Button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-12 text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
              >
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Timer View */}
            <div className="px-8 py-16 flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white">
              <div className="mb-2 text-slate-500 text-sm font-medium uppercase tracking-widest">
                Elapsed Time
              </div>
              <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl px-10 py-8 shadow-sm border border-slate-200">
                <div className="text-6xl font-bold font-mono text-slate-800 tracking-tighter text-center">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="px-8 py-6 bg-blue-50 border-t border-blue-100">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong>Note:</strong> This timer tracks your article editing time. Click <strong>Play</strong> to start, <strong>Pause</strong> to pause. When finished, click <strong>Done</strong> to provide feedback.
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="px-8 py-6 flex gap-3 justify-center bg-white border-t border-slate-200">
              <Button
                onClick={onPlayClick}
                disabled={isRunning}
                className={`rounded-full h-16 w-16 flex items-center justify-center p-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isRunning
                    ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white opacity-60 cursor-not-allowed"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                }`}
                title="Play"
              >
                <Play className="w-7 h-7 ml-0.5" />
              </Button>
              <Button
                onClick={onPauseClick}
                disabled={!isRunning}
                className={`rounded-full h-16 w-16 flex items-center justify-center p-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                  !isRunning
                    ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white opacity-60 cursor-not-allowed"
                    : "bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                }`}
                title="Pause"
              >
                <Pause className="w-7 h-7" />
              </Button>
            </div>

            {/* Done Button */}
            <div className="px-8 pb-8 pt-4">
              <Button
                onClick={onDone}
                className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white h-12 text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
