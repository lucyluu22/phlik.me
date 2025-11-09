import { createContext } from 'svelte';

export interface LocalClientData {
	publicId: string;
	privateId: string;
	name: string;
}

// A storage that does nothing, for convenience in non-browser environments.
const poxyStorage: Storage = {
	get length() {
		return 0;
	},
	clear(): void {},
	getItem: () => null,
	key: () => null,
	removeItem(): void {},
	setItem(): void {}
};

/**
 * @class LocalClient
 * Represents a local phlick.me client running in the browser.
 */
export class LocalClient {
	private _storage: Storage;

	constructor(storage: Storage = globalThis.localStorage ?? poxyStorage) {
		this._storage = storage;
	}

	setName(name: string): void {
		this._storage.setItem('client.name', name);
	}

	getName(): string | null {
		return this._storage.getItem('client.name');
	}

	getPrivateId(): string | null {
		return this._storage.getItem('client.privateId');
	}

	getPublicId(): string | null {
		return this._storage.getItem('client.publicId');
	}

	isSetup(): boolean {
		return this.getPrivateId() !== null && this.getPublicId() !== null;
	}

	setup({ publicId, privateId, name }: LocalClientData): void {
		this._storage.setItem('client.name', name);
		this._storage.setItem('client.publicId', publicId);
		this._storage.setItem('client.privateId', privateId);
	}

	destroy(): void {
		this._storage.removeItem('client.name');
		this._storage.removeItem('client.publicId');
		this._storage.removeItem('client.privateId');
	}
}

export const [getLocalClient, setLocalClient] = createContext<LocalClient>();
