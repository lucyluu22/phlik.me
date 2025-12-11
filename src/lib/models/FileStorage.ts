export interface FileMetaData {
	name: string;
	size: number;
	type: string;
	createdAt: number;
	clientId: string;
	transferred: boolean;
}

/**
 * @interface FileStorage
 * @description
 * Persisted file storage for clients.
 */
export interface FileStorage {
	createFiles(
		data: Pick<FileMetaData, 'name' | 'size' | 'type' | 'createdAt' | 'clientId'>[]
	): Promise<{ fileIds: string[] }>;
	listFiles(): Promise<(FileMetaData & { fileId: string })[]>;
	writeFileData(fileId: string): WritableStream<ArrayBuffer>;
	readFileData(fileId: string): ReadableStream<ArrayBuffer> | null;
	deleteFiles(fileIds: string[]): Promise<void>;
}

/**
 * @class PoxyFileStorage
 * @implements FileStorage
 * @description
 * A no-op FileStorage implementation for convenience in environments without IndexedDB (i.e. the server).
 */
export class PoxyFileStorage implements FileStorage {
	async createFiles() {
		return { fileIds: [''] };
	}
	async listFiles() {
		return [];
	}
	writeFileData() {
		return new WritableStream<ArrayBuffer>();
	}
	readFileData() {
		return null;
	}
	async deleteFiles() {
		return;
	}
}

/**
 * @class IndexedDBFileStorage
 * @implements FileStorage
 * @description
 * Implements FileStorage using IndexedDB, optimized for large files.
 */
export class IndexedDBFileStorage implements FileStorage {
	private _dbName: string;
	private _metaStoreName: string;
	private _dataStoreName: string;

	// Size threshold to commit chunks to IndexedDB
	private readonly CHUNK_COMMIT_THRESHOLD = 256 * 1024; // 256KB

