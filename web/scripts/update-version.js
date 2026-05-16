#!/usr/bin/env node

/**
 * Version Update Script
 * Automatically increments version on each build/push
 * Usage: node scripts/update-version.js
 *
 * Can be called from:
 * - GitHub Actions on push
 * - Local npm hooks
 * - CI/CD pipelines
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// Get current version
const currentVersion = pkg.version || "1.0.0";
const [major, minor, patch] = currentVersion.split(".").map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`✓ Version updated: ${currentVersion} → ${newVersion}`);
