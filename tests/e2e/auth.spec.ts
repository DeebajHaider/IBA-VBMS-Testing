import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Auth E2E', () => {

  test('E2E-AUTH-001: student logs in and sees the student dashboard', async ({ page }) => {
    await page.goto(BASE);

    // The login form should be the first thing visible
    await expect(page.getByLabel('ERP / Username')).toBeVisible();

    await page.getByLabel('ERP / Username').fill('12345');
    await page.getByLabel('Password').fill('student123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // After login, App.jsx renders the header with this h1 — always present for any role
    await expect(page.getByText('IBA Facility Booking')).toBeVisible();

    // The user's name and role appear in the header pill — confirms the right user logged in
    await expect(page.getByText('(student)')).toBeVisible();

    // Logout button is always present when authenticated
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('E2E-AUTH-002: PO logs in and sees booking management UI with filter controls', async ({ page }) => {
    await page.goto(BASE);

    await page.getByLabel('ERP / Username').fill('po001');
    await page.getByLabel('Password').fill('po123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // The PO dashboard always renders this h2 regardless of data
    await expect(page.getByText('Booking Requests Management')).toBeVisible();

    // The filter buttons (Pending/Approved/Rejected/All) are always rendered
    // — these confirm the PO-specific UI loaded, not the student or admin dashboard
    await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejected' })).toBeVisible();
  });

  test('E2E-AUTH-003: wrong credentials show error message on login page', async ({ page }) => {
    await page.goto(BASE);

    await page.getByLabel('ERP / Username').fill('12345');
    await page.getByLabel('Password').fill('definitelywrong');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // The error div appears when login fails — locating by CSS class since it has no role
    const errorDiv = page.locator('.alert-error');
    await expect(errorDiv).toBeVisible();

    // The message comes from the backend's UnauthorizedException
    await expect(errorDiv).toContainText('Invalid credentials');

    // We must still be on the login page — the login form inputs should still be present
    await expect(page.getByLabel('ERP / Username')).toBeVisible();
  });

  test('E2E-AUTH-004: unauthenticated user sees login form (fresh context has no localStorage)', async ({ page }) => {
    // Playwright gives each test a fresh browser context with empty localStorage by default.
    // App.jsx calls getStoredUser() on mount — returns null — so LoginPage renders.
    await page.goto(BASE);

    await expect(page.getByLabel('ERP / Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // The authenticated header must NOT be present
    await expect(page.getByText('IBA Facility Booking')).not.toBeVisible();
  });

  test('E2E-AUTH-007: after logout, localStorage is cleared and login form reappears', async ({ page }) => {
    await page.goto(BASE);

    await page.getByLabel('ERP / Username').fill('12345');
    await page.getByLabel('Password').fill('student123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('IBA Facility Booking')).toBeVisible();

    // Confirm token is in localStorage before logout
    const tokenBefore = await page.evaluate(() => localStorage.getItem('iba_token'));
    expect(tokenBefore).not.toBeNull();

    await page.getByRole('button', { name: 'Logout' }).click();

    // Login form must reappear
    await expect(page.getByLabel('ERP / Username')).toBeVisible();

    // The real security assertion: localStorage must be empty after logout.
    // Even if the user navigated back somehow, getStoredUser() returns null
    // and App renders LoginPage because there's nothing in localStorage.
    const tokenAfter = await page.evaluate(() => localStorage.getItem('iba_token'));
    const userAfter  = await page.evaluate(() => localStorage.getItem('iba_user'));
    expect(tokenAfter).toBeNull();
    expect(userAfter).toBeNull();
  });

});

