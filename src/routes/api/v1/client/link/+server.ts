import { json, error } from '@sveltejs/kit';
import { clientManager } from '$lib/server/clientManager';

import type { RequestHandler } from '../$types';

export const POST: RequestHandler = async ({ request }) => {
	const { privateId } = await request.json();
	if (!privateId) {
		return error(400);
	}

	const clientData = await clientManager.getClientByPrivateId(privateId);
	if (!clientData) {
		return error(403);
	}

	const linkCode = await clientManager.generateLinkCode(clientData.publicId);
	return json({ linkCode }, { status: 201 });
};
