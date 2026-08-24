import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: { command: 'python3 -m http.server 8000 --directory .', url: 'http://127.0.0.1:8000/', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:8000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
