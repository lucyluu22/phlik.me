import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import { env } from '$env/dynamic/private';

type DbClient = RedisClientType;

declare global {
	// attach to globalThis to survive function cold starts in serverless Node
	var __dbClient: DbClient | undefined;
}

export async function connect(): Promise<DbClient> {
	if (globalThis.__dbClient) return globalThis.__dbClient;
	const client = await createClient({
		RESP: 2,
		url: env.REDIS_URL
	}).connect();
	globalThis.__dbClient = client;
	return client;
}
