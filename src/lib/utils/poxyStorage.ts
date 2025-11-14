// A storage that does nothing, for convenience in non-browser environments.
export const poxyStorage: Storage = {
	get length() {
		return 0;
	},
	clear(): void {},
	getItem: () => null,
	key: () => null,
	removeItem(): void {},
	setItem(): void {}
};
