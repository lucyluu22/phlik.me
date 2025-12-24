import * as Ably from 'Ably';
import type { MessagePacket } from './MessageHandler';

export interface PubSub {
	publish(message: MessagePacket): Promise<void>;
	// Client subscribes to their public ID channel using their private ID for authentication
	subscribe(
		publicId: string,
		privateId: string,
		listener: (message: MessagePacket) => void
	): Promise<void>;
}

/**
 * @class AblyPubSub
 * PubSub implementation using Ably Realtime.
 */
export class AblyPubSub implements PubSub {
	private _authUrl: string;
	private _ablyClient?: Ably.Realtime;

	private _createAblyClient(privateId: string) {
		return new Ably.Realtime({
			authUrl: this._authUrl,
			authMethod: 'POST',
			authParams: {
				privateId
			}
		});
	}

	constructor({ authUrl = '/api/v1/ably/auth' }: { authUrl?: string } = {}) {
		this._authUrl = authUrl;
	}

	async subscribe(
		publicId: string,
		privateId: string,
		listener: (message: MessagePacket) => void
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (!this._ablyClient) {
				this._ablyClient = this._createAblyClient(privateId);
			}

			this._ablyClient.channels.get(`client:${publicId}`).subscribe((message) => {
				listener({
					type: message.name!,
					clientId: message.clientId!,
					authentication: message.data?.authentication,
					data: message.data?.messagePacketData
				});
			});

			this._ablyClient.connection.once('failed', (err) => {
				reject(new Error(`Ably connection failed: ${err.reason}`));
			});

			this._ablyClient.connection.once('connected', () => {
				resolve();
			});
		});
	}

	async publish(message: MessagePacket): Promise<void> {
		if (!this._ablyClient) {
			throw new Error('Ably is not initialized for this client. Call subscribe() first.');
		}

		const channel = this._ablyClient.channels.get(`client:${message.clientId}`);
		channel.publish({
			name: message.type,
			data: {
				authentication: message.authentication,
				messagePacketData: message.data
			}
		});
	}
}
