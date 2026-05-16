// Version management
// This will be updated on each deployment via the build process

// Get version from environment variable (set during build) or default
export function getAppVersion(): string {
  // Try to get from import.meta.env first (Vite env variable)
  const envVersion = (import.meta as any).env.VITE_APP_VERSION;
  if (envVersion) {
    return envVersion;
  }

  // Fallback to localStorage cache
  const cached = localStorage.getItem("app_version");
  if (cached) {
    return cached;
  }

  // Fallback to default
  return "3.0.0";
}

// Store version in localStorage when app loads
export function initializeVersion(): void {
  const version = getAppVersion();
  localStorage.setItem("app_version", version);
}

// Update version (called when new version detected)
export function updateVersion(newVersion: string): void {
  localStorage.setItem("app_version", newVersion);
  // Optional: Reload page to apply updates
  // window.location.reload();
}
