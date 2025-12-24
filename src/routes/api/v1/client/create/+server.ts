import { json } from '@sveltejs/kit';
import { clientManager } from '$lib/server/clientManager';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	const clientData = await clientManager.createClient();
	return json(clientData, { status: 201 });
};
