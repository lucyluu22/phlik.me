import * as Ably from 'Ably';
import { env } from '$env/dynamic/private';

export const ablyClient = new Ably.Realtime({
	key: env.ABLY_API_KEY
});
