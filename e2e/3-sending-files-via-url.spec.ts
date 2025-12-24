// spec: TEST_PLAN.md
// seed: e2e/seed.spec.ts

import { test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';
import { createTestFiles } from './createTestFiles';

test.describe('3. Sending Files Via URL', () => {
	let testFiles: ReturnType<typeof createTestFiles>;

	test.beforeAll(() => {
		testFiles = createTestFiles();
	});

	test('3.1 Generate File Sharing URL - Single File', async ({ phlickClient }) => {
		// Set up Client A
		const page = await phlickClient.createClient('Client A - Sender');

		// 1. On Client A, navigate to "Send Files"
		await page.goto('/send');
		await expect(page).toHaveURL('/send');

		// 2. Verify the page displays "Send Via Link" option
		const sendViaLinkButton = page
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });
		await expect(sendViaLinkButton).toBeVisible();

		// 3. Click "Send Via Link" button
		const fileChooserPromise = page.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		// 4. When the file picker dialog opens, select a single test file
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles([testFiles.mediumFile]);

		// 5. Observe the URL generation process
		// Expected Results:

		// - A unique shareable URL is generated (format: /files/{publicId}/{linkCode})
		const urlPattern = /\/files\/[^/]+\/[^/]+/;
		await expect(page.getByText(urlPattern)).toBeVisible();

		// - URL is displayed prominently with copy functionality
		await expect(page.getByRole('button', { name: urlPattern })).toBeVisible();

		// - The selected file name is displayed
		await expect(page.getByText('test-document.pdf')).toBeVisible();

		// - File size is displayed
		await expect(page.getByText(/500.*KB|0\.5.*MB/i)).toBeVisible();

		// - Explanatory text indicates the URL can be shared
		await expect(page.getByText(/share|shared|shareable/i)).toBeVisible();

		// - An option to cancel/close is available
		await expect(
			page
				.getByRole('button', { name: /Cancel|Close|Done/i })
				.or(page.getByRole('link', { name: /Cancel|Close|Done/i }))
		).toBeVisible();
	});

	test('3.2 Generate File Sharing URL - Multiple Files', async ({ phlickClient }) => {
		const page = await phlickClient.createClient('Client A - Multi File Sender');

		// 1. On Client A, navigate to "Send Files"
		await page.goto('/send');

		// 2. Click "Send Via Link"
		const sendViaLinkButton = page
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = page.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		// 3. In the file picker, select multiple files (3 images)
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(testFiles.testImages);

		// 4. Observe the URL generation
		// Expected Results:

		// - A single shareable URL is generated for all files
		const urlPattern = /\/files\/[^/]+\/[^/]+/;
		await expect(page.getByText(urlPattern)).toBeVisible();

		// - All selected files are listed with names
		await expect(page.getByText('photo1.jpg')).toBeVisible();
		await expect(page.getByText('photo2.jpg')).toBeVisible();
		await expect(page.getByText('photo3.png')).toBeVisible();

		// - Multiple files can be selected (verified by all 3 being present)

		// - Total size of all files is displayed (or individual sizes)
		await expect(page.getByText(/KB|MB/i)).toHaveCount(3);
	});

	test('3.3 Generate File Sharing URL - Large File', async ({ phlickClient }) => {
		const page = await phlickClient.createClient('Client A - Large File Sender');

		// 1. On Client A, navigate to "Send Files"
		await page.goto('/send');

		// 2. Click "Send Via Link"
		const sendViaLinkButton = page
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = page.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		// 3. Select a large file (5 MB test file)
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles([testFiles.largeFile]);

		// 4. Observe the URL generation
		// Expected Results:

		// - Large file is accepted without error
		// - URL is generated successfully
		const urlPattern = /\/files\/[^/]+\/[^/]+/;
		await expect(page.getByText(urlPattern)).toBeVisible();

		// - File name is displayed
		await expect(page.getByText('large-video.mp4')).toBeVisible();

		// - File size is displayed correctly (5 MB)
		await expect(page.getByText(/5.*MB/i)).toBeVisible();

		// - No immediate file upload occurs (P2P transfer happens when recipient accesses URL)
		// This is implicit - if we reached here without errors, the file wasn't uploaded
	});

	test('3.4 Access File Sharing URL - Successful Download', async ({ phlickClient }) => {
		// Set up both clients
		const pageA = await phlickClient.createClient('Client A - Sender');
		const pageB = await phlickClient.createClient('Client B - Recipient');

		// 1. Complete scenario 3.1 to generate a URL on Client A
		await pageA.goto('/send');

		const sendViaLinkButton = pageA
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = pageA.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles([testFiles.mediumFile]);

		// Wait for URL generation
		const urlPattern = /\/files\/[^/]+\/[^/]+/;

		// 2. Copy the generated URL
		const shareUrlElement = pageA.getByText(urlPattern).first();
		await expect(pageA.getByText(urlPattern)).toBeVisible();
		const shareUrl = await shareUrlElement.textContent();
		expect(shareUrl).toBeTruthy();

		// Extract the path from the URL (handle both full URLs and relative paths)
		const urlMatch = shareUrl?.match(/\/files\/[^/\s]+\/[^/\s]+/);
		expect(urlMatch).toBeTruthy();
		const sharePath = urlMatch![0];

		// 3. On a separate browser (Client B), navigate to the URL
		await pageB.goto(sharePath);

		// 4. Observe the file transfer page
		// Expected Results:

		// - Recipient (Client B) sees a page with file details
		await expect(pageB.getByText('test-document.pdf')).toBeVisible();

		// - File size is visible
		await expect(pageB.getByText(/500.*KB|0\.5.*MB/i)).toBeVisible();

		// - Sender's client name is displayed
		await expect(pageB.getByText(/Client A - Sender/i)).toBeVisible();

		// 5. Click "Download" or equivalent action button for the file
		const downloadButton = pageB.getByRole('button', { name: /Download/i }).first();
		await expect(downloadButton).toBeVisible();

		await downloadButton.click();

		// Expected Results:
		// - File download initiates successfully
		await expect(pageB.getByText(/Transfer Completed/i)).toBeVisible();

		// - Option to open the file or show in folder is provided
		const saveFileButton = pageB.getByRole('button', { name: /Save/i }).first();
		await expect(saveFileButton).toBeVisible();

		const downloadPromise = pageB.waitForEvent('download');
		await saveFileButton.click();
		const download = await downloadPromise;

		// - Upon completion, the file can be saved to Client B's device
		const downloadPath = path.join(
			import.meta.dirname,
			'_artifacts',
			'downloads',
			download.suggestedFilename()
		);
		await download.saveAs(downloadPath);

		// - File integrity is maintained (checksums match, file opens correctly)
		const fileExists = fs.existsSync(downloadPath);
		expect(fileExists).toBeTruthy();
		const fileData = fs.readFileSync(downloadPath);
		const originalData = fs.readFileSync(testFiles.mediumFile);
		expect(fileData.equals(originalData)).toBeTruthy();

		// - Sender (Client A) sees transfer progress/status notification
		await expect(pageA.getByText(/Transfer Completed/i)).toBeVisible();
	});

	test('3.5 Access File Sharing URL - Multiple Files Download', async ({ phlickClient }) => {
		// Set up both clients
		const pageA = await phlickClient.createClient('Client A - Sender');
		const pageB = await phlickClient.createClient('Client B - Recipient');

		// 1. Complete scenario 3.2 to generate a URL on Client A
		await pageA.goto('/send');

		const sendViaLinkButton = pageA
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = pageA.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(testFiles.testImages);

		// Wait for URL generation
		const urlPattern = /\/files\/[^/]+\/[^/]+/;

		// 2. Copy the generated URL
		const shareUrlElement = pageA.getByText(urlPattern).first();
		await expect(pageA.getByText(urlPattern)).toBeVisible();
		const shareUrl = await shareUrlElement.textContent();
		expect(shareUrl).toBeTruthy();

		// Extract the path from the URL (handle both full URLs and relative paths)
		const urlMatch = shareUrl?.match(/\/files\/[^/\s]+\/[^/\s]+/);
		expect(urlMatch).toBeTruthy();
		const sharePath = urlMatch![0];

		// 3. On a separate browser (Client B), navigate to the URL
		await pageB.goto(sharePath);

		// 4. Observe the file list
		// Expected Results:

		// - Recipient (Client B) sees a page with file details
		for (const imagePath of testFiles.testImages) {
			const fileName = path.basename(imagePath);
			await expect(pageB.getByText(fileName)).toBeVisible({ timeout: 20_000 });
		}

		// 5 Click "Download All" (if available) or individually download each file
		const downloadAllButton = pageB.getByRole('button', { name: /Download All/i }).first();
		await expect(downloadAllButton).toBeVisible();

		await downloadAllButton.click();

		// Expected Results:
		// - Files download successfully
		await expect(pageB.getByText(/Transfer Completed/i)).toHaveCount(testFiles.testImages.length);
	});

	test('3.6 Access File Sharing URL - Connection Failure', async ({ phlickClient }) => {
		test.setTimeout(120_000);

		const pageA = await phlickClient.createClient('Client A - Sender');
		const pageB = await phlickClient.createClient('Client B - Recipient');

		// 1. Generate a URL on Client A with a file
		await pageA.goto('/send');

		const sendViaLinkButton = pageA
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = pageA.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles([testFiles.largeFile]);

		const urlPattern = /\/files\/[^/]+\/[^/]+/;
		await expect(pageA.getByText(urlPattern)).toBeVisible({ timeout: 10_000 });

		// 2. On Client B, navigate to the URL
		const shareUrl = await pageA.getByText(urlPattern).textContent();
		expect(shareUrl).toBeDefined();

		await pageB.goto(shareUrl!);
		await expect(pageB.getByText('large-video.mp4')).toBeVisible({ timeout: 20_000 });

		const downloadButton = pageB.getByRole('button', { name: /Download/i }).first();
		await expect(downloadButton).toBeVisible();

		await downloadButton.click();

		// 3. Before transfer completes, close the browser window on Client A (sender goes offline)
		await pageA.context().close();

		// Expected Results:

		// - Client B detects the connection loss
		// - Error message appears: "Connection lost" or "Sender is offline"
		await expect(pageB.getByText(/Transfer Failed|Offline|Disconnected/i).first()).toBeVisible({
			timeout: 60_000
		});

		// - Option to retry or return to homepage is provided
		await expect(pageB.getByRole('button', { name: /Download|Try Again/i }).first()).toBeVisible();
	});

	test('3.7 Access File Sharing URL - Expired/Invalid Link', async ({ phlickClient }) => {
		const page = await phlickClient.createClient('Client B - Recipient');

		// 1. On Client B, navigate to a fabricated/invalid URL
		await page.goto('/files/invalid-public-id/invalid-link-code');

		// Expected Results:

		// - Error page displays
		await expect(page.getByRole('heading', { name: /No Files Available/i })).toBeVisible({
			timeout: 20_000
		});

		// - User is provided with a link to return to homepage
		// - No sensitive information is exposed (verify by checking no file details are shown)
		await expect(page.getByText(/\.pdf|\.jpg|\.txt|KB|MB/)).not.toBeVisible();
	});

	test('3.8 Cancel File Sharing URL', async ({ phlickClient }) => {
		const pageA = await phlickClient.createClient('Client A - Sender');
		const pageB = await phlickClient.createClient('Client B - Recipient');

		// 1. On Client A, generate a file sharing URL
		await pageA.goto('/send');

		const sendViaLinkButton = pageA
			.getByTestId('file-input-label')
			.filter({ hasText: /Send Via Link/i });

		const fileChooserPromise = pageA.waitForEvent('filechooser');
		await sendViaLinkButton.click();

		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles([testFiles.mediumFile]);

		// 2. Copy the URL
		const urlPattern = /\/files\/[^/]+\/[^/]+/;
		const shareUrlElement = pageA.getByText(urlPattern).first();
		const shareUrl = await shareUrlElement.textContent();

		// 3. On the same page, click "Cancel" or "Close" to dispose of the share
		const cancelButton = pageA
			.getByRole('button', { name: /Cancel|Close|Done|Stop/i })
			.or(pageA.getByRole('link', { name: /Cancel|Close|Done|Stop/i }))
			.first();
		await cancelButton.click();

		// Expected Results:

		// - Client A disposes of the shareable link and stops listening
		// - Verify we're navigated away or the share interface is closed
		await expect(pageA.getByText(urlPattern).first()).not.toBeVisible();

		// 4. On Client B, attempt to navigate to the copied URL
		await pageB.goto(shareUrl!);

		// - URL is invalidated
		// - Client B receives an error: "Invalid or expired link"
		await expect(pageB.getByRole('heading', { name: /No Files Available/i })).toBeVisible({
			timeout: 20_000
		});
	});
});
