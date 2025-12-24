import {
	MessageHandler,
	type MessagePacket,
	type MessageHandlerMiddleware
} from './MessageHandler';
import { FileTransfer } from './FileTransfer';
import { type FileStorage, IndexedDBFileStorage, PoxyFileStorage } from './FileStorage';
import { type PubSub, AblyPubSub } from './PubSub';
import { EventEmitter } from '$lib/utils/EventEmitter';
import { poxyStorage } from '$lib/utils/poxyStorage';

if (import.meta.hot) {
	import.meta.hot.accept();
}

export enum ClientMessageTypes {
	CONNECTION_REQUEST = 'CLIENT__CONNECTION_REQUEST',
	CONNECTION_RESPONSE = 'CLIENT__CONNECTION_RESPONSE',
	DISCONNECT = 'CLIENT__DISCONNECT',
	IDENTITY_REQUEST = 'CLIENT__IDENTITY_REQUEST',
	IDENTITY_RESPONSE = 'CLIENT__IDENTITY_RESPONSE'
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
 * Singleton representing a local phlik.me client running in the browser.
 */
export class LocalClient extends EventEmitter<LocalCLientEventMap> {
	private _storage: Storage;
	private _fetch: typeof globalThis.fetch;
	private _pubSub: PubSub;
	private _messageHandler: MessageHandler;
	private _fileTransfer: FileTransfer;
	private _fileStorage: FileStorage;
	private _authTokens: Set<string> = new Set();
	private _trustedClients: Set<string> = new Set();

	private readonly _privateIdKey: string = 'client.privateId';
	private readonly _publicIdKey: string = 'client.publicId';
	private readonly _nameKey: string = 'client.name';
	private readonly _connectionIdsKey: string = 'client.connectionPublicIds';
	private readonly _getConnectionKey: (publicId: string) => string = (publicId) =>
		`client.connection:${publicId}`;

	private async _subscribeToClientChannel() {
		return this._pubSub.subscribe(this.getPublicId()!, this.getPrivateId()!, (message) =>
			this._messageHandler.receive(message)
		);
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
		this._trustedClients.add(publicId);
		this.emit(LocalClientEvents.clientConnected, { publicId, name: data.name });
	}

	private _authenticateMessage: MessageHandlerMiddleware = (message, next) => {
		// If there's an authentication token, check it against ours
		if (message.authentication) {
			if (this._authTokens.has(message.authentication)) {
				return next();
			}
			console.warn(`Authentication token on message failed from client: ${message.clientId}`);
			return;
		}

		// Otherwise, check if it's a trusted client
		if (this._trustedClients.has(message.clientId)) {
			return next();
		}

		console.warn(`Authentication failed for message from client: ${message.clientId}`);
	};

