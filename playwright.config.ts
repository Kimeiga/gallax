import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // E2E tests live in tests/e2e/
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',

  use: {
    // WebGL (Mapbox) requires headed mode — Chromium headless doesn't support it
    headless: false,
    // Slow down slightly so WebRTC has time to establish
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
