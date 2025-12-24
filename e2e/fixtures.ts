import { test as base } from '@playwright/test';
import { PlaywrightPhlickClient } from './PlaywrightPhlickClient';

export interface PhlickMeTestFixtures {
	phlickClient: PlaywrightPhlickClient;
}

export const test = base.extend<PhlickMeTestFixtures>({
	phlickClient: async ({ browser }, run) => {
		const phlickClient = new PlaywrightPhlickClient(browser);
		await run(phlickClient);
		await phlickClient.closeContexts();
	}
});

export { expect } from '@playwright/test';
