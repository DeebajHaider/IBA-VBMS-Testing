import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// Helper — logs in as admin and waits for the dashboard to be ready
async function loginAsAdmin(page: any) {
  await page.goto(BASE);
  await page.getByLabel('ERP / Username').fill('admin');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Wait for the tab bar to confirm AdminDashboard has rendered
  await expect(page.getByRole('button', { name: 'Students' })).toBeVisible();
}

test.describe('Admin E2E', () => {

  test('E2E-ADMIN-001: admin adds a new student via the UI', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Students' }).click();
    await expect(page.getByText('Add New Student')).toBeVisible();

    const studentForm = page.getByText('Add New Student').locator('../..');
    await studentForm.getByText('ERP').locator('..').locator('input').fill('e2e001');
    await studentForm.getByText('Full Name').locator('..').locator('input').fill('E2E Student');
    await studentForm.getByText('Email').locator('..').locator('input').fill('e2e001@iba.edu.pk');
    await studentForm.getByText('Password').locator('..').locator('input').fill('pw123456');

    await page.getByRole('button', { name: 'Add Student' }).click();
    await expect(page.getByText('Student added successfully')).toBeVisible();

    // Scope to table cells to avoid matching other elements with the same text.
    // getByRole('cell') targets <td> elements only — unambiguous even when the
    // same string appears in an input, option, or label elsewhere on the page.
    await expect(page.getByRole('cell', { name: 'e2e001', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'E2E Student' })).toBeVisible();
  });

  test('E2E-ADMIN-004 + 005: admin creates a building then a room in it', async ({ page }) => {
    await loginAsAdmin(page);

    // ── Building creation ─────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Buildings' }).click();
    await expect(page.getByText('Add New Building')).toBeVisible();

    const buildingForm = page.getByText('Add New Building').locator('../..');
    await buildingForm.getByText('Building Name').locator('..').locator('input').fill('E2E Test Block');
    await buildingForm.getByText('Location').locator('..').locator('input').fill('West Campus');

    await page.getByRole('button', { name: 'Add Building' }).click();
    await expect(page.getByText('Building added successfully')).toBeVisible();

    // Scope to a table cell — avoids matching the <option> in the rooms dropdown
    await expect(page.getByRole('cell', { name: 'E2E Test Block' })).toBeVisible();

    // ── Room creation ─────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Rooms' }).click();
    await expect(page.getByText('Add New Room')).toBeVisible();

    const roomForm = page.getByText('Add New Room').locator('../..');
    await roomForm.getByText('Room Name').locator('..').locator('input').fill('E2E Room 101');
    await roomForm.getByText('Building').locator('..').locator('select').selectOption({ label: 'E2E Test Block' });
    await roomForm.getByText('Capacity').locator('..').locator('input').fill('25');
    await roomForm.getByText('Room Type').locator('..').locator('select').selectOption({ label: 'Classroom' });

    await page.getByRole('button', { name: 'Add Room' }).click();
    await expect(page.getByText('Room added successfully')).toBeVisible();

    // Both the room name and building name must appear as table cells in the Rooms List
    await expect(page.getByRole('cell', { name: 'E2E Room 101' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'E2E Test Block' })).toBeVisible();
  });

});

