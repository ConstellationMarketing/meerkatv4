import { ArticleOutline } from "@/types/article";
import { ArticleOutline } from "@/types/article";
import { getArticleOutlineById } from "@/lib/storage";
import { webhookLogger, type WebhookDebugInfo } from "@/lib/webhook-logger";
import { getClientFolders } from "@/lib/client-folders";
import { getWebhookSettings } from "@/lib/webhook-config";

export interface WebhookError {
  field: string;
  message: string;
  action?: string;
  severity: "error" | "warning";
}

export interface WebhookResponse {
  status: "success" | "validation_failed" | "error";
  errors?: WebhookError[];
  message?: string;
}

async function getCorrectClientId(
  outline: ArticleOutline,
): Promise<string | undefined> {
  // Try to lookup the correct clientId from client folders by name
  try {
    const folders = await getClientFolders();
    const folder = folders.find((f) => f.name === outline.clientName);
    if (folder) {
      return folder.client_id;
    }
  } catch (error) {
    console.warn("Failed to lookup client folder:", error);
  }
  // Fallback to the clientId stored in the outline
  return outline.clientId;
}

async function getClientInfo(
  outline: ArticleOutline,
): Promise<string | undefined> {
  // Try to lookup the client info from client folders by name
  try {
    const folders = await getClientFolders();
    const folder = folders.find((f) => f.name === outline.clientName);
    if (folder && folder.client_info) {
      return folder.client_info;
    }
  } catch (error) {
    console.warn("Failed to lookup client folder for client info:", error);
  }
  // Return undefined if not found
  return undefined;
}

async function getClientWebsite(
  outline: ArticleOutline,
): Promise<string | undefined> {
  // Try to lookup the website from client folders by name
  try {
    const folders = await getClientFolders();
    const folder = folders.find((f) => f.name === outline.clientName);
    if (folder && folder.website) {
      return folder.website;
    }
  } catch (error) {
    console.warn("Failed to lookup client folder for website:", error);
  }
  // Return undefined if not found
  return undefined;
}

function transformOutlineForWebhook(
  outline: ArticleOutline,
  clientId: string | undefined,
  clientInfo?: string,
  website?: string,
) {
  return {
    articleid: outline.articleId,
    clientId: clientId,
    clientName: outline.clientName,
    clientInfo: clientInfo || "",
    website: website || "",
    keyword: outline.keyword,
    template: outline.template || null,
    userId: outline.userId || null,
    sections: outline.sections.map((section, index) => ({
      sectionNumber: index + 1,
      name: section.title,
      details: section.description,
      wordCount: section.targetWordCount ?? null,
    })),
  };
}

async function sendWebhookPayload(
  payload: any,
  debugVariables?: Record<string, any>,
): Promise<WebhookResponse> {
  const settings = getWebhookSettings();
  let webhookUrl =
    "https://n8n-14lp.onrender.com/webhook/94a33159-2ed6-412b-83ea-fac644344216";
  if (settings.mode === "testing" && settings.testingUrl.trim()) {
    webhookUrl = settings.testingUrl.trim();
  }

  const requestHeaders = {
    "Content-Type": "application/json",
  };

  const debugInfo: WebhookDebugInfo = {
    timestamp: new Date().toISOString(),
    webhookUrl: webhookUrl,
    payload: payload,
    requestHeaders: requestHeaders,
  };

  try {
    webhookLogger.logWebhookAttempt(debugInfo);

    // Send directly to n8n (bypass Express server which fails in Netlify Functions)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    // Update debug info with response
    debugInfo.responseStatus = response.status;
    debugInfo.responseHeaders = Object.fromEntries(response.headers.entries());

    const responseText = await response.text();
    debugInfo.responseText = responseText;

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
      debugInfo.responseParsed = responseData;
    } catch (parseError) {
      const error =
        parseError instanceof Error ? parseError : new Error("Unknown error");
      debugInfo.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      webhookLogger.logWebhookAttempt(debugInfo);

      throw new Error(
        `Invalid response from webhook: ${responseText.substring(0, 200)}`,
      );
    }

    // Check for validation errors
    if (responseData.status === "validation_failed" || response.status >= 400) {
      webhookLogger.logWebhookAttempt(debugInfo);

      return {
        status: "validation_failed",
        errors: responseData.errors || [
          {
            field: "webhook",
            message: responseData.error || "Webhook validation failed",
            severity: "error",
          },
        ],
        message: responseData.message,
      };
    }

    // Check for general errors
    if (responseData.error) {
      debugInfo.error = {
        name: "WebhookError",
        message: responseData.error,
      };
      webhookLogger.logWebhookAttempt(debugInfo);

      throw new Error(responseData.error);
    }

    webhookLogger.logWebhookAttempt(debugInfo);
    return {
      status: "success",
      message: "Webhook sent successfully",
    };
  } catch (error) {
    const errorObj =
      error instanceof Error ? error : new Error("Unknown error");
    debugInfo.error = {
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
    };
    if (debugVariables) {
      debugInfo.variables = debugVariables;
    }

    webhookLogger.logWebhookAttempt(debugInfo);

    const errorMessage = errorObj.message;
    return {
      status: "error",
      errors: [
        {
          field: "network",
          message: errorMessage,
          action:
            "Check that your internet connection is working and n8n is available",
          severity: "error",
        },
      ],
    };
  }
}

