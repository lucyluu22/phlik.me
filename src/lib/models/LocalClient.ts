import { createContext } from 'svelte';
import * as Ably from 'Ably';
import { ClientMessageHandler, MessageType, type MessagePacket } from './ClientMessageHandler';
import { EventEmitter } from '$lib/utils/EventEmitter';
import { poxyStorage } from '$lib/utils/poxyStorage';

export interface LocalClientData {
	publicId: string;
	privateId: string;
	name: string;
}

export interface ClientConnectionData {
	name: string;
}

export enum LocalClientEvents {
	clientConnected = 'clientConnected'
}

type LocalCLientEventMap = {
	[LocalClientEvents.clientConnected]: [{ publicId: string; name: string }];
};

/**
 * @class LocalClient
 * Represents a local phlick.me client running in the browser.
 */
export class LocalClient extends EventEmitter<LocalCLientEventMap> {
	private _storage: Storage;
	private _fetch: typeof globalThis.fetch;
	private _AblySDK: typeof Ably;
	private _ablyAuthURL: string;
	private _messageHandler: ClientMessageHandler;
	private _linkCodes: Set<string> = new Set();

	private readonly _privateIdKey: string = 'client.privateId';
	private readonly _publicIdKey: string = 'client.publicId';
	private readonly _nameKey: string = 'client.name';
	private readonly _connectionIdsKey: string = 'client.connectionPublicIds';
	private readonly _getConnectionKey: (publicId: string) => string = (publicId) =>
		`client.connection:${publicId}`;

	private _ablyClient?: Ably.Realtime;

	private _setupAblyClient() {
		if (!this._ablyClient) {
			if (!this.isSetup()) {
				throw new Error('Cannot setup Ably client before LocalClient is setup');
			}

			this._ablyClient = new this._AblySDK.Realtime({
				authUrl: this._ablyAuthURL,
				authMethod: 'POST',
				authParams: {
					privateId: this.getPrivateId()!
				}
			});

			// Subscribe to incoming messages on this client's channel
			this._ablyClient.channels.get(`client:${this.getPublicId()}`).subscribe((message) => {
				this._messageHandler.receive({
					type: message.name,
					clientId: message.clientId,
					authentication: message.data?.authentication,
					data: message.data?.messagePacketData
				} as MessagePacket);
			});
		}
	}

	private _getConnectionIds(): string[] {
		return JSON.parse(this._storage.getItem(this._connectionIdsKey) || '[]');
	}

	private _setClientConnection(publicId: string, data: ClientConnectionData): void {
		const connectionIds = this._getConnectionIds();
		if (!connectionIds.includes(publicId)) {
			connectionIds.unshift(publicId);
			this._storage.setItem(this._connectionIdsKey, JSON.stringify(connectionIds));
		}
		this._storage.setItem(this._getConnectionKey(publicId), JSON.stringify(data));
		this.emit(LocalClientEvents.clientConnected, { publicId, name: data.name });
	}

	private _sendMessage = (message: MessagePacket): void => {
		if (!this._ablyClient) {
			console.warn('Attempted to send message before Ably client is setup');
			return;
		}

		// Publish the message to the target client's channel
		const channel = this._ablyClient.channels.get(`client:${message.clientId}`);
		channel.publish(message.type, {
			authentication: message.authentication,
			messagePacketData: message.data
		});
	};

	private _authenticateMessage = (message: MessagePacket): boolean => {
		// If there's an authentication token, check it against our link codes
		if (message.authentication && this._linkCodes.has(message.authentication)) {
			return true;
		}

		// Otherwise, check if it's a trusted client
		const clientConnection = this.getConnection(message.clientId);
		if (clientConnection) {
			return true;
		}

		return false;
	};

