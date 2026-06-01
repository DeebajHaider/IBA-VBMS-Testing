import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ── helpers ───────────────────────────────────────────────────────────────────

async function loginViaUI(page: Page, erp: string, password: string) {
  await page.goto(BASE);
  await page.getByLabel('ERP / Username').fill(erp);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

// Fills and submits the student booking form through the real UI.
// Pattern 7: waitForResponse is set up BEFORE the building selection that triggers it.
// Returns after asserting the success message — the booking exists in DB at this point.
async function fillAndSubmitBooking(
  page    : Page,
  date    : string,
  slotId  : string,   // slot_id as string value, e.g. '5', '6'
  purpose : string,
) {
  // Rooms API fires when building is selected — register listener first
  const roomsLoaded = page.waitForResponse(
    (r: any) => r.url().includes('/api/rooms') && r.url().includes('building_id')
  );
  await page.locator('select').nth(0).selectOption({ label: 'Test Block' });
  await roomsLoaded;

  await page.locator('select').nth(1).selectOption({ label: 'Room 101 (Cap: 30)' });
  await page.locator('input[type="date"]').fill(date);
  await page.locator('select').nth(2).selectOption({ value: slotId });
  await page.getByPlaceholder('Describe the activity...').fill(purpose);

  // Wait for the bookings POST before asserting the success alert —
  // the alert appears after the API responds, not before
  const bookingSubmitted = page.waitForResponse(
    (r: any) => r.url().includes('/api/bookings') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Submit Booking Request' }).click();
  await bookingSubmitted;

  // Alert auto-dismisses after 3 seconds — assert immediately
  await expect(page.locator('.alert-success')).toContainText('submitted successfully');
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('PO Management E2E', () => {

  // ── E2E-PO-001 ─────────────────────────────────────────────────────────────
  test('E2E-PO-001: student books via UI → PO approves → student sees approved status', async ({ browser }) => {
    // Two isolated contexts — each has its own localStorage so both sessions
    // can coexist. The only shared state between them is the database.
    const studentCtx: BrowserContext = await browser.newContext();
    const poCtx:      BrowserContext = await browser.newContext();
    const studentPage: Page = await studentCtx.newPage();
    const poPage:      Page = await poCtx.newPage();

    try {
      // ── ACT 1: Student fills the booking form and submits via the UI ──────
      await loginViaUI(studentPage, '12345', 'student123');

      // Unique date + slot — E2E tests share DB state (global setup runs once).
      // Using dates/slots no other E2E test touches prevents F-022 constraint hits.
      await fillAndSubmitBooking(studentPage, '2026-12-15', '5', 'E2E-PO-001 approval test');

      // The form submission triggers loadBookings() — the new booking card
      // should appear in "My Bookings" immediately after success
      await expect(studentPage.getByText('E2E-PO-001 approval test')).toBeVisible();

      // Confirm the card shows 'pending' before PO acts
      const studentCardBefore = studentPage.locator('.card', {
        hasText: 'E2E-PO-001 approval test',
      });
      await expect(studentCardBefore.locator('.badge')).toContainText('pending');

      // ── ACT 2: PO logs in and approves the booking ────────────────────────
      await loginViaUI(poPage, 'po001', 'po123');
      await expect(poPage.getByRole('button', { name: 'Pending' })).toBeVisible();

      // PO dashboard is a table — locate the row by unique purpose text
      const bookingRow = poPage.locator('tr', { hasText: 'E2E-PO-001 approval test' });
      await expect(bookingRow).toBeVisible();

      // Pattern 7: register before clicking
      const approveResponse = poPage.waitForResponse(
        (r: any) => r.url().includes('/approve') && r.request().method() === 'PATCH'
      );
      await bookingRow.getByRole('button', { name: 'Approve' }).click();
      const approveRes = await approveResponse;

      // Confirm the API returned approved — this is the integration-level check
      const approveJson = await approveRes.json();
      expect(approveJson.status).toBe('approved');

      // PO dashboard shows success alert
      await expect(poPage.locator('.alert-success')).toContainText('approved successfully');

      // ── ASSERT: Student reloads and sees approved status ──────────────────
      // Reload triggers loadBookings() — fetches fresh status from DB
      await studentPage.reload();
      await expect(studentPage.getByRole('button', { name: 'Logout' })).toBeVisible();

      const studentCardAfter = studentPage.locator('.card', {
        hasText: 'E2E-PO-001 approval test',
      });
      await expect(studentCardAfter).toBeVisible();
      await expect(studentCardAfter.locator('.badge')).toContainText('approved');

    } finally {
      await studentCtx.close();
      await poCtx.close();
    }
  });

  // ── E2E-PO-002 ─────────────────────────────────────────────────────────────
  test('E2E-PO-002: student books via UI → PO rejects → student sees rejected status', async ({ browser }) => {
    const studentCtx: BrowserContext = await browser.newContext();
    const poCtx:      BrowserContext = await browser.newContext();
    const studentPage: Page = await studentCtx.newPage();
    const poPage:      Page = await poCtx.newPage();

    try {
      // ── ACT 1: Student books via UI ───────────────────────────────────────
      await loginViaUI(studentPage, '12345', 'student123');

      // Different slot + date from E2E-PO-001 — no overlap, no F-022 collision
      await fillAndSubmitBooking(studentPage, '2026-12-16', '6', 'E2E-PO-002 rejection test');

      await expect(studentPage.getByText('E2E-PO-002 rejection test')).toBeVisible();

      const studentCardBefore = studentPage.locator('.card', {
        hasText: 'E2E-PO-002 rejection test',
      });
      await expect(studentCardBefore.locator('.badge')).toContainText('pending');

      // ── ACT 2: PO rejects the booking ────────────────────────────────────
      await loginViaUI(poPage, 'po001', 'po123');
      await expect(poPage.getByRole('button', { name: 'Pending' })).toBeVisible();

      const bookingRow = poPage.locator('tr', { hasText: 'E2E-PO-002 rejection test' });
      await expect(bookingRow).toBeVisible();

      const rejectResponse = poPage.waitForResponse(
        (r: any) => r.url().includes('/reject') && r.request().method() === 'PATCH'
      );
      await bookingRow.getByRole('button', { name: 'Reject' }).click();
      const rejectRes = await rejectResponse;

      const rejectJson = await rejectRes.json();
      expect(rejectJson.status).toBe('rejected');

      await expect(poPage.locator('.alert-success')).toContainText('rejected successfully');

      // ── ASSERT: Student reloads and sees rejected status ──────────────────
      await studentPage.reload();
      await expect(studentPage.getByRole('button', { name: 'Logout' })).toBeVisible();

      const studentCardAfter = studentPage.locator('.card', {
        hasText: 'E2E-PO-002 rejection test',
      });
      await expect(studentCardAfter).toBeVisible();
      await expect(studentCardAfter.locator('.badge')).toContainText('rejected');

    } finally {
      await studentCtx.close();
      await poCtx.close();
    }
  });

});