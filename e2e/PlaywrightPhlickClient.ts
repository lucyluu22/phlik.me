declare global {
	interface Window {
		_phlickLocalClient: import('../src/lib/models/LocalClient').LocalClient;
	}
}

import { Browser, BrowserContext, Page } from '@playwright/test';

export class PlaywrightPhlickClient {
	private browser: Browser;
	private contexts: BrowserContext[] = [];

	constructor(browser: Browser) {
		this.browser = browser;
	}

	async createClient(clientName: string): Promise<Page> {
		const context = await this.browser.newContext();
		this.contexts.push(context);
		const page = await context.newPage();
		await page.goto('/');
		await page.evaluate(async (name) => {
			const waitForClient = () => {
				return new Promise<void>((resolve) => {
					const checkClient = () => {
						if (window._phlickLocalClient) {
							resolve();
						} else {
							setTimeout(checkClient, 50);
						}
					};
					checkClient();
				});
			};
			await waitForClient();
			await window._phlickLocalClient.setup(name);
		}, clientName);
		await page.goto('/');
		return page;
	}

	async generateLinkCode(page: Page) {
		return page.evaluate(() => {
			return window._phlickLocalClient.generateLinkCode();
		});
	}

	async connectClientFromLinkCode(page: Page, linkCode: string) {
		return page.evaluate(async (code) => {
			await window._phlickLocalClient.connectClientFromLinkCode(code);
		}, linkCode);
	}

	async closeContexts() {
		for (const context of this.contexts) {
			await context.close();
		}
		this.contexts = [];
	}
}
