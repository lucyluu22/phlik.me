// spec: TEST_PLAN.md
// seed: e2e/seed.spec.ts

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Helper function to enter a link code
 */
async function enterLinkCode(page: Page, code: string) {
	await page.goto('/manage');

	// Find the four input boxes for link code entry
	const inputs = page.getByRole('group', { name: /Enter Link Code/i }).locator('input');
	const chars = code.split('');

	for (let i = 0; i < chars.length; i++) {
		await inputs.nth(i).fill(chars[i]);
	}
}

test.describe('2. Linking Two Clients Together', () => {
	test('2.1 Generate Link Code', async ({ phlickClient }) => {
		// Set up Client A
		const page = await phlickClient.createClient('Client A');

		// 1. On Client A, navigate to "Client Settings" from main menu
		await page.goto('/manage');

		// 2. Verify the "No Connected Clients" heading is displayed
		await expect(page.getByRole('heading', { name: /No Connected Clients/i })).toBeVisible();

		// 3. Observe the "Enter Link Code" input group (4 separate boxes)
		await expect(page.getByRole('group', { name: /Enter Link Code/i })).toBeVisible();
		const linkCodeInputs = page.locator('input[maxlength="1"]');
		await expect(linkCodeInputs).toHaveCount(4);

		// 4. Click "Generate Link Code" link
		await page.getByRole('link', { name: /Generate Link Code/i }).click();

		// Expected Results:
		// - User is redirected to /manage/link page
		await expect(page).toHaveURL('/manage/link');

		// - A 4-character alphanumeric link code is displayed
		const codeElement = page.getByTestId('link-code');
		await expect(codeElement).toBeVisible();
		const linkCode = await codeElement.textContent();
		expect(linkCode?.trim()).toMatch(/^[A-Z0-9]{4}$/);

		// - Explanatory text is present
		await expect(page.getByText(/only works once/i)).toBeVisible();

		// - "Done" link is available to return to homepage
		await expect(page.getByRole('link', { name: /Done/i })).toBeVisible();
	});

	test('2.2 Enter Valid Link Code - Successful Connection', async ({ phlickClient }) => {
		// Create two separate browser contexts (Client A and Client B)
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');

		// 1. On Client A, generate a link code
		const linkCode = await phlickClient.generateLinkCode(pageA);

		// 2. On Client B, navigate to "Client Settings"
		await pageB.goto('/manage');

		// 3. In the "Enter Link Code" section, type the 4 characters into the four input boxes
		const inputs = pageB.getByRole('group', { name: /Enter Link Code/i }).locator('input');
		const chars = linkCode.split('');

		for (let i = 0; i < 4; i++) {
			await inputs.nth(i).fill(chars[i]);

			// Expected: Focus automatically advances to the next box
			if (i < 3) {
				await expect(inputs.nth(i + 1)).toBeFocused();
			}
		}

		// 4. Observe automatic submission when fourth character is entered
		// Expected: Connection process begins automatically
		// Wait for success indication (toast, notification, or list update)
		await expect(pageB.getByRole('status')).toBeVisible({ timeout: 10000 });

		// Expected: Both clients appear in each other's connected clients list
		await pageA.goto('/manage');
		await pageB.goto('/manage');

		// On Client A, verify Client B appears
		await expect(pageA.getByText('Client B')).toBeVisible();

		// On Client B, verify Client A appears
		await expect(pageB.getByText('Client A')).toBeVisible();

		// Verify "No Connected Clients" is no longer shown
		await expect(pageA.getByRole('heading', { name: /No Connected Clients/i })).not.toBeVisible();
		await expect(pageB.getByRole('heading', { name: /No Connected Clients/i })).not.toBeVisible();
	});

	test('2.3 Enter Invalid Link Code', async ({ phlickClient }) => {
		const page = await phlickClient.createClient('Client A');

		// 1. On Client A, navigate to "Client Settings"
		await page.goto('/manage');

		// 2. Enter a random 4-character code that was not generated: "ZZZZ"
		await enterLinkCode(page, 'ZZZZ');

		// Expected Results:
		// - Error message appears: "Invalid or expired link code"
		await expect(page.getByRole('status').getByText(/Invalid or expired link code/i)).toBeVisible({
			timeout: 5000
		});

		// - No connection is established
		// - User remains on the settings page
		await expect(page).toHaveURL('/manage');
	});

	test('2.4 Reuse Expired Link Code', async ({ phlickClient }) => {
		// Create three separate browser contexts
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');
		const pageC = await phlickClient.createClient('Client C');

		// 1. On Client A, generate a link code
		const linkCode = await phlickClient.generateLinkCode(pageA);

		// 2. On Client B, enter the code to establish connection (successful)
		await enterLinkCode(pageB, linkCode);

		// Wait for successful connection
		await expect(pageB.getByRole('status')).toBeVisible({ timeout: 10000 });

		// 3. On a third browser (Client C), attempt to enter the same code
		await enterLinkCode(pageC, linkCode);

		// Expected Results:
		// - Error message appears: "Invalid or expired link code"
		await expect(pageC.getByRole('status').getByText(/Invalid or expired link code/i)).toBeVisible({
			timeout: 5000
		});

		// - No connection is established
		// - Code is single-use and consumed after first successful connection
		await pageC.goto('/manage');
		await expect(pageC.getByText('Client A')).not.toBeVisible();
		await expect(pageC.getByText('Client B')).not.toBeVisible();
	});

	test.skip('2.5 Link Code Expiration', async () => {
		// This test is skipped because it requires waiting for expiration time (5-10 minutes)
		// which makes it unsuitable for regular test runs
	});

	test('2.6 View Connected Clients List', async ({ phlickClient }) => {
		// Create two separate browser contexts
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');

		// 1. Successfully link Client A and Client B
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await enterLinkCode(pageB, linkCode);
		await expect(pageB.getByRole('status')).toBeVisible({ timeout: 10_000 });

		// 2. On Client A, navigate to "Client Settings"
		await pageA.goto('/manage');

		// 3. Observe the connected clients section

		// Expected Results:
		// - "No Connected Clients" heading is replaced with a list of connections
		await expect(pageA.getByRole('heading', { name: /No Connected Clients/i })).not.toBeVisible();

		// - Client B's name is displayed in the list
		await expect(pageA.getByText('Client B')).toBeVisible();

		// - UI provides options to manage the connection (rename, disconnect)
		// Look for action buttons/links associated with the connected client
		const clientEntry = pageA.getByRole('listitem').filter({ hasText: 'Client B' });
		await expect(clientEntry.getByRole('link', { name: /Configure/i })).toBeVisible();
	});

	test('2.7 Disconnect a Linked Client', async ({ phlickClient }) => {
		// Create two separate browser contexts
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');

		// 1. Successfully link Client A and Client B
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 2. On Client A, navigate to "Client Settings"
		await pageA.goto('/manage');

		// 3. Locate Client B in the connected clients list
		const clientEntry = pageA.getByRole('listitem').filter({ hasText: 'Client B' });
		await expect(clientEntry).toBeVisible();

		// 4. Click "Disconnect" or similar action button for Client B
		const configure = clientEntry.getByRole('link', { name: /Configure/i });
		await configure.click();

		await expect(pageA).toHaveURL(/\/manage\/.+/);
		const disconnectButton = pageA.getByRole('button', { name: /Disconnect/i });
		await expect(disconnectButton).toBeVisible();
		await disconnectButton.click();

		// 5. Confirm disconnection if prompted
		const confirmButton = pageA.getByRole('button', { name: /Confirm|Yes/i });
		await expect(confirmButton).toBeVisible();
		await confirmButton.click();

		// Expected Results:
		// - Success notification appears
		await expect(pageA.getByRole('status')).toBeVisible({ timeout: 5_000 });
		await expect(pageA).toHaveURL('/manage');

		// - Client B is removed from Client A's connected clients list
		await expect(pageA.getByText('Client B')).not.toBeVisible();

		// - Client A is removed from Client B's connected clients list (bidirectional removal)
		await pageB.waitForTimeout(5_000); // Wait a moment for sync
		await pageB.goto('/manage');
		await expect(pageB.getByText('Client A')).not.toBeVisible();

		// - "No Connected Clients" heading reappears
		await expect(pageA.getByRole('heading', { name: /No Connected Clients/i })).toBeVisible();
	});

	test('2.8 Rename a Connected Client', async ({ phlickClient }) => {
		// Create two separate browser contexts
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');

		// 1. Successfully link Client A and Client B
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 2. On Client A, navigate to "Client Settings"
		await pageA.goto('/manage');

		// 3. Locate Client B in the connected clients list
		// 4. Click "Edit" or "Rename" for Client B's entry
		const clientEntry = pageA.getByRole('listitem').filter({ hasText: 'Client B' });
		await expect(clientEntry).toBeVisible();
		const configure = clientEntry.getByRole('link', { name: /Configure/i });
		await configure.click();

		await expect(pageA).toHaveURL(/\/manage\/.+/);

		// 5. Enter a new name: "Bob's Phone"
		const nameInput = pageA.getByRole('textbox', { name: /Rename/i }).last();
		await nameInput.fill("Bob's Phone");

		// 6. Save the change
		await pageA.getByRole('button', { name: /Save|Submit/i }).click();

		await pageA.goto('/manage');

		// Expected Results:
		// - Client B's name is updated to "Bob's Phone" in Client A's list
		await expect(pageA.getByText("Bob's Phone")).toBeVisible();
		await expect(pageA.getByText('Client B')).not.toBeVisible();

		// - The name change is local to Client A only
		// - Client B's self-assigned name remains unchanged
		await pageB.goto('/manage');
		const clientNameB = await pageB.getByRole('textbox', { name: /Client Name/i }).inputValue();
		expect(clientNameB).toBe('Client B');

		// - Change persists across browser sessions
		await pageA.goto('/');
		await pageA.goto('/manage');
		await expect(pageA.getByText("Bob's Phone")).toBeVisible();
	});
});
