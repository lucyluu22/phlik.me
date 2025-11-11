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
	private readonly _privateIdKey: string = 'client.privateId';
	private readonly _publicIdKey: string = 'client.publicId';
	private readonly _nameKey: string = 'client.name';

	constructor(storage: Storage = globalThis.localStorage ?? poxyStorage) {
		this._storage = storage;
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
		return this.getPrivateId() !== null && this.getPublicId() !== null;
	}

	setup({ publicId, privateId, name }: LocalClientData): void {
		this._storage.setItem(this._nameKey, name);
		this._storage.setItem(this._publicIdKey, publicId);
		this._storage.setItem(this._privateIdKey, privateId);
	}

	destroy(): void {
		this._storage.removeItem(this._nameKey);
		this._storage.removeItem(this._publicIdKey);
		this._storage.removeItem(this._privateIdKey);
	}
}

export const [getLocalClient, setLocalClient] = createContext<LocalClient>();