export async function sendTestWebhook(): Promise<WebhookResponse> {
  // Try to load the specified article outline from Supabase
  const existingOutline = await getArticleOutlineById("mi6fezp1l2da83q0zms");

  const baseOutline: ArticleOutline =
    existingOutline ||
    ({
      id: `test-${Date.now()}`,
      articleId: `test-article-${Date.now()}`,
      clientName: "Carver & Associates",
      clientId: "86dvn8g99",
      keyword: "DWI lawyer in Springfield MO",
      template: "Legal Services - DWI Defense",
      sections: [
        {
          id: "1",
          title: "Definition + Introduction",
          description:
            "Explain what a DWI is and why having an experienced Springfield MO DWI lawyer matters",
          targetWordCount: 250,
        },
        {
          id: "2",
          title: "Consequences of a DWI in Missouri",
          description:
            "Outline the legal penalties, license issues, and long-term impact of a DWI conviction in Missouri",
          targetWordCount: 600,
        },
        {
          id: "3",
          title: "How Carver & Associates Defend DWI Charges",
          description:
            "Describe the firm’s approach to investigating the stop, challenging evidence, and building a defense",
          targetWordCount: 700,
        },
        {
          id: "4",
          title: "What To Do After a DWI Arrest in Springfield, MO",
          description:
            "Give clear, step-by-step guidance on what someone should do immediately after being arrested for DWI",
          targetWordCount: 400,
        },
        {
          id: "5",
          title: "Schedule a Free Consultation",
          description:
            "Invite the reader to contact Carver & Associates for a free consultation and explain how to get started",
          targetWordCount: 200,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      webhookSent: false,
    } as ArticleOutline);

  const outline: ArticleOutline = {
    ...baseOutline,
    // Always use a fresh articleId so each test webhook is treated as a new article
    articleId: `test-article-${Date.now()}`,
    // Always send test webhooks as Carver & Associates
    clientId: "86dvn8g99",
    sections: (baseOutline.sections || []).map((section, index) => ({
      ...section,
      // Set a consistent word count of 200 for each section in the webhook payload
      targetWordCount: 200,
      id: section.id || String(index + 1),
    })),
  };

  const clientInfo = await getClientInfo(outline);
  const website = await getClientWebsite(outline);
  const payload = transformOutlineForWebhook(
    outline,
    outline.clientId,
    clientInfo,
    website,
  );

  return sendWebhookPayload(payload, {
    testRun: true,
    clientId: outline.clientId,
    keyword: outline.keyword,
    articleId: outline.articleId,
  });
}

export async function sendOutlineToWebhook(
  outline: ArticleOutline,
): Promise<WebhookResponse> {
  const correctClientId = await getCorrectClientId(outline);
  const clientInfo = await getClientInfo(outline);
  const website = await getClientWebsite(outline);
  const payload = transformOutlineForWebhook(
    outline,
    correctClientId,
    clientInfo,
    website,
  );

  console.log(
    "Sending webhook with userId:",
    outline.userId,
    "Payload:",
    payload,
  );

  return sendWebhookPayload(payload, {
    outlineId: outline.id,
    clientId: outline.clientId,
    clientName: outline.clientName,
    keyword: outline.keyword,
    userId: outline.userId,
    sectionsCount: outline.sections.length,
  });
}

export async function sendConstellationWebhook(
  outline: ArticleOutline,
): Promise<WebhookResponse> {
  const correctClientId = await getCorrectClientId(outline);
  const clientInfo = await getClientInfo(outline);
  const website = await getClientWebsite(outline);
  const payload = transformOutlineForWebhook(
    outline,
    correctClientId,
    clientInfo,
    website,
  );

  const requestHeaders = {
    "Content-Type": "application/json",
  };

  const constellationWebhookUrl =
    "https://n8n-14lp.onrender.com/webhook/constellation";

  const debugInfo: WebhookDebugInfo = {
    timestamp: new Date().toISOString(),
    webhookUrl: constellationWebhookUrl,
    payload: payload,
    requestHeaders: requestHeaders,
  };

  try {
    webhookLogger.logWebhookAttempt(debugInfo);

    const response = await fetch(constellationWebhookUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    debugInfo.responseStatus = response.status;
    debugInfo.responseHeaders = Object.fromEntries(response.headers.entries());

    const responseText = await response.text();
    debugInfo.responseText = responseText;

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
      debugInfo.responseParsed = responseData;
    } catch (parseError) {
      const error =
        parseError instanceof Error ? parseError : new Error("Unknown error");
      debugInfo.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      webhookLogger.logWebhookAttempt(debugInfo);

      throw new Error(
        `Invalid response from Constellation webhook: ${responseText.substring(0, 200)}`,
      );
    }

    // Check for validation errors
    if (responseData.status === "validation_failed" || response.status >= 400) {
      webhookLogger.logWebhookAttempt(debugInfo);

      return {
        status: "validation_failed",
        errors: responseData.errors || [
          {
            field: "webhook",
            message:
              responseData.error || "Constellation webhook validation failed",
            severity: "error",
          },
        ],
        message: responseData.message,
      };
    }

    // Check for general errors
    if (responseData.error) {
      debugInfo.error = {
        name: "ConstellationWebhookError",
        message: responseData.error,
      };
      webhookLogger.logWebhookAttempt(debugInfo);

      throw new Error(responseData.error);
    }

    webhookLogger.logWebhookAttempt(debugInfo);
    return {
      status: "success",
      message: "Constellation webhook sent successfully",
    };
  } catch (error) {
    const errorObj =
      error instanceof Error ? error : new Error("Unknown error");
    debugInfo.error = {
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
    };

    webhookLogger.logWebhookAttempt(debugInfo);

    const errorMessage = errorObj.message;
    return {
      status: "error",
      errors: [
        {
          field: "network",
          message: errorMessage,
          action:
            "Check that your internet connection is working and the Constellation webhook is available",
          severity: "error",
        },
      ],
    };
  }
}
