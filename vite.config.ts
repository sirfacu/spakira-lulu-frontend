import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: "static",
  server: {
    host: "0.0.0.0",
    port: 9000,
    strictPort: true,
    allowedHosts: ["spakira.e-mac.co", ".e-mac.co", ".trycloudflare.com"],
  },
  preview: {
    host: "0.0.0.0",
    port: 9000,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    nitro(),
  ],
});
