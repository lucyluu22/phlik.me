import crypto from 'crypto';
import { type RedisClientType } from 'redis';

export interface ClientData {
	privateId: string; // Private ID is known only to the specific client (akin to a password)
	publicId: string; // Public ID can be shared with other clients (akin to a username)
}

export interface ClientManager {
	createClient(): Promise<ClientData>;
	getClientByPrivateId(privateId: string): Promise<ClientData | null>;
	generateLinkCode(publicId: string, expiry?: number): Promise<string>;
}

/**
 * @class RedisClientManager
 * Manages clients using a Redis DB.
 * @implements ClientManager
 */
export class RedisClientManager implements ClientManager {
	private _redis: RedisClientType;
	constructor(redisClient: RedisClientType) {
		this._redis = redisClient;
	}

	async createClient(): Promise<ClientData> {
		const [privateId, publicId] = [crypto.randomUUID(), crypto.randomUUID()];

		await this._redis.hSet(`client:${privateId}`, {
			publicId
		});

		return { privateId, publicId };
	}

	async getClientByPrivateId(privateId: string): Promise<ClientData | null> {
		const clientData = await this._redis.hGetAll(`client:${privateId}`);
		if (!clientData) return null;
		return {
			privateId,
			publicId: clientData.publicId
		};
	}

	async generateLinkCode(publicId: string, expiry = 10 * 60): Promise<string> {
		const linkCode = crypto.randomBytes(2).toString('hex').toUpperCase().replace(/0/g, 'G');
		await this._redis.set(`linkcode:${linkCode}`, publicId, {
			expiration: {
				type: 'EX',
				value: expiry
			}
		});
		return linkCode;
	}
}
