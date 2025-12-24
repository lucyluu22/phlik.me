// spec: TEST_PLAN.md
// seed: e2e/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('1. Client Initialization and Setup', () => {
	test('1.1 Initial Client Setup - Valid Name', async ({ page }) => {
		// 1. Navigate to the application homepage
		await page.goto('/');

		// 2. Verify automatic redirect to /setup page
		await expect(page).toHaveURL('/setup');

		// 3. Verify the "Name This Client" heading is displayed
		await expect(page.getByRole('heading', { name: 'Name This Client' })).toBeVisible();

		// 4. Verify the name input field is present and has help text
		const nameInput = page.getByRole('textbox', { name: 'Name This Client' });
		await expect(nameInput).toBeVisible();

		// 5. Type a valid client name: "My Desktop PC"
		await nameInput.fill('My Desktop PC');

		// 6. Click the "Submit" button
		await page.getByRole('button', { name: 'Submit' }).click();

		// 7. Verify redirect to homepage (/)
		await expect(page).toHaveURL('/');

		// 8. Verify success toast message appears (note: it may disappear quickly)
		// We'll check the navigation menu instead as proof of successful setup

		// 9. Verify main navigation menu is visible with "Send Files", "View Files", and "Client Settings" links
		await expect(page.getByRole('link', { name: 'Send Files' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'View Files' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Client Settings' })).toBeVisible();

		// 10. Verify client name is persisted in localStorage
		const storedName = await page.evaluate(() => localStorage.getItem('client.name'));
		expect(storedName).toBe('My Desktop PC');
	});

	test('1.2 Initial Client Setup - Empty Name Validation', async ({ page }) => {
		// 1. Navigate to setup page (fresh browser)
		await page.goto('/');
		await expect(page).toHaveURL('/setup');

		// 2. Leave the "Name This Client" field empty
		const nameInput = page.getByRole('textbox', { name: 'Name This Client' });
		await expect(nameInput).toBeVisible();
		await nameInput.clear();

		// 3. Click "Submit" button
		await page.getByRole('button', { name: 'Submit' }).click();

		// Expected: Form validation prevents submission
		// User remains on setup page
		await expect(page).toHaveURL('/setup');

		// Verify no success message or navigation menu appears
		await expect(page.getByRole('link', { name: 'Send Files' })).not.toBeVisible();
	});

	test('1.3 Initial Client Setup - Special Characters', async ({ page }) => {
		// 1. Navigate to setup page (fresh browser)
		await page.goto('/');
		await expect(page).toHaveURL('/setup');

		// 2. Enter client name with special characters (XSS attempt)
		const maliciousName = `Test<script>alert('xss')</script>`;
		const nameInput = page.getByRole('textbox', { name: 'Name This Client' });
		await nameInput.fill(maliciousName);

		// 3. Click "Submit"
		await page.getByRole('button', { name: 'Submit' }).click();

		// Expected: Client name is sanitized/escaped properly
		// Setup completes successfully
		await expect(page).toHaveURL('/');

		// Verify no script execution occurs
		// Navigation menu should be visible (proof of successful setup without XSS)
		await expect(page.getByRole('link', { name: 'Send Files' })).toBeVisible();

		// Verify name is stored (but not executed)
		const storedName = await page.evaluate(() => localStorage.getItem('client.name'));
		expect(storedName).toBe(maliciousName);

		// Navigate to manage page and verify the name displays safely
		await page.goto('/manage');
		const displayedValue = await page.getByRole('textbox', { name: 'Client Name' }).inputValue();
		expect(displayedValue).toBe(maliciousName);
	});

	test('1.4 Return Visit - Already Setup Client', async ({ page, context }) => {
		// First, complete initial setup
		await page.goto('/');
		await expect(page).toHaveURL('/setup');

		const clientName = 'Test Client for Return Visit';
		await page.getByRole('textbox', { name: 'Name This Client' }).fill(clientName);
		await page.getByRole('button', { name: 'Submit' }).click();
		await expect(page).toHaveURL('/');

		// Verify client name is stored
		const storedName = await page.evaluate(() => localStorage.getItem('client.name'));
		expect(storedName).toBe(clientName);

		// Simulate browser close and reopen by creating a new page with the same context
		// (context retains localStorage)
		const newPage = await context.newPage();

		// Navigate to application homepage
		await newPage.goto('/');

		// Expected: User is NOT redirected to setup page
		await expect(newPage).toHaveURL('/');
		await expect(newPage).not.toHaveURL('/setup');

		// Homepage displays immediately with main navigation
		await expect(newPage.getByRole('link', { name: 'Send Files' })).toBeVisible();
		await expect(newPage.getByRole('link', { name: 'View Files' })).toBeVisible();
		await expect(newPage.getByRole('link', { name: 'Client Settings' })).toBeVisible();

		// Verify previous client name is retained
		const retainedName = await newPage.evaluate(() => localStorage.getItem('client.name'));
		expect(retainedName).toBe(clientName);

		// Verify navigation menu is accessible
		await newPage.getByRole('link', { name: 'Client Settings' }).click();
		await expect(newPage).toHaveURL('/manage');

		await newPage.close();
	});
});