	constructor(
		dbName: string = 'files',
		metaStoreName: string = 'meta',
		dataStoreName: string = 'data'
	) {
		this._dbName = dbName;
		this._metaStoreName = metaStoreName;
		this._dataStoreName = dataStoreName;

		// Initialize the database
		const request = indexedDB.open(this._dbName, 1);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(this._metaStoreName)) {
				const metaStore = db.createObjectStore(this._metaStoreName, {
					keyPath: 'fileId',
					autoIncrement: true
				});
				if (!metaStore.indexNames.contains('createdAt')) {
					metaStore.createIndex('createdAt', 'createdAt', { unique: false });
				}
			}
			if (!db.objectStoreNames.contains(this._dataStoreName)) {
				const dataStore = db.createObjectStore(this._dataStoreName, {
					keyPath: 'chunkId',
					autoIncrement: true
				});
				if (!dataStore.indexNames.contains('fileId_seq')) {
					dataStore.createIndex('fileId_seq', ['fileId', 'seq'], { unique: true });
				}
			}
		};
	}

	createFiles(
		files: Pick<FileMetaData, 'name' | 'size' | 'type' | 'createdAt' | 'clientId'>[]
	): Promise<{ fileIds: string[] }> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this._dbName);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction(this._metaStoreName, 'readwrite');
				const store = transaction.objectStore(this._metaStoreName);

				const fileIds: string[] = new Array(files.length);
				let errored = false;

				files.forEach((file, idx) => {
					const { name, size, type, createdAt = Date.now(), clientId } = file;
					const putRequest = store.add({
						name,
						size,
						type,
						createdAt,
						clientId,
						transferred: false
					});
					putRequest.onsuccess = () => {
						fileIds[idx] = String(putRequest.result);
					};
					putRequest.onerror = () => {
						if (!errored) {
							errored = true;
							reject(putRequest.error);
							transaction.abort();
						}
					};
				});

				transaction.oncomplete = () => {
					resolve({ fileIds });
				};
				transaction.onabort = () => {
					if (!errored) reject(new Error('Transaction aborted'));
				};
				transaction.onerror = () => {
					if (!errored) reject(transaction.error);
				};
			};
			request.onerror = () => reject(request.error);
		});
	}

	listFiles(): Promise<(FileMetaData & { fileId: string })[]> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this._dbName);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction(this._metaStoreName, 'readonly');
				const store = transaction.objectStore(this._metaStoreName);

				const index = store.index('createdAt');
				const files: (FileMetaData & { fileId: string })[] = [];
				const cursorReq = index.openCursor(null, 'prev');

				cursorReq.onsuccess = () => {
					const cursor = cursorReq.result;
					if (cursor) {
						const data = cursor.value as FileMetaData & { fileId: unknown };
						if (data.transferred) {
							files.push({ ...data, fileId: String(data.fileId) });
						}
						cursor.continue();
					} else {
						resolve(files);
					}
				};

				cursorReq.onerror = () => reject(cursorReq.error);
			};
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Write file data to the given fileId
	 * WARNING: This overwrites, not appends, any existing data for the fileId.
	 * @param fileId
	 * @returns
	 */
	writeFileData(fileId: string): WritableStream<ArrayBuffer> {
		let seq = 0;
		let pendingChunkSize = 0;
		const pendingChunks: ArrayBuffer[] = [];

		const commitChunks = (done = false) => {
			const currentSeq = seq++;
			const chunks = new Uint8Array(pendingChunkSize);
			let offset = 0;
			for (const chunk of pendingChunks) {
				chunks.set(new Uint8Array(chunk), offset);
				offset += chunk.byteLength;
			}
			pendingChunks.length = 0;
			pendingChunkSize = 0;

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(this._dbName);
				request.onsuccess = () => {
					const db = request.result;
					const stores = [];
					const hasChunkData = chunks.byteLength > 0;
					if (hasChunkData) stores.push(this._dataStoreName);
					if (done) stores.push(this._metaStoreName);

					const transaction = db.transaction(stores, 'readwrite');

					if (hasChunkData) {
						const store = transaction.objectStore(this._dataStoreName);
						store.add({ fileId, seq: currentSeq, data: chunks.buffer });
					}

					if (done) {
						const metaStore = transaction.objectStore(this._metaStoreName);
						const getMetaRequest = metaStore.openCursor(Number(fileId));
						getMetaRequest.onsuccess = () => {
							const cursor = getMetaRequest.result;
							if (cursor) {
								const file = cursor.value;
								file.transferred = true;
								cursor.update(file);
							}
						};
						getMetaRequest.onerror = () => reject(getMetaRequest.error);
					}

					transaction.oncomplete = () => resolve();
					transaction.onerror = () => reject(transaction.error);
				};
				request.onerror = () => reject(request.error);
			});
		};

		return new WritableStream<ArrayBuffer>(
			{
				write: async (chunk) => {
					pendingChunkSize += chunk.byteLength;
					pendingChunks.push(chunk);

					if (pendingChunkSize >= this.CHUNK_COMMIT_THRESHOLD) {
						await commitChunks();
					}
				},
				close: async () => {
					await commitChunks(true);
				}
			},
			{
				highWaterMark: this.CHUNK_COMMIT_THRESHOLD,
				size(chunk) {
					return chunk.byteLength;
				}
			}
		);
	}

	/**
	 * Read file data from the given fileId
	 * @param fileId
	 * @returns
	 */
	readFileData(fileId: string): ReadableStream<ArrayBuffer> | null {
		let lastSeq = -1;
		let finished = false;

		const processRangeFrom = (
			fromSeq: number,
			controller: ReadableStreamDefaultController<ArrayBuffer>
		) => {
			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(this._dbName);
				request.onsuccess = () => {
					const db = request.result;
					const transaction = db.transaction(this._dataStoreName, 'readonly');
					const store = transaction.objectStore(this._dataStoreName);
					const index = store.index('fileId_seq');
					const range = IDBKeyRange.bound([fileId, fromSeq], [fileId, Number.MAX_SAFE_INTEGER]);

					const cursorReq = index.openCursor(range, 'next');

					cursorReq.onsuccess = () => {
						const cursor = cursorReq.result;
						if (!cursor) {
							finished = true;
							controller.close();
							resolve();
							return;
						}

						const record = cursor.value;
						if (record?.data) {
							controller.enqueue(record.data as ArrayBuffer);
						}

						// continue while the stream can accept more
						if (controller.desiredSize! > 0) {
							cursor.continue();
						} else {
							// pause; resolve so pull() can open a new cursor later
							resolve();
						}
					};

					cursorReq.onerror = () => {
						controller.error(cursorReq.error);
						reject(cursorReq.error);
					};

					transaction.onabort = () => {
						controller.error(new Error('IndexedDB transaction aborted'));
						reject(new Error('IndexedDB transaction aborted'));
					};
					transaction.onerror = () => {
						controller.error(transaction.error);
						reject(transaction.error);
					};
				};
				request.onerror = () => {
					controller.error(request.error);
					reject(request.error);
				};
			});
		};

		return new ReadableStream<ArrayBuffer>({
			pull: async (controller) => {
				if (finished) return;
				const from = lastSeq++;
				return processRangeFrom(from, controller).catch(() => {});
			}
		});
	}

	async deleteFiles(fileIds: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			if (fileIds.length === 0) return resolve();

			const request = indexedDB.open(this._dbName);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction([this._metaStoreName, this._dataStoreName], 'readwrite');

				// Delete metadata
				const metaStore = transaction.objectStore(this._metaStoreName);
				for (const fileId of fileIds) {
					const deleteMetaRequest = metaStore.delete(Number(fileId));
					deleteMetaRequest.onerror = () => reject(deleteMetaRequest.error);
				}

				// Delete data chunks using a cursor per fileId and track completion
				const dataStore = transaction.objectStore(this._dataStoreName);
				const index = dataStore.index('fileId_seq');

				for (const fileId of fileIds) {
					const range = IDBKeyRange.bound([fileId, 0], [fileId, Number.MAX_SAFE_INTEGER]);
					// openKeyCursor returns keys (no value) and exposes primaryKey which we can use to delete
					const cursorReq = index.openKeyCursor(range);

					cursorReq.onsuccess = () => {
						const cursor = cursorReq.result as IDBCursor;
						if (cursor) {
							// delete by primary key on the data store (safer and slightly faster)
							dataStore.delete(cursor.primaryKey);
							cursor.continue();
						}
					};

					cursorReq.onerror = () => {
						reject(cursorReq.error);
						transaction.abort();
					};
				}

				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(new Error('Transaction aborted'));
				transaction.onerror = () => reject(transaction.error || new Error('Transaction error'));
			};
			request.onerror = () => reject(request.error);
		});
	}
}
