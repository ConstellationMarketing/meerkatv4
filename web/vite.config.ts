import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { createServer } from "./server";

// Read version from package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
    dedupe: ["react", "react-dom"],
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Mount Express app for /api and /.netlify/functions routes with priority
      server.middlewares.use((req, res, next) => {
        if (
          req.url?.startsWith("/api") ||
          req.url?.startsWith("/.netlify/functions")
        ) {
          // Call the Express app
          return app(req, res);
        }
        next();
      });
    },
  };
}
