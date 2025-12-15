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
	resolveLinkCode(linkCode: string): Promise<string | null>;
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

	/**
	 * Generate a new public/private ID pair and store it in a redis hashmap.
	 * If we *really* wanted to be secure we could store a hash of the private ID,
	 * but it's overkill for this use case.
	 * @returns
	 */
	async createClient(): Promise<ClientData> {
		const [privateId, publicId] = [
			Array.from(crypto.getRandomValues(new Uint8Array(32)))
				.map((a) => a.toString(36))
				.join(''),
			crypto.randomUUID()
		];

		await this._redis.hSet(`client:${privateId}`, {
			publicId
		});

		return { privateId, publicId };
	}

	async getClientByPrivateId(privateId: string): Promise<ClientData | null> {
		const publicId = await this._redis.hGet(`client:${privateId}`, 'publicId');
		if (!publicId) return null;
		return {
			privateId,
			publicId
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

	async resolveLinkCode(linkCode: string): Promise<string | null> {
		const publicId = await this._redis.getDel(`linkcode:${linkCode}`);
		if (!publicId) return null;
		return publicId;
	}
}
