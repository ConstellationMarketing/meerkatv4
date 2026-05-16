import { useState, useEffect } from "react";
import { Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { webhookLogger } from "@/lib/webhook-logger";

interface WebhookDebugPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

export function WebhookDebugPanel({
  isVisible,
  onClose,
}: WebhookDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const lastDebug = webhookLogger.getLastDebugInfo();
      setDebugInfo(lastDebug);
    }
  }, [isVisible]);

  if (!isVisible || !debugInfo) {
    return null;
  }

  const handleCopy = async () => {
    const exportedText = webhookLogger.exportDebugInfo(debugInfo);
    const success = await webhookLogger.copyToClipboard(exportedText);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasError = !!debugInfo.error;
  const responseStatus = debugInfo.responseStatus;
  const isNetworkError = !responseStatus && hasError;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 bg-card border-b border-border cursor-pointer hover:bg-card/80 transition"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 flex-1">
            <div
              className={`h-3 w-3 rounded-full ${
                hasError
                  ? "bg-destructive"
                  : responseStatus && responseStatus < 400
                    ? "bg-green-500"
                    : "bg-yellow-500"
              }`}
            ></div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {isNetworkError
                  ? "🔴 Network Error"
                  : responseStatus && responseStatus >= 400
                    ? `🟡 HTTP ${responseStatus}`
                    : "🟢 Webhook Attempt Logged"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {debugInfo.timestamp}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Debug Info"}
            </Button>

            <button className="p-1 hover:bg-muted rounded transition">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>

            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 bg-background border-t border-border overflow-auto max-h-96">
            <div className="space-y-6 text-sm font-mono text-foreground">
              {/* Webhook URL */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">
                  📤 WEBHOOK URL
                </p>
                <p className="bg-card p-2 rounded border border-border break-all">
                  {debugInfo.webhookUrl || "N/A"}
                </p>
              </div>

              {/* Payload */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">
                  📦 PAYLOAD
                </p>
                <pre className="bg-card p-3 rounded border border-border overflow-auto max-h-40">
                  {JSON.stringify(debugInfo.payload, null, 2)}
                </pre>
              </div>

              {/* Response Status */}
              {debugInfo.responseStatus !== undefined && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">
                    📊 RESPONSE STATUS
                  </p>
                  <p className="bg-card p-2 rounded border border-border">
                    {debugInfo.responseStatus}
                  </p>
                </div>
              )}

              {/* Raw Response */}
              {debugInfo.responseText && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">
                    📄 RAW RESPONSE
                  </p>
                  <pre className="bg-card p-3 rounded border border-border overflow-auto max-h-40">
                    {debugInfo.responseText}
                  </pre>
                </div>
              )}

              {/* Parsed Response */}
              {debugInfo.responseParsed && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">
                    ✅ PARSED RESPONSE
                  </p>
                  <pre className="bg-card p-3 rounded border border-border overflow-auto max-h-40">
                    {JSON.stringify(debugInfo.responseParsed, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Info */}
              {debugInfo.error && (
                <div className="border-l-4 border-destructive bg-destructive/5 p-4">
                  <p className="text-xs font-bold text-destructive mb-2">
                    ❌ ERROR DETAILS
                  </p>
                  <p>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    {debugInfo.error.name}
                  </p>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Message:</span>{" "}
                    {debugInfo.error.message}
                  </p>
                  {debugInfo.error.stack && (
                    <>
                      <p className="mt-2 text-muted-foreground text-xs">
                        Stack Trace:
                      </p>
                      <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto max-h-32">
                        {debugInfo.error.stack}
                      </pre>
                    </>
                  )}
                </div>
              )}

              {/* Variables at Error */}
              {debugInfo.variables &&
                Object.keys(debugInfo.variables).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">
                      🔍 VARIABLES AT ERROR
                    </p>
                    <pre className="bg-card p-3 rounded border border-border overflow-auto max-h-40">
                      {JSON.stringify(debugInfo.variables, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
