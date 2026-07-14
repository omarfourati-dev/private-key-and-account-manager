import { test, expect } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const FIXTURE = path.join(__dirname, 'fixtures', 'chrome-sample.csv');

// The import wizard lives behind authentication. Like the rest of this suite,
// the tests are defensive: against an unauthenticated dev server they only
// verify the app shell; with an authenticated session they exercise the wizard.
test.describe('CSV Import Wizard', () => {
  test('settings page renders (login or data management)', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('wizard opens, shows warnings and previews a CSV', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);

    const openButton = page.getByRole('button', { name: /Import from Apple \/ Google/i });
    if (await openButton.count() === 0) {
      test.skip(true, 'Not authenticated — wizard button not reachable');
      return;
    }

    await openButton.click();
    await expect(page.getByText('Import from Apple / Google').first()).toBeVisible();

    // Plaintext warning must be prominent before any file is chosen
    await expect(page.getByText(/Delete the file after importing/i)).toBeVisible();

    // Export instructions are collapsible
    await page.getByText(/How do I export my passwords/i).click();
    await expect(page.getByText(/passwords\.google\.com/i)).toBeVisible();

    // Upload the fixture and expect the preview counters
    const fileInput = page.locator('input[type="file"][accept*="csv"]');
    await fileInput.setInputFiles(FIXTURE);
    await expect(page.getByText('new', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('unchanged', { exact: true })).toBeVisible();

    // Cancel without importing — vault must stay untouched
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText(/Delete the file after importing/i)).toHaveCount(0);
  });

  test('wizard rejects a JSON file with a clear message', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);

    const openButton = page.getByRole('button', { name: /Import from Apple \/ Google/i });
    if (await openButton.count() === 0) {
      test.skip(true, 'Not authenticated — wizard button not reachable');
      return;
    }

    await openButton.click();
    const fileInput = page.locator('input[type="file"][accept*="csv"]');
    await fileInput.setInputFiles({
      name: 'export.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":"1.0.0","entries":[]}'),
    });
    await expect(page.getByText(/JSON backup/i)).toBeVisible();
  });
});
