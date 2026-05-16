export type WebhookMode = "production" | "testing";

export interface WebhookSettings {
  mode: WebhookMode;
  testingUrl: string;
}

const STORAGE_KEY = "webhook_settings_v1";

export function getWebhookSettings(): WebhookSettings {
  if (typeof window === "undefined") {
    return {
      mode: "production",
      testingUrl: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        mode: "production",
        testingUrl: "",
      };
    }

    const parsed = JSON.parse(raw);
    const mode: WebhookMode =
      parsed && parsed.mode === "testing" ? "testing" : "production";
    const testingUrl =
      parsed && typeof parsed.testingUrl === "string" ? parsed.testingUrl : "";

    return {
      mode,
      testingUrl,
    };
  } catch (error) {
    console.error("Error reading webhook settings from localStorage:", error);
    return {
      mode: "production",
      testingUrl: "",
    };
  }
}

export function saveWebhookSettings(settings: WebhookSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving webhook settings to localStorage:", error);
  }
}
