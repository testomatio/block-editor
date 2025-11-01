import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "demo-dist",
  },
  test: {
    environment: "node",
    setupFiles: [],
  },
});
