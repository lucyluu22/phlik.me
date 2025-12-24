import { json, error } from '@sveltejs/kit';
import { clientManager } from '$lib/server/clientManager';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { linkCode } = await request.json();
	if (!linkCode || !/^[A-Z0-9]{4}$/.test(linkCode)) {
		return error(400);
	}

	const clientPublicId = await clientManager.resolveLinkCode(linkCode);
	if (!clientPublicId) {
		return error(404);
	}

	return json({ publicId: clientPublicId });
};
