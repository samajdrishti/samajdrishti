import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('text=Samaj Drishti')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('.MuiAlert-message')).toContainText('Email is required');
  });

  test('should navigate to dashboard after successful login', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@dosje.gov.in');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Command Center')).toBeVisible();
  });
});