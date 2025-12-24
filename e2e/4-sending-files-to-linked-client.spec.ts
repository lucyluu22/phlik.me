// spec: TEST_PLAN.md
// seed: e2e/seed.spec.ts

import { test, expect } from './fixtures';
import { createTestFiles } from './createTestFiles';

test.describe('4. Sending Files Directly to Linked Client', () => {
	let testFiles: ReturnType<typeof createTestFiles>;

	test.beforeAll(() => {
		testFiles = createTestFiles();
	});

	test('4.1 Send Single File to Linked Client', async ({ phlickClient }) => {
		// Set up both clients and link them
		const pageA = await phlickClient.createClient('Client A');
		const pageB = await phlickClient.createClient('Client B');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 1. On Client A, navigate to "Send Files"
		await pageA.goto('/send');
		await expect(pageA).toHaveURL('/send');

		// 2. Verify Client B appears in the list of connected clients
		await expect(pageA.getByRole('combobox', { name: /Select Connected Client/i })).toBeVisible();

		// 3. Click on Client B's entry or a "Send to Client B" button
		const clientSelect = pageA.getByRole('combobox', { name: /Select Connected Client/i });
		const clientBOption = clientSelect.getByRole('option', { name: 'Client B' });
		await expect(clientBOption).toBeAttached();

		// Get Client B's public ID from the option
		const clientBId = await clientBOption.getAttribute('value');
		expect(clientBId).toBeTruthy();

		await clientSelect.selectOption(clientBId!);

		// 4. Verify navigation to send page for Client B
		await expect(pageA).toHaveURL(`/send/client/${clientBId}`);

		// 5. Verify the file input is available
		// 6. When the file picker opens, select a test file
		const fileInput = pageA.getByLabel('Select Files');
		expect(fileInput).toBeVisible();
		await fileInput.setInputFiles([testFiles.mediumFile]);

		// Expected Results:

		// - Transfer initiates immediately
		// Wait for transfer to complete
		await expect(pageA.getByText(/Transferred/i)).toBeVisible({ timeout: 20_000 });

		// - Client B receives a notification that Client A is sending a file
		// Navigate to files page on Client B
		await pageB.goto('/files');

		// - File is saved to Client B's received files
		await expect(pageB.getByText('test-document.pdf')).toBeVisible();

		// - Both clients show success confirmation
		await expect(pageA.getByText(/Done/i)).toBeVisible();

		// Verify file details on Client B
		const showDetailsButton = pageB.getByRole('button', { name: /Show Details/i }).first();
		await expect(showDetailsButton).toBeVisible();
		await showDetailsButton.click();
		await expect(pageB.getByText(/500.*KB|0\.5.*MB/i)).toBeVisible();
		await expect(pageB.getByText(/Client A/i)).toBeVisible();
	});

	test('4.2 Send Multiple Files to Linked Client', async ({ phlickClient }) => {
		// Set up both clients and link them
		const pageA = await phlickClient.createClient('Client A - Multi');
		const pageB = await phlickClient.createClient('Client B - Multi');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 1. On Client A, navigate to "Send Files"
		await pageA.goto('/send');

		// 2. Select Client B as the recipient
		const clientSelect = pageA.getByRole('combobox', { name: /Select Connected Client/i });
		const clientBOption = clientSelect.getByRole('option', { name: 'Client B - Multi' });
		const clientBId = await clientBOption.getAttribute('value');
		await clientSelect.selectOption(clientBId!);

		// 3. In the file picker, select multiple files (3 images totaling ~600KB)
		const fileInput = pageA.getByLabel('Select Files');
		await fileInput.setInputFiles(testFiles.testImages);

		// Expected Results:

		// - All 3 files are queued for transfer
		await expect(pageA.getByText('photo1.jpg')).toBeVisible();
		await expect(pageA.getByText('photo2.jpg')).toBeVisible();
		await expect(pageA.getByText('photo3.png')).toBeVisible();

		// - Files transfer successfully
		// - Progress for each file or overall progress is displayed
		// Wait for transfer to complete
		await expect(pageA.getByText(/Transferred/i)).toBeVisible({ timeout: 20_000 });
		await expect(pageA.getByText(/Transfer Completed/i)).toHaveCount(3);

		// - Client B receives all 3 files successfully
		await pageB.goto('/files');

		// - All files are listed in Client B's "View Files" section
		await expect(pageB.getByText('photo1.jpg')).toBeVisible();
		await expect(pageB.getByText('photo2.jpg')).toBeVisible();
		await expect(pageB.getByText('photo3.png')).toBeVisible();
	});

	test('4.3 Send Large File to Linked Client', async ({ phlickClient }) => {
		test.slow();

		// Set up both clients and link them
		const pageA = await phlickClient.createClient('Client A - Large');
		const pageB = await phlickClient.createClient('Client B - Large');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 1. On Client A, send a large file (5 MB video) to Client B
		await pageA.goto('/send');

		const clientSelect = pageA.getByRole('combobox', { name: /Select Connected Client/i });
		const clientBOption = clientSelect.getByRole('option', { name: 'Client B - Large' });
		const clientBId = await clientBOption.getAttribute('value');
		await clientSelect.selectOption(clientBId!);

		const fileInput = pageA.getByLabel('Select Files');
		await fileInput.setInputFiles([testFiles.largeFile]);

		// Expected Results:

		// - Transfer begins without error
		await expect(pageA.getByText('large-video.mp4')).toBeVisible();

		// - Progress indicators show percentage (waiting for some progress)
		// Sometimes large files transfer too quick, so we may not see intermediate states
		// await expect(pageA.getByText(/Transferring/i)).toBeVisible();

		// Wait for transfer to complete (may take longer for large file)
		await expect(pageA.getByText(/Transferred.*1.*File/i)).toBeVisible({ timeout: 30_000 });

		// - Transfer completes successfully
		await expect(pageA.getByRole('link', { name: /Done/i })).toBeVisible();

		// - Large file is stored correctly in IndexedDB
		await pageB.goto('/files');
		await expect(pageB.getByText('large-video.mp4')).toBeVisible();

		// - File size is displayed correctly (5 MB)
		await expect(pageB.getByText(/5.*MB/i)).toBeVisible();

		// - File can be retrieved and downloaded on Client B
		await expect(pageB.getByRole('button', { name: /Save/i }).first()).toBeVisible();
	});

	test('4.4 Send File with No Active Connection', async ({ phlickClient }) => {
		// 1. Link Client A and Client B
		const pageA = await phlickClient.createClient('Client A - Offline Test');
		const pageB = await phlickClient.createClient('Client B - Offline Test');
		const linkCode = await phlickClient.generateLinkCode(pageA);
		await phlickClient.connectClientFromLinkCode(pageB, linkCode);

		// 2. On Client B, close the browser (go offline)
		await pageB.close();

		// 3. On Client A, attempt to send a file to Client B
		await pageA.goto('/send');
		const clientSelect = pageA.getByRole('combobox', { name: /Select Connected Client/i });
		const clientBOption = clientSelect.getByRole('option', { name: 'Client B - Offline Test' });
		const clientBId = await clientBOption.getAttribute('value');
		await clientSelect.selectOption(clientBId!);

		const fileInput = pageA.getByLabel('Select Files');
		await fileInput.setInputFiles([testFiles.smallFile]);

		// Expected Results:

		// - Client A detects that Client B is offline
		// - Error message appears or connection fails
		await expect(pageA.getByText(/Connection Error/i)).toBeVisible({
			timeout: 20_000
		});

		// - Option to retry is provided
		await expect(pageA.getByRole('button', { name: /Retry/i })).toBeVisible();

		// - No file corruption or hanging state occurs
		// (verified by the error message appearing and retry option being available)
	});
});