	constructor({
		storage = globalThis.localStorage ?? poxyStorage,
		fetch = globalThis.fetch,
		pubSub = new AblyPubSub(),
		fileStorage = globalThis.indexedDB ? new IndexedDBFileStorage() : new PoxyFileStorage()
	}: {
		storage?: Storage;
		pubSub?: PubSub;
		fileStorage?: FileStorage;
		fetch?: typeof globalThis.fetch;
	} = {}) {
		super();

		this._storage = storage;
		this._fetch = fetch;
		this._pubSub = pubSub;
		this._messageHandler = new MessageHandler({
			send: (message) => this._pubSub.publish(message)
		});
		this._fileStorage = fileStorage;
		this._fileTransfer = new FileTransfer({
			messageHandler: this._messageHandler,
			authHandler: this._authenticateMessage.bind(this),
			fileStorage,
			storage
		});

		this._trustedClients = new Set(this._getConnectionIds());

		// Message handler for incoming connection requests
		this._messageHandler.handleMessage<ClientConnectionData>(
			ClientMessageTypes.CONNECTION_REQUEST,
			this._authenticateMessage.bind(this),
			(message) => {
				// Send connection response
				this._messageHandler.send({
					type: ClientMessageTypes.CONNECTION_RESPONSE,
					clientId: message.clientId,
					data: {
						name: this.getName()
					}
				});
				this._setClientConnection(message.clientId, message.data);
				this._authTokens.delete(message.authentication as string);
			}
		);

		// Message handler for identity requests
		this._messageHandler.handleMessage<ClientConnectionData>(
			ClientMessageTypes.IDENTITY_REQUEST,
			this._authenticateMessage.bind(this),
			(message) => {
				// Send identity response
				this._messageHandler.send<ClientConnectionData>({
					type: ClientMessageTypes.IDENTITY_RESPONSE,
					clientId: message.clientId,
					data: {
						name: this.getName()!
					}
				});
			}
		);

		// Message handler for disconnection notifications
		this._messageHandler.handleMessage(ClientMessageTypes.DISCONNECT, (message: MessagePacket) => {
			// When a client notifies us of disconnection, remove them from our connections too.
			this.disconnectClient(message.clientId, false);
		});

		if (this.isSetup()) {
			this._subscribeToClientChannel();
		}

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				this.destroy();
			});
		}
	}

	destroy(): void {
		this.removeAllListeners();
		this._fileTransfer.destroy();
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

	getFileTransfer(): FileTransfer {
		return this._fileTransfer;
	}

	getFileStorage(): FileStorage {
		return this._fileStorage;
	}

	isSetup(): boolean {
		return this.getName() !== null && this.getPrivateId() !== null && this.getPublicId() !== null;
	}

	/**
	 * Calls the ClientManager to create a new client and stores the returned public and private ID.
	 * @param name The name to assign to the new client.
	 */
	async setup(name: string = 'Anonymous Client'): Promise<void> {
		if (this.isSetup()) {
			console.warn('Attempt to call setup() on an already setup LocalClient');
			return;
		}

		const response = await this._fetch('/api/v1/client/create', {
			method: 'POST'
		});

		if (response.ok) {
			const clientData = await response.json();
			const { publicId, privateId } = clientData;

			this._storage.setItem(this._nameKey, name);
			this._storage.setItem(this._publicIdKey, publicId);
			this._storage.setItem(this._privateIdKey, privateId);
			this._storage.setItem(this._connectionIdsKey, JSON.stringify([]));

			await this._subscribeToClientChannel();
		} else {
			throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
		}
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
		this._authTokens.add(linkCode);
		return linkCode;
	}

	/**
	 * Calls the ClientManager to get the corresponding public ID for the given link code.
	 * Performs a connection request to the client with their link code as authentication.
	 * Then, stores the connection.
	 * @param linkCode The link code generated from another client.
	 */
	async connectClientFromLinkCode(linkCode: string): Promise<void> {
		if (this._authTokens.has(linkCode)) {
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
			this._authTokens.add(linkCode); // Add the link code for authentication on the response
			// Send connection request
			this._messageHandler.send<ClientConnectionData>({
				type: ClientMessageTypes.CONNECTION_REQUEST,
				clientId: publicId,
				authentication: linkCode,
				data: {
					name: this.getName()!
				}
			});
			const response = await this._messageHandler.waitForMessage<ClientConnectionData>(
				ClientMessageTypes.CONNECTION_RESPONSE,
				(message) => message.clientId === publicId
			);
			this._setClientConnection(publicId, response.data);
		} catch {
			throw new Error('Client connection handshake failed');
		} finally {
			// Always remove the link code after attempting connection
			this._authTokens.delete(linkCode);
		}
	}

	/**
	 * Sends an identity request to a remote client.
	 * @param publicId
	 * @param authToken
	 * @returns
	 */
	async identifyClient(publicId: string, authToken?: string): Promise<string> {
		// Send identity request
		this._messageHandler.send<undefined>({
			type: ClientMessageTypes.IDENTITY_REQUEST,
			clientId: publicId,
			authentication: authToken
		});

		const response = await this._messageHandler.waitForMessage<ClientConnectionData>(
			ClientMessageTypes.IDENTITY_RESPONSE,
			(message) => message.clientId === publicId
		);

		return response.data.name;
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
		this._trustedClients.delete(publicId);

		if (sendDisconnectMessage) {
			// Notify the client that we have disconnected them, so they can remove us from their connections too.
			this._messageHandler.send<undefined>({
				type: ClientMessageTypes.DISCONNECT,
				clientId: publicId
			});
		}
	}

	/**
	 * Generates a url path that can be used to share files from this client to anyone with the link.
	 * It consists of this client's public ID and a link code the receiver can use for authentication.
	 * @returns
	 */
	generatePublicURLPath(): string {
		const publicId = this.getPublicId();
		const linkCode = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
		this._authTokens.add(linkCode);
		return `${publicId}/${linkCode}`;
	}

	/**
	 * Disposes of a previously generated public URL path, invalidating its generated link code.
	 * @param path The public URL path generated by generatePublicURLPath().
	 */
	disposePublicURLPath(path: string): void {
		const [, linkCode] = path.split('/');
		this._authTokens.delete(linkCode);
	}
}

export const getLocalClient = (() => {
	let localClient: LocalClient | null = null;
	return () => {
		if (!localClient) {
			localClient = new LocalClient();
		}
		return localClient;
	};
})();
