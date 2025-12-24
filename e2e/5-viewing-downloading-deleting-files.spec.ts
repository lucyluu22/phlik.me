// spec: TEST_PLAN.md
// seed: e2e/seed.spec.ts

import { test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';
import { createTestFiles } from './createTestFiles';
import type { Page } from '@playwright/test';

test.describe('5. Viewing, Downloading, and Deleting Received Files', () => {
	let testFiles: ReturnType<typeof createTestFiles>;

	test.beforeAll(() => {
		testFiles = createTestFiles();
	});

	async function sendFilesToClient(page: Page, client: string, files: string[]) {
		page.goto('/send');

		// Select receiver client
		const clientSelect = page.getByRole('combobox', { name: /Select Connected Client/i });
		const clientOption = clientSelect.getByRole('option', { name: client });
		const clientId = await clientOption.getAttribute('value');
		await clientSelect.selectOption(clientId!);

		const fileInput = page.getByLabel('Select Files');
		await fileInput.setInputFiles(files);

		// Wait for transfer to complete
		await expect(page.getByText(/Transfer Complete/i)).toHaveCount(files.length, {
			timeout: 20_000
		});
	}

	test('5.1 View Received Files List', async ({ phlickClient }) => {
		// Set up Client B with received files
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);
		await sendFilesToClient(pageA, 'Client B', testFiles.testImages);

		// 1. On Client B, navigate to "View Files"
		await pageB.goto('/files');

		// 2. Observe the received files list
		// Expected Results:

		// - All received files are listed with file names
		await expect(pageB.getByText('photo1.jpg')).toBeVisible();
		await expect(pageB.getByText('photo2.jpg')).toBeVisible();
		await expect(pageB.getByText('photo3.png')).toBeVisible();

		// - File size (human-readable format: KB, MB, GB)
		await expect(pageB.getByText(/KB|MB/i)).toHaveCount(3);

		for (const detailsButton of await pageB.getByRole('button', { name: /Details/i }).all()) {
			await detailsButton.click();
		}

		// - Sender's client name (should show the clientId since we used mock data)
		await expect(pageB.getByText(/Client A/i)).toHaveCount(3);

		// - Each file entry has action buttons: "Save File" and "Delete File"
		const saveButtons = pageB.getByRole('button', { name: /Save/i });
		await expect(saveButtons.first()).toBeVisible();
		await expect(saveButtons).toHaveCount(3);

		const deleteButtons = pageB.getByRole('button', { name: /Delete/i });
		await expect(deleteButtons.first()).toBeVisible();
		await expect(deleteButtons).toHaveCount(3);

		// - "No Files Available" message is NOT displayed
		await expect(pageB.getByRole('heading', { name: /No Files Available/i })).not.toBeVisible();
	});

	test('5.2 View Received Files - Empty State', async ({ phlickClient }) => {
		// 1. On a fresh client (no received files), navigate to "View Files"
		const page = await phlickClient.createClient('Client B - Empty');
		await page.goto('/files');

		// Expected Results:

		// - Heading displays: "No Files Available ;_;"
		await expect(page.getByRole('heading', { name: /No Files Available/i })).toBeVisible();

		// - Icon or illustration is shown
		// Check for SVG or icon element
		const svgIcon = page.locator('svg').first();
		await expect(svgIcon).toBeVisible();

		// - Explanatory text: "Files sent to this client will be listed here."
		await expect(page.getByText(/Files sent to this client will be listed here/i)).toBeVisible();

		// - "Done" link to return to homepage
		await expect(page.getByRole('link', { name: /Done/i })).toBeVisible();
	});

	test('5.3 Download Single Received File', async ({ phlickClient }) => {
		// Set up Client B with a received file
		const pageA = await phlickClient.createClient('Client A - Download Single');
		const pageB = await phlickClient.createClient('Client B - Download Single');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		await sendFilesToClient(pageA, 'Client B - Download Single', [testFiles.smallFile]);

		// 1. On Client B with received files, navigate to "View Files"
		await pageB.goto('/files');

		// 2. Locate a specific file in the list: vacation-photo.jpg
		await expect(pageB.getByText('test-doc.txt')).toBeVisible();

		// 3. Click the "Save File" button for that file
		const downloadPromise = pageB.waitForEvent('download');
		const saveButton = pageB
			.getByRole('listitem', { name: 'test-doc.txt' })
			.getByRole('button', { name: /Save/i });
		await saveButton.click();

		// Expected Results:

		// - File download initiates immediately
		const download = await downloadPromise;

		// - Downloaded file name matches the original
		expect(download.suggestedFilename()).toBe('test-doc.txt');

		// - File content is intact and can be opened successfully
		const downloadPath = path.join(
			import.meta.dirname,
			'_artifacts',
			'downloads',
			download.suggestedFilename()
		);
		await download.saveAs(downloadPath);

		const fileExists = fs.existsSync(downloadPath);
		expect(fileExists).toBeTruthy();

		// Verify file integrity
		const downloadedData = fs.readFileSync(downloadPath);
		const originalData = fs.readFileSync(testFiles.smallFile);
		expect(downloadedData.equals(originalData)).toBeTruthy();

		// - File remains in the received files list after download (not removed)
		await expect(pageB.getByText('test-doc.txt')).toBeVisible();
	});

	test('5.4 Download Multiple Received Files', async ({ phlickClient }) => {
		// Set up Client B with multiple files
		const pageA = await phlickClient.createClient('Client A - Download Multiple');
		const pageB = await phlickClient.createClient('Client B - Download Multiple');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		await sendFilesToClient(pageA, 'Client B - Download Multiple', testFiles.testImages);

		// 1. On Client B, navigate to "View Files" with multiple files received
		await pageB.goto('/files');

		// 2. Download each file one by one by clicking "Save File" for each entry
		for (const fileName of testFiles.testImages.map((f) => path.basename(f))) {
			const saveButton = pageB
				.getByRole('listitem', { name: fileName })
				.getByRole('button', { name: /Save/i });
			await expect(saveButton).toBeVisible();

			const downloadPromise = pageB.waitForEvent('download');
			await saveButton.click();
			const download = await downloadPromise;

			// Expected Results:
			// - Each file downloads successfully with correct name and content
			expect(download.suggestedFilename()).toBe(fileName);
			const downloadPath = path.join(
				import.meta.dirname,
				'_artifacts',
				'downloads',
				download.suggestedFilename()
			);
			await download.saveAs(downloadPath);

			const fileExists = fs.existsSync(downloadPath);
			expect(fileExists).toBeTruthy();

			const downloadedData = fs.readFileSync(downloadPath);
			const originalData = fs.readFileSync(
				path.join(testFiles.testImages.find((f) => f.endsWith(fileName))!)
			);
			expect(downloadedData.equals(originalData)).toBeTruthy();
		}

		// - All files remain in the list after downloading
		await expect(pageB.getByText('photo1.jpg')).toBeVisible();
		await expect(pageB.getByText('photo2.jpg')).toBeVisible();
		await expect(pageB.getByText('photo3.png')).toBeVisible();
	});

	test('5.5 View File Details', async ({ phlickClient }) => {
		// Set up Client B with files
		const pageA = await phlickClient.createClient('Client A - Details');
		const pageB = await phlickClient.createClient('Client B - Details');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		await sendFilesToClient(pageA, 'Client B - Details', [testFiles.mediumFile]);

		// 1. On Client B, navigate to "View Files"
		await pageB.goto('/files');

		// 2. Observe file entries
		await expect(pageB.getByText('test-document.pdf')).toBeVisible();

		// Expected Results:
		// - Additional file metadata is displayed:
		const detailsButton = pageB.getByRole('button', { name: /Details/i }).first();
		await expect(detailsButton).toBeVisible();

		// Click to expand details
		await detailsButton.click();

		// - File size in human-readable format
		await expect(pageB.getByText(/KB|MB/i)).toBeVisible();

		// - Sender's client name
		await expect(pageB.getByText(/Client A - Details/i)).toBeVisible();

		// - Date and time received
		await expect(pageB.getByText(/Sent On/i)).toBeVisible();

		// - Delete Button
		await expect(pageB.getByRole('button', { name: /Delete/i })).toBeVisible();

		// - Details section can be collapsed by clicking again
		await detailsButton.click();
		await expect(pageB.getByText(/Client A - Details/i)).not.toBeVisible();
		await expect(pageB.getByText(/Sent On/i)).not.toBeVisible();
		await expect(pageB.getByRole('button', { name: /Delete/i })).not.toBeVisible();
	});

	test('5.6 Delete Single Received File', async ({ phlickClient }) => {
		// Set up Client B with files
		const pageA = await phlickClient.createClient('Client A - Delete Single');
		const pageB = await phlickClient.createClient('Client B - Delete Single');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		await sendFilesToClient(pageA, 'Client B - Delete Single', [
			testFiles.smallFile,
			testFiles.mediumFile
		]);

		// 1. On Client B, navigate to "View Files"
		await pageB.goto('/files');

		// 2. Locate a file: old-document.pdf
		await expect(pageB.getByText('test-doc.txt')).toBeVisible();
		await expect(pageB.getByText('test-document.pdf')).toBeVisible();

		// 3. Click the "Delete File" button
		const deletedFile = pageB.getByRole('listitem', { name: 'test-doc.txt' });
		await deletedFile.click();
		const deleteButton = deletedFile.getByRole('button', { name: /Delete/i });
		await deleteButton.click();

		// Expected Results:

		// - The file is removed from the list immediately
		// Wait a bit for the deletion to complete
		await pageB.waitForTimeout(500);

		// One of the files should be gone
		expect(deletedFile).not.toBeVisible();
		expect(pageB.getByText('test-document.pdf')).toBeVisible();

		// - File is deleted from IndexedDB storage (verified by not being in the list)
		// - UI updates to reflect the deletion
	});

	test('5.7 Delete Multiple Received Files', async ({ phlickClient }) => {
		// Set up Client B with multiple files
		const pageA = await phlickClient.createClient('Client A - Delete Multiple');
		const pageB = await phlickClient.createClient('Client B - Delete Multiple');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		await sendFilesToClient(pageA, 'Client B - Delete Multiple', [
			testFiles.smallFile,
			testFiles.mediumFile,
			testFiles.testImages[0]
		]);

		// 1. On Client B, navigate to "View Files" with multiple files
		await pageB.goto('/files');

		// 2. Delete several files one by one
		const firstFile = pageB.getByRole('listitem', { name: 'test-doc.txt' });
		const secondFile = pageB.getByRole('listitem', { name: 'test-document.pdf' });
		const thirdFile = pageB.getByRole('listitem', { name: 'photo1.jpg' });

		// Delete first file
		firstFile.click();
		firstFile.getByRole('button', { name: /Delete/i }).click();
		await pageB.waitForTimeout(300);

		// Expected Results:

		// - Each file is deleted successfully
		// - List updates after each deletion
		expect(firstFile).not.toBeVisible();
		await expect(secondFile).toBeVisible();
		await expect(thirdFile).toBeVisible();

		// Delete second file
		secondFile.click();
		secondFile.getByRole('button', { name: /Delete/i }).click();
		await pageB.waitForTimeout(300);

		await expect(thirdFile).toBeVisible();
		expect(secondFile).not.toBeVisible();

		// Delete third file
		thirdFile.click();
		thirdFile.getByRole('button', { name: /Delete/i }).click();
		await pageB.waitForTimeout(300);

		// - After all deletions:

		// - If it was the last file, the empty state message appears
		await expect(pageB.getByRole('heading', { name: /No Files Available/i })).toBeVisible();
	});
});
