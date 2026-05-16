import { WebhookError } from "@/lib/webhook";
import { AlertTriangle } from "lucide-react";

interface WebhookErrorDisplayProps {
  errors: WebhookError[];
}

export function WebhookErrorDisplay({ errors }: WebhookErrorDisplayProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-destructive">
            ⚠️ Webhook Validation Errors
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            The webhook request encountered validation errors. See details
            below.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {errors.map((error, index) => (
          <div
            key={index}
            className="rounded bg-background p-4 border border-destructive/30"
          >
            <div className="font-semibold text-destructive mb-2">
              {error.field}: {error.message}
            </div>

            {error.action && (
              <div className="mt-3 rounded bg-warning/10 p-3 border border-warning/30">
                <div className="text-sm font-medium text-warning mb-1">
                  💡 What to do:
                </div>
                <div className="text-sm text-foreground">{error.action}</div>
              </div>
            )}

            {error.severity && (
              <div className="mt-2">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    error.severity === "error"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-warning/20 text-warning"
                  }`}
                >
                  {error.severity.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded bg-blue-50 p-3 border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>Need help?</strong> These errors come from the n8n workflow.
          Check the browser console (F12) for more detailed technical
          information.
        </p>
      </div>
    </div>
  );
}
