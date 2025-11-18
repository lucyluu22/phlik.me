import { EventEmitter } from '$lib/utils/EventEmitter';

export enum MessageType {
	CONNECTION_REQUEST = 'CONNECTION_REQUEST',
	CONNECTION_RESPONSE = 'CONNECTION_RESPONSE',
	DISCONNECT = 'DISCONNECT'
}

export interface MessagePacket {
	type: MessageType;
	clientId: string; // Either sender or target client ID
	authentication?: string; // Optional authentication code for certain message types
	data?: Record<string, unknown>;
}

type SendHandler = (message: MessagePacket) => void;
type IdentifyHandler = () => string;
type AuthenticateHandler = (message: MessagePacket) => boolean;

type ClientMessageHandlerEventMap = {
	message: [MessagePacket];
} & {
	[K in MessageType as `message:${K}`]: [MessagePacket];
};

export class ClientMessageHandler extends EventEmitter<ClientMessageHandlerEventMap> {
	send: SendHandler;
	identify: IdentifyHandler;
	authenticate: AuthenticateHandler;

	private _waitForMessage(
		type: MessageType,
		filter: (message: MessagePacket) => boolean = () => true,
		timeout: number = 10_000
	): Promise<MessagePacket> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.off(`message:${type}`, listener);
				reject(new Error('Message wait timed out'));
			}, timeout);

			const listener = (message: MessagePacket) => {
				if (message.type === type && filter(message)) {
					this.off(`message:${type}`, listener);
					clearTimeout(timer);
					resolve(message);
				}
			};

			this.on(`message:${type}`, listener);
		});
	}

	private _handleConnectionRequest(message: MessagePacket) {
		const response: MessagePacket = {
			type: MessageType.CONNECTION_RESPONSE,
			clientId: message.clientId,
			// echo back the authentication token
			authentication: message.authentication,
			data: {
				name: this.identify()
			}
		};

		this.send(response);
	}

	constructor({
		send = () => console.warn('Message sent into the void!'),
		identify = () => '',
		authenticate = () => false
	}: {
		send?: SendHandler;
		identify?: IdentifyHandler;
		authenticate?: AuthenticateHandler;
	}) {
		super();

		this.send = send;
		this.identify = identify;
		this.authenticate = authenticate;

		this.onMessage(MessageType.CONNECTION_REQUEST, this._handleConnectionRequest.bind(this));
	}

	onMessage(type: MessageType, handler: (message: MessagePacket) => void) {
		this.on(`message:${type}`, handler);
	}

	receive(message: MessagePacket) {
		if (!this.authenticate(message)) {
			// if auth fails we just drop the request silently (prevent sniffing)
			console.warn(`Authentication failed for message from client: ${message.clientId}`);
			return;
		}

		this.emit('message', message);
		this.emit(`message:${message.type}`, message);
	}

	/**
	 * Sends a CONNECTION request to the specified client and waits for a response from them.
	 * @param targetClientId The ID of the client to query.
	 * @param authToken Authentication token.
	 */
	async connectionHandshake(targetClientId: string, authToken: string): Promise<string> {
		const request: MessagePacket = {
			type: MessageType.CONNECTION_REQUEST,
			clientId: targetClientId,
			authentication: authToken,
			data: {
				name: this.identify()
			}
		};

		this.send(request);
		const response = await this._waitForMessage(
			MessageType.CONNECTION_RESPONSE,
			(message) => message.clientId === targetClientId
		);

		return response.data?.name as string;
	}
}
