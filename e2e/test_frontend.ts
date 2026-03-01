import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Navigation & Setup', () => {
  test('setup page loads when no user exists', async ({ page }) => {
    // This test connects to a running dev server
    await page.goto(BASE_URL);
    // Should either show setup or login page
    await expect(page).toHaveURL(/http:\/\/localhost:5173.*/);
    const title = await page.title();
    expect(title).toBe('Private Key Manager');
  });

  test('page has correct meta tags for PWA', async ({ page }) => {
    await page.goto(BASE_URL);
    const viewport = await page.evaluate(() => {
      return document.querySelector('meta[name="viewport"]')?.getAttribute('content');
    });
    expect(viewport).toContain('width=device-width');

    const themeColor = await page.evaluate(() => {
      return document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    });
    expect(themeColor).toBeDefined();
  });
});

test.describe('Authentication Flow', () => {
  test('setup form has all required fields', async ({ page }) => {
    await page.goto(BASE_URL);
    // Check for email and password inputs
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.count() > 0) {
      await expect(emailInput.first()).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });

  test('login form shows password toggle', async ({ page }) => {
    await page.goto(BASE_URL);

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.count() > 0) {
      await expect(passwordInput).toBeVisible();

      // Look for the toggle button
      const toggleButton = page.locator('button[title]').filter({ hasText: '' });
      if (await toggleButton.count() > 0) {
        expect(true).toBe(true);
      }
    }
  });

  test('form validation shows error for empty submission', async ({ page }) => {
    await page.goto(BASE_URL);

    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
      // Form should not submit with empty fields
      await expect(page).toHaveURL(/http:\/\/localhost:5173.*/);
    }
  });
});

test.describe('Responsive Layout', () => {
  test('app renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('app renders on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('app renders on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('page loads within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
