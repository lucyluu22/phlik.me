import crypto from 'crypto';
import { json, error } from '@sveltejs/kit';
import { clientManager } from '$lib/server/clientManager';
import { ablyClient } from '$lib/server/ably';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const privateId = formData.get('privateId');

	if (privateId == null || typeof privateId !== 'string') {
		return error(401);
	}

	const clientData = await clientManager.getClientByPrivateId(privateId);
	if (!clientData) {
		return error(403);
	}

	const tokenRequest = await ablyClient.auth.createTokenRequest({
		clientId: clientData.publicId,
		capability: {
			// Client can only listen on their channel
			[`client:${clientData.publicId}`]: ['subscribe'],
			// Client may publish to any client it knows about
			'client:*': ['publish']
		},
		nonce: crypto.randomBytes(8).toString('hex'),
		timestamp: new Date().getTime()
	});

	return json(tokenRequest);
};
