import { supabase } from "@/lib/supabase";

export interface ClientFolder {
  id: string;
  name: string;
  client_id: string;
  client_info?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

function deduplicateFoldersByName(folders: ClientFolder[]): ClientFolder[] {
  const namesSeen = new Set<string>();
  const deduplicated: ClientFolder[] = [];

  for (const folder of folders) {
    if (namesSeen.has(folder.name)) {
      continue;
    }
    namesSeen.add(folder.name);
    deduplicated.push(folder);
  }

  return deduplicated;
}

export async function getClientFolders(): Promise<ClientFolder[]> {
  console.log("Fetching client folders from Supabase...");
  const { data, error } = await supabase
    .from("client_folders")
    .select("id,name,client_id,client_info,website,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error details:", error.details);
    throw new Error(
      `Failed to fetch folders: ${error.message || JSON.stringify(error)}`,
    );
  }

  console.log("Fetched folders from Supabase:", data);

  const folders = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    client_id: row.client_id,
    client_info: row.client_info || "",
    website: row.website || "",
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  }));

  console.log("Parsed folders:", folders);
  return deduplicateFoldersByName(folders);
}

export async function saveClientFolder(folder: ClientFolder): Promise<void> {
  // Only send the required columns - let the database handle timestamps
  const folderData = {
    id: folder.id,
    name: folder.name,
    client_id: folder.client_id,
    ...(folder.client_info ? { client_info: folder.client_info } : {}),
    ...(folder.website ? { website: folder.website } : {}),
  };

  console.log("Upserting folder to Supabase:", folderData);

  const { error: upsertError, data: upsertData } = await supabase
    .from("client_folders")
    .upsert([folderData], {
      onConflict: "id",
    });

  if (upsertError) {
    console.error("Upsert error object:", JSON.stringify(upsertError, null, 2));
    console.error("Error keys:", Object.keys(upsertError || {}));

    let errorMsg = "Unknown error";
    try {
      // Safely extract error message
      const msg = (upsertError as any)?.message;
      const details = (upsertError as any)?.details;
      const hint = (upsertError as any)?.hint;
      const code = (upsertError as any)?.code;

      console.error("Extracted error details:", {
        msg: typeof msg === "string" ? msg : JSON.stringify(msg),
        details:
          typeof details === "string" ? details : JSON.stringify(details),
        hint: typeof hint === "string" ? hint : JSON.stringify(hint),
        code: typeof code === "string" ? code : JSON.stringify(code),
      });

      if (msg && typeof msg === "string") {
        errorMsg = msg;
      } else if (details && typeof details === "string") {
        errorMsg = details;
      } else if (hint && typeof hint === "string") {
        errorMsg = hint;
      } else if (code && typeof code === "string") {
        errorMsg = `Error code: ${code}`;
      } else {
        errorMsg = JSON.stringify(upsertError);
      }
    } catch (e) {
      console.error("Failed to extract error message:", e);
      errorMsg = String(upsertError);
    }

    throw new Error(errorMsg);
  }

  console.log("Folder upserted successfully");
}

export async function deleteClientFolder(id: string): Promise<void> {
  const { error } = await supabase.from("client_folders").delete().eq("id", id);

  if (error) {
    console.error("Delete error:", String(error));
    throw new Error(`Failed to delete folder: ${String(error)}`);
  }
}

export function generateId(): string {
  // Use crypto.randomUUID if available (modern browsers & Node.js)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: Create a unique ID using timestamp + higher entropy random
  const timestamp = Date.now().toString(36);
  const randomPart =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);
  return `${timestamp}-${randomPart}`;
}

// localStorage fallback functions
const STORAGE_KEY = "client_folders";

function getClientFoldersLocal(): ClientFolder[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return [];
  }
}

function saveClientFolderLocal(folder: ClientFolder): void {
  try {
    const folders = getClientFoldersLocal();
    const existingIndex = folders.findIndex((f) => f.id === folder.id);

    if (existingIndex >= 0) {
      folders[existingIndex] = folder;
    } else {
      folders.push(folder);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function deleteClientFolderLocal(id: string): void {
  try {
    const folders = getClientFoldersLocal();
    const filtered = folders.filter((f) => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error deleting from localStorage:", error);
  }
}

export const CLIENT_FOLDERS_UPDATED_EVENT = "client-folders-updated";

export function triggerClientFoldersUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLIENT_FOLDERS_UPDATED_EVENT));
}
