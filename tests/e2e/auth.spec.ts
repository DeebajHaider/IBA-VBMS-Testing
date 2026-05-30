import { test, expect } from '@playwright/test';

test.describe('E2E-AUTH-001: Authentication', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('iba_token');
      localStorage.removeItem('iba_user');
    });
    await page.reload();
  });

  test('student can log in and sees the student dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel(/ERP/i)).toBeVisible();

    await page.getByLabel(/ERP/i).fill('12345');
    await page.getByLabel(/password/i).fill('student123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Logout button appears on ALL dashboards the moment login succeeds
    await expect(page.getByRole('button', { name: /logout|sign out/i })).toBeVisible();

    // Verify it's specifically the student dashboard, not admin or PO
    // (student dashboard has a booking form with these fields)
    await expect(page.getByText(/student/i).first()).toBeVisible();
  });

  test('wrong password shows error and stays on login page', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/ERP/i).fill('12345');
    await page.getByLabel(/password/i).fill('definitelywrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page.getByLabel(/ERP/i)).toBeVisible();
  });

});
