import { existsSync } from 'node:fs';
import { browsersDirectory } from './mw-env-paths.mjs';

// Configure the shared browser cache before Playwright resolves its registry.
const cacheDir = browsersDirectory();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(cacheDir)) process.env.PLAYWRIGHT_BROWSERS_PATH = cacheDir;
const { chromium } = await import('playwright-core');
export async function openBrowser(options = {}) {
  const overrides = process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  return chromium.launch({ headless: true, ...overrides, ...options });
}
