import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ── helpers ───────────────────────────────────────────────────────────────────

async function loginAsStudent(page: any) {
  await page.goto(BASE);
  await page.getByLabel('ERP / Username').fill('12345');
  await page.getByLabel('Password').fill('student123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('IBA Facility Booking')).toBeVisible();
}

// Fills and submits the booking form.
// Extracted after seeing it duplicated in BOOK-001 and BOOK-002.
// Does NOT assert the outcome — each test does that itself.
async function fillBookingForm(
  page     : any,
  date     : string,
  slotValue: string,  // the slot_id as string, e.g. '1', '2', '3'
  purpose  : string,
) {
  // Listen for rooms API call BEFORE selecting the building — Playwright requires this order
  const roomsLoaded = page.waitForResponse(
    (r: any) => r.url().includes('/api/rooms') && r.url().includes('building_id')
  );
  // nth(0)=Building, nth(1)=Room, nth(2)=Time Slot — labels have no htmlFor (F-008)
  await page.locator('select').nth(0).selectOption({ label: 'Test Block' });
  await roomsLoaded;

  // Room option text includes capacity from the JSX: "{r.name} (Cap: {r.capacity})"
  await page.locator('select').nth(1).selectOption({ label: 'Room 101 (Cap: 30)' });
  await page.locator('input[type="date"]').fill(date);
  await page.locator('select').nth(2).selectOption({ value: slotValue });
  await page.getByPlaceholder('Describe the activity...').fill(purpose);
  await page.getByRole('button', { name: 'Submit Booking Request' }).click();
}

// Creates a booking from inside the browser via fetch() (avoids page.request network issues).
// purpose param prevents strict-mode violations when multiple tests create bookings.
async function createBookingViaApi(
  page    : any,
  slot_id : number,
  date    : string,
  purpose : string = 'E2E pre-setup',
) {
  const token: string = await page.evaluate(
    () => localStorage.getItem('iba_token')
  );

  const rooms: any[] = await page.evaluate(async (tok: string) => {
    const res = await fetch('http://localhost:3000/api/rooms', {
      headers: { Authorization: `Bearer ${tok}` },
    });
    return res.json();
  }, token);

  const booking = await page.evaluate(
    async (p: { tok: string; room_id: string; date: string; slot_id: number; purpose: string }) => {
      const res = await fetch('http://localhost:3000/api/bookings', {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization : `Bearer ${p.tok}`,
        },
        body: JSON.stringify({
          room_id : p.room_id,
          date    : p.date,
          slot_id : p.slot_id,
          purpose : p.purpose,
        }),
      });
      return res.json();
    },
    { tok: token, room_id: rooms[0].id, date, slot_id, purpose },
  );

  return { booking, roomId: rooms[0].id };
}

// ── tests ─────────────────────────────────────────────────────────────────────
test.describe('Student Booking E2E', () => {

  // ── E2E-BOOK-001 ──────────────────────────────────────────────────────────
  test('E2E-BOOK-001: student books an available room end-to-end', async ({ page }) => {
    await loginAsStudent(page);
    await fillBookingForm(page, '2026-10-01', '1', 'Study session');

    // handleAlert("Booking request submitted successfully!") → .alert-success
    await expect(page.locator('.alert-success')).toContainText('submitted successfully');
  });

  // ── E2E-BOOK-002 ──────────────────────────────────────────────────────────
  test('E2E-BOOK-002: submitting a duplicate booking shows conflict error', async ({ page }) => {
    await loginAsStudent(page);

    // FIRST BOOKING — via UI, same slot and date we'll try again
    await fillBookingForm(page, '2026-10-10', '3', 'First booking');
    await expect(page.locator('.alert-success')).toContainText('submitted successfully');

    // After success, the form resets (building/room/date/slot/purpose all clear).
    // Fill again with the same date+slot → API returns 409.
    // Using UI for both avoids the API pre-creation timing issue where the
    // 3-second alert auto-dismiss races against test execution speed.
    await fillBookingForm(page, '2026-10-10', '3', 'Second attempt');

    // handleAlert(err.message, true) → .alert-error
    // API message: "This slot is already booked"
    await expect(page.locator('.alert-error')).toContainText('already booked');
  });

  // ── E2E-CANCEL-001 ────────────────────────────────────────────────────────
  test('E2E-CANCEL-001: student cancels own pending booking via the UI', async ({ page }) => {
    await loginAsStudent(page);

    // Unique purpose prevents strict-mode violation — by this point BOOK-001
    // and BOOK-002 have already created bookings with different purposes.
    // 'Cancel-001 booking' is unique to this test.
    await createBookingViaApi(page, 4, '2026-10-03', 'Cancel-001 booking');

    // Reload so loadBookings() fetches the new booking into "My Bookings"
    await page.reload();
    await expect(page.getByText('IBA Facility Booking')).toBeVisible();

    // Unique purpose makes this locator unambiguous across all test bookings
    await expect(page.getByText('Cancel-001 booking')).toBeVisible();

    // Register BEFORE clicking — Playwright requires this ordering
    // Dialog text: "Are you sure you want to cancel this booking?"
    page.on('dialog', (dialog: any) => dialog.accept());

    // Bookings are ordered newest-first — our booking appears at the top
    await page.getByRole('button', { name: 'Cancel' }).first().click();

    // handleAlert("Booking cancelled successfully") → .alert-success
    // This is the definitive assertion — other pending bookings from previous
    // tests still have Cancel buttons, so we don't assert absence of all buttons.
    await expect(page.locator('.alert-success')).toContainText('cancelled successfully');
  });

}); // end test.describe
