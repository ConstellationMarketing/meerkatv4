export interface WebhookDebugInfo {
  timestamp: string;
  webhookUrl: string;
  payload: any;
  requestHeaders: Record<string, string>;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseText?: string;
  responseParsed?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  variables?: Record<string, any>;
}

class WebhookLogger {
  private debugHistory: WebhookDebugInfo[] = [];
  private maxHistorySize = 10;

  logWebhookAttempt(info: WebhookDebugInfo) {
    // Add to history
    this.debugHistory.push(info);
    if (this.debugHistory.length > this.maxHistorySize) {
      this.debugHistory.shift();
    }

    // Log to console with detailed formatting
    this.logToConsole(info);

    // Store in localStorage for persistence
    this.storeInLocalStorage(info);
  }

  private logToConsole(info: WebhookDebugInfo) {
    console.log("\n==========================================");
    console.log("🚀 WEBHOOK ATTEMPT:", info.timestamp);
    console.log("==========================================");

    if (info.webhookUrl) {
      console.log("📤 URL:", info.webhookUrl);
    }

    if (info.payload) {
      console.log("📦 Payload:", JSON.stringify(info.payload, null, 2));
    }

    if (Object.keys(info.requestHeaders || {}).length > 0) {
      console.log("📋 Request Headers:", info.requestHeaders);
    }

    console.log("------------------------------------------");

    if (info.responseStatus !== undefined) {
      console.log("📊 Status:", info.responseStatus);
    }

    if (info.responseHeaders && Object.keys(info.responseHeaders).length > 0) {
      console.log("📨 Response Headers:", info.responseHeaders);
    }

    if (info.responseText) {
      console.log("📄 Raw Response:", info.responseText);
    }

    if (info.responseParsed) {
      console.log(
        "✅ Parsed Response:",
        JSON.stringify(info.responseParsed, null, 2),
      );
    }

    if (info.error) {
      console.error("❌ ERROR:", {
        name: info.error.name,
        message: info.error.message,
        stack: info.error.stack,
      });
    }

    if (info.variables && Object.keys(info.variables).length > 0) {
      console.log("🔍 Variables at Error:", info.variables);
    }

    console.log("==========================================\n");
  }

  private storeInLocalStorage(info: WebhookDebugInfo) {
    try {
      const key = "webhook_debug_history";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(info);
      if (existing.length > this.maxHistorySize) {
        existing.shift();
      }
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.warn("Could not store debug info in localStorage:", error);
    }
  }

  getLastDebugInfo(): WebhookDebugInfo | null {
    return this.debugHistory[this.debugHistory.length - 1] || null;
  }

  getDebugHistory(): WebhookDebugInfo[] {
    return [...this.debugHistory];
  }

  clearHistory() {
    this.debugHistory = [];
    try {
      localStorage.removeItem("webhook_debug_history");
    } catch (error) {
      console.warn("Could not clear localStorage:", error);
    }
  }

  exportDebugInfo(info?: WebhookDebugInfo): string {
    const debugInfo = info || this.getLastDebugInfo();
    if (!debugInfo) {
      return "No debug information available.";
    }

    const lines: string[] = [];
    lines.push("==========================================");
    lines.push(`WEBHOOK DEBUG REPORT - ${debugInfo.timestamp}`);
    lines.push("==========================================");
    lines.push("");

    lines.push("📤 WEBHOOK URL:");
    lines.push(debugInfo.webhookUrl || "N/A");
    lines.push("");

    lines.push("📦 PAYLOAD:");
    lines.push(JSON.stringify(debugInfo.payload, null, 2));
    lines.push("");

    lines.push("📋 REQUEST HEADERS:");
    lines.push(JSON.stringify(debugInfo.requestHeaders, null, 2));
    lines.push("");

    if (debugInfo.responseStatus !== undefined) {
      lines.push("📊 RESPONSE STATUS:");
      lines.push(String(debugInfo.responseStatus));
      lines.push("");
    }

    if (debugInfo.responseHeaders) {
      lines.push("📨 RESPONSE HEADERS:");
      lines.push(JSON.stringify(debugInfo.responseHeaders, null, 2));
      lines.push("");
    }

    if (debugInfo.responseText) {
      lines.push("📄 RAW RESPONSE TEXT:");
      lines.push(debugInfo.responseText);
      lines.push("");
    }

    if (debugInfo.responseParsed) {
      lines.push("✅ PARSED RESPONSE:");
      lines.push(JSON.stringify(debugInfo.responseParsed, null, 2));
      lines.push("");
    }

    if (debugInfo.error) {
      lines.push("❌ ERROR DETAILS:");
      lines.push(`Name: ${debugInfo.error.name}`);
      lines.push(`Message: ${debugInfo.error.message}`);
      if (debugInfo.error.stack) {
        lines.push(`Stack Trace:`);
        lines.push(debugInfo.error.stack);
      }
      lines.push("");
    }

    if (debugInfo.variables && Object.keys(debugInfo.variables).length > 0) {
      lines.push("🔍 VARIABLES AT ERROR:");
      lines.push(JSON.stringify(debugInfo.variables, null, 2));
      lines.push("");
    }

    lines.push("==========================================");

    return lines.join("\n");
  }

  copyToClipboard(text: string): Promise<boolean> {
    return navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("✅ Debug info copied to clipboard");
        return true;
      })
      .catch((error) => {
        console.error("❌ Failed to copy to clipboard:", error);
        return false;
      });
  }
}

export const webhookLogger = new WebhookLogger();

// Expose to window for console debugging
if (typeof window !== "undefined") {
  (window as any).webhookLogger = webhookLogger;
  (window as any).getWebhookDebugInfo = () => webhookLogger.getLastDebugInfo();
  (window as any).getWebhookDebugHistory = () =>
    webhookLogger.getDebugHistory();
  (window as any).exportWebhookDebugInfo = (index?: number) => {
    const history = webhookLogger.getDebugHistory();
    const info =
      index !== undefined ? history[index] : webhookLogger.getLastDebugInfo();
    return webhookLogger.exportDebugInfo(info || undefined);
  };
  (window as any).copyWebhookDebugInfo = () => {
    const text = webhookLogger.exportDebugInfo();
    return webhookLogger.copyToClipboard(text);
  };

  console.log("💡 Webhook debugging tools available:");
  console.log("  - window.getWebhookDebugInfo() - Get last debug info");
  console.log("  - window.getWebhookDebugHistory() - Get all debug info");
  console.log(
    "  - window.exportWebhookDebugInfo() - Export debug info as text",
  );
  console.log(
    "  - window.copyWebhookDebugInfo() - Copy debug info to clipboard",
  );
}
