import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          react: ["react", "react-dom", "react-router-dom"],
          auth: ["@supabase/supabase-js"],
          domain: ["@js-temporal/polyfill", "zod"],
          ui: ["@mantine/core", "@mantine/hooks", "@mantine/notifications"],
        },
      },
    },
  },
});