	constructor(
		storage: Storage = globalThis.localStorage ?? poxyStorage,
		fetch: typeof globalThis.fetch = globalThis.fetch,
		ablyAuthUrl: string = '/api/v1/ably/auth',
		ablySDK: typeof Ably = Ably
	) {
		super();

		this._storage = storage;
		this._fetch = fetch;
		this._AblySDK = ablySDK;
		this._ablyAuthURL = ablyAuthUrl;
		this._messageHandler = new ClientMessageHandler({
			identify: () => this.getName() || 'UNKNOWN',
			authenticate: this._authenticateMessage.bind(this),
			send: this._sendMessage.bind(this)
		});

		// Whenever we receive an authenticated connection request,
		// store the client connection and remove the link code used for authentication.
		this._messageHandler.onMessage(MessageType.CONNECTION_REQUEST, (message: MessagePacket) => {
			this._setClientConnection(message.clientId, { name: message.data?.name as string });
			this._linkCodes.delete(message.authentication as string);
		});

		// When a client notifies us of disconnection, remove them from our connections too.
		this._messageHandler.onMessage(MessageType.DISCONNECT, (message: MessagePacket) => {
			this.disconnectClient(message.clientId, false);
		});

		if (this.isSetup()) {
			this._setupAblyClient();
		}

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				console.log('Disposing LocalClient Ably connection due to HMR');
				this._ablyClient?.close();
			});
		}
	}

	setName(name: string): void {
		this._storage.setItem(this._nameKey, name);
	}

	getName(): string | null {
		return this._storage.getItem(this._nameKey);
	}

	getPrivateId(): string | null {
		return this._storage.getItem(this._privateIdKey);
	}

	getPublicId(): string | null {
		return this._storage.getItem(this._publicIdKey);
	}

	isSetup(): boolean {
		return this.getName() !== null && this.getPrivateId() !== null && this.getPublicId() !== null;
	}

	setup({ publicId, privateId, name }: LocalClientData): void {
		this._storage.setItem(this._nameKey, name);
		this._storage.setItem(this._publicIdKey, publicId);
		this._storage.setItem(this._privateIdKey, privateId);
		this._storage.setItem(this._connectionIdsKey, JSON.stringify([]));

		this._setupAblyClient();
	}

	destroy(): void {
		for (let i = 0; i < this._storage.length; i++) {
			const key = this._storage.key(i);
			if (key && key.startsWith('client.')) {
				this._storage.removeItem(key);
			}
		}

		this._ablyClient?.close();
		this._ablyClient = undefined;
	}

	/**
	 * Calls the ClientManager to generate a new link code for this client.
	 * The link code is stored for authenticating an eventual connection request.
	 * @returns The generated link code.
	 */
	async generateLinkCode(): Promise<string> {
		const response = await this._fetch('/api/v1/client/link', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				privateId: this.getPrivateId()
			})
		});

		if (!response.ok) {
			throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
		}

		const linkCode = (await response.json()).linkCode;
		this._linkCodes.add(linkCode);
		return linkCode;
	}

	/**
	 * Calls the ClientManager to get the corresponding public ID for the given link code.
	 * Performs a connection request to the client with their link code as authentication.
	 * Then, stores the connection.
	 * @param linkCode The link code generated from another client.
	 */
	async connectClientFromLinkCode(linkCode: string): Promise<void> {
		if (this._linkCodes.has(linkCode)) {
			throw new Error('You cannot connect with your own link code!');
		}

		const response = await this._fetch('/api/v1/client/connect', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				linkCode
			})
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('Invalid or expired link code');
			} else {
				throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
			}
		}

		const { publicId } = await response.json();

		// Sanity check in case client still somehow connects to themselves
		if (publicId === this.getPublicId()) {
			throw new Error('You cannot connect with your own link code!');
		}

		try {
			this._linkCodes.add(linkCode); // Add the link code for authentication on the response
			const clientName = await this._messageHandler.connectionHandshake(publicId, linkCode);
			this._setClientConnection(publicId, { name: clientName });
		} catch {
			throw new Error('Client connection handshake failed');
		} finally {
			// Always remove the link code after attempting connection
			this._linkCodes.delete(linkCode);
		}
	}

	getConnections(): ({ publicId: string } & ClientConnectionData)[] {
		return this._getConnectionIds().map((publicId) => {
			const connection = this.getConnection(publicId)!;
			return {
				publicId,
				...connection
			};
		});
	}

	getConnection(publicId: string): ClientConnectionData | null {
		const connectionsJSON = this._storage.getItem(this._getConnectionKey(publicId));
		if (connectionsJSON) {
			return JSON.parse(connectionsJSON) as ClientConnectionData;
		}
		return null;
	}

	updateConnectionName(publicId: string, name: string): void {
		const connection = this.getConnection(publicId);
		if (connection) {
			connection.name = name;
			this._storage.setItem(this._getConnectionKey(publicId), JSON.stringify(connection));
		} else {
			throw new Error('No such connection to update');
		}
	}

	disconnectClient(publicId: string, sendDisconnectMessage: boolean = true): void {
		const connectionIds = this._getConnectionIds().filter((id) => id !== publicId);
		this._storage.setItem(this._connectionIdsKey, JSON.stringify(connectionIds));
		this._storage.removeItem(this._getConnectionKey(publicId));

		if (sendDisconnectMessage) {
			// Notify the client that we have disconnected them, so they can remove us from their connections too.
			this._messageHandler.send({
				type: MessageType.DISCONNECT,
				clientId: publicId
			});
		}
	}
}

export const [getLocalClient, setLocalClient] = createContext<LocalClient>();
