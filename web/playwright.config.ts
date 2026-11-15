import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: process.env.TEST_PRODUCTION
          ? "npm exec vite preview -- --host 0.0.0.0 --port 5173"
          : "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
