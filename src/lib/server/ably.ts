import * as Ably from 'ably';
import { env } from '$env/dynamic/private';

export const ablyClient = new Ably.Realtime({
	key: env.ABLY_API_KEY
});
