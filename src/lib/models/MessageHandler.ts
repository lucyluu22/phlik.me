import { EventEmitter } from '$lib/utils/EventEmitter';

export type MessagePacket<Data = unknown> = {
	type: string;
	clientId: string; // Either sender or target public ID
	authentication?: string; // Optional authentication code for certain message types
} & ([Data] extends [undefined] ? { data?: never } : { data: Data });

export type SendHandler = (message: MessagePacket) => void;
export type MessageHandlerMiddleware<Data = unknown> = (
	message: MessagePacket<Data>,
	next: () => void
) => void;

type ClientMessageHandlerEventMap = {
	message: [MessagePacket];
} & {
	[K in `message:${string}`]: [MessagePacket];
};

/**
 * @class MessageHandler
 * Low level handler abstraction for client messages, providing sending, receiving, and event handling.
 */
export class MessageHandler extends EventEmitter<ClientMessageHandlerEventMap> {
	private _sendHandler: SendHandler;

	constructor({ send = () => console.warn('Message sent into the void!') }: { send: SendHandler }) {
		super();

		this._sendHandler = send;
	}

	send<Data>(message: MessagePacket<Data>) {
		// Ensure send is always async since it can be called before waitForMessage()
		setTimeout(() => this._sendHandler(message as MessagePacket), 0);
	}

	handleMessage<Data>(type: string, ...handlers: MessageHandlerMiddleware<Data>[]) {
		this.on(`message:${type}`, (message) => {
			// middleware chain
			let index = -1;
			const next = () => {
				index++;
				if (index < handlers.length) {
					handlers[index](message as MessagePacket<Data>, next);
				}
			};
			next();
		});
	}

	receive(message: MessagePacket) {
		this.emit('message', message);
		this.emit(`message:${message.type}`, message);
	}

	waitForMessage<Data = unknown>(
		type: string,
		filter: (message: MessagePacket<Data>) => boolean = () => true,
		timeout: number = 10_000
	): Promise<MessagePacket<Data>> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.off(`message:${type}`, listener);
				reject(new Error('Message wait timed out'));
			}, timeout);

			const listener = (message: MessagePacket) => {
				if (message.type === type && filter(message as MessagePacket<Data>)) {
					this.off(`message:${type}`, listener);
					clearTimeout(timer);
					resolve(message as MessagePacket<Data>);
				}
			};

			this.on(`message:${type}`, listener);
		});
	}
}
