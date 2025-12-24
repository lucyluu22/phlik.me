import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		url: 'http://localhost:4173',
		command: 'npm run build && npm run preview'
	},
	use: {
		baseURL: 'http://localhost:4173'
	},
	testDir: 'e2e'
});
