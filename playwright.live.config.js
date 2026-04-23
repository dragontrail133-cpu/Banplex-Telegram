import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const defaultBaseURL = 'http://127.0.0.1:3000'
const configuredBaseURL = String(process.env.E2E_BASE_URL ?? '').trim()
const baseURL = configuredBaseURL || defaultBaseURL
const isCI = Boolean(globalThis.process?.env?.CI)
const shouldStartLocalServer = !configuredBaseURL || baseURL === defaultBaseURL

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: shouldStartLocalServer
    ? {
        command: 'node node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 3000',
        url: defaultBaseURL,
        reuseExistingServer: !isCI,
        timeout: 120000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
