import path from 'path';
import fs from 'fs';

/**
 * Helper function to create test files in a temporary directory
 */
export function createTestFiles() {
	const testDir = path.join(import.meta.dirname, '_artifacts', 'test-files');

	// Create directory if it doesn't exist
	if (!fs.existsSync(testDir)) {
		fs.mkdirSync(testDir, { recursive: true });
	}

	// Create small test file (10 KB)
	const smallFile = path.join(testDir, 'test-doc.txt');
	if (!fs.existsSync(smallFile)) {
		fs.writeFileSync(smallFile, 'A'.repeat(10 * 1024));
	}

	// Create medium test file (500 KB)
	const mediumFile = path.join(testDir, 'test-document.pdf');
	if (!fs.existsSync(mediumFile)) {
		fs.writeFileSync(mediumFile, Buffer.alloc(500 * 1024, 'B'));
	}

	// Create test images
	const testImages = [
		path.join(testDir, 'photo1.jpg'),
		path.join(testDir, 'photo2.jpg'),
		path.join(testDir, 'photo3.png')
	];

	testImages.forEach((imagePath, index) => {
		if (!fs.existsSync(imagePath)) {
			// Create simple test image files
			fs.writeFileSync(imagePath, Buffer.alloc(1024 * 100 * (index + 1), index));
		}
	});

	// Create large test file (5 MB - using smaller size for faster tests)
	const largeFile = path.join(testDir, 'large-video.mp4');
	if (!fs.existsSync(largeFile)) {
		fs.writeFileSync(largeFile, Buffer.alloc(5 * 1024 * 1024, 'L'));
	}

	return {
		smallFile,
		mediumFile,
		testImages,
		largeFile
	};
}
