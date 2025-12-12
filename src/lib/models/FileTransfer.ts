import type {
	MessageHandler,
	MessagePacket,
	MessageHandlerMiddleware
} from '$lib/models/MessageHandler';
import { PUBLIC_ICE_SERVER_LIST_URL } from '$env/static/public';
import { EventEmitter } from '$lib/utils/EventEmitter';
import { poxyStorage } from '$lib/utils/poxyStorage';
import type { FileStorage } from './FileStorage';

export interface FileData {
	name: string;
	size: number;
	type: string;
}

export enum FileMessageTypes {
	LIST_REQUEST = 'FILE__LIST_REQUEST',
	LIST_RESPONSE = 'FILE__LIST_RESPONSE',
	SEND_REQUEST = 'FILE__SEND_REQUEST',
	RECEIVE_REQUEST = 'FILE__RECEIVE_REQUEST',
	RTC_OFFER = 'FILE__RTC_OFFER',
	RTC_ANSWER = 'FILE__RTC_ANSWER',
	RTC_ICE_CANDIDATE = 'FILE__RTC_ICE_CANDIDATE'
}

export type FileListResponseData = {
	files: FileData[];
};

export type FileSendRequestData = {
	files: FileData[];
};

export type FileReceiveRequestData = {
	files: string[];
};

export type ICECandidateData = {
	candidate: RTCIceCandidate | null;
};

export enum FileTransferEvents {
	FILE_TRANSFER_CONNECTION_STATE = 'file:transferConnectionState',
	FILE_TRANSFER_OPENED = 'file:transferOpened',
	FILE_RECEIVED_CHUNK = 'file:receivedChunk',
	FILE_TRANSFER_PROGRESS = 'file:transferProgress',
	FILE_TRANSFER_COMPLETED = 'file:transferCompleted',
	FILE_TRANSFER_ERROR = 'file:transferError'
}

type FileTransferEventMap = {
	[FileTransferEvents.FILE_RECEIVED_CHUNK]: [ArrayBuffer, string, string];
	[FileTransferEvents.FILE_TRANSFER_OPENED]: [string, string];
	[FileTransferEvents.FILE_TRANSFER_COMPLETED]: [string, string];
	[FileTransferEvents.FILE_TRANSFER_ERROR]: [Error, string, string];
	[FileTransferEvents.FILE_TRANSFER_PROGRESS]: [number, string, string];
	[FileTransferEvents.FILE_TRANSFER_CONNECTION_STATE]: [RTCPeerConnectionState, string];
};

/**
 * @class FileTransfer
 * Handles P2P file transfers between clients.
 */
export class FileTransfer extends EventEmitter<FileTransferEventMap> {
	private _messageHandler: MessageHandler;
	private _authHandler: MessageHandlerMiddleware;
	private _storage: Storage;
	private _files?: FileList;
	private _fileStorage: FileStorage;
	private _RTCPeerConnections: Map<string, RTCPeerConnection> = new Map();
	private _activeFileTransferChannels: Map<string, RTCDataChannel> = new Map();
	private _sessionEventHandler: EventEmitter<FileTransferEventMap> = new EventEmitter();
	private _requestTimeoutIds: Map<string, ReturnType<typeof setTimeout>> = new Map();

	private readonly ICE_SERVER_CACHE_KEY = 'file.iceServers';
	private readonly ICE_RESTART_LIMIT = 2;
	private readonly FILE_CHUNK_SIZE = 16 * 1024; // 16KB
	private readonly FILE_BUFFER_SIZE = 64 * 1024; // 64KB
	private readonly FILE_MAX_CONCURRENT = 3;
	private readonly FILE_TRANSFER_TIMEOUT = 30_000; // 30 seconds

	private async _getICEServers(): Promise<RTCIceServer[]> {
		const cachedIceServers = this._storage.getItem(this.ICE_SERVER_CACHE_KEY);
		if (cachedIceServers) {
			return JSON.parse(cachedIceServers) as RTCIceServer[];
		}

		try {
			const iceServerRespose = await fetch(PUBLIC_ICE_SERVER_LIST_URL);
			const iceServers = (await iceServerRespose.json()) as RTCIceServer[];
			this._storage.setItem(this.ICE_SERVER_CACHE_KEY, JSON.stringify(iceServers));
			return iceServers;
		} catch (error) {
			console.warn('Error fetching ICE servers:', error);
		}

		return [];
	}

	private _handleFileTransferChannel = (
		clientId: string,
		fileName: string,
		dataChannel: RTCDataChannel
	) => {
		let bytesReceived = 0;
		let channelClosedByError = false;
		let timeoutTimer: ReturnType<typeof setTimeout>;

		const key = `${clientId}-${fileName}`;
		this._activeFileTransferChannels.set(key, dataChannel);

		// Close transfer if no data received within timeout period
		const refreshTimeout = () => {
			clearTimeout(timeoutTimer);
			timeoutTimer = setTimeout(() => {
				this.emit(
					FileTransferEvents.FILE_TRANSFER_ERROR,
					new Error('File transfer timed out'),
					fileName,
					clientId
				);
				channelClosedByError = true;
				dataChannel.close();
			}, this.FILE_TRANSFER_TIMEOUT);
		};

		refreshTimeout();

		dataChannel.binaryType = 'arraybuffer';

		dataChannel.onmessage = (msgEvent) => {
			refreshTimeout();
			this.emit(FileTransferEvents.FILE_RECEIVED_CHUNK, msgEvent.data, fileName, clientId);

			// Send progress updates
			bytesReceived += msgEvent.data.byteLength;
			this.emit(FileTransferEvents.FILE_TRANSFER_PROGRESS, bytesReceived, fileName, clientId);
		};

		dataChannel.onopen = () => {
			clearTimeout(this._requestTimeoutIds.get(key));
			this._requestTimeoutIds.delete(key);
			this.emit(FileTransferEvents.FILE_TRANSFER_OPENED, fileName, clientId);
		};

		dataChannel.onclose = () => {
			clearTimeout(timeoutTimer);
			this._activeFileTransferChannels.delete(key);
			if (!channelClosedByError) {
				this.emit(FileTransferEvents.FILE_TRANSFER_COMPLETED, fileName, clientId);
			}
		};

		dataChannel.onerror = (errev) => {
			clearTimeout(timeoutTimer);
			this.emit(FileTransferEvents.FILE_TRANSFER_ERROR, errev.error, fileName, clientId);
			this._activeFileTransferChannels.delete(key);
		};
	};

	private async _createRTCPeerConnection(clientId: string): Promise<RTCPeerConnection> {
		let restartAttempts = 0;

		const peerConnection = new RTCPeerConnection({
			iceServers: await this._getICEServers()
		});

		peerConnection.onicecandidateerror = (event) => {
			console.warn('[RTCPeerConnection] ICE Candidate Error:', event);
		};
		peerConnection.onnegotiationneeded = async () => {
			try {
				const offer = await peerConnection.createOffer();
				await peerConnection.setLocalDescription(offer);
				this._messageHandler.send<RTCSessionDescriptionInit>({
					type: FileMessageTypes.RTC_OFFER,
					clientId,
					data: offer
				});
			} catch (error) {
				console.warn('[RTCPeerConnection] Error during renegotiation offer creation:', error);
			}
		};
		peerConnection.onicecandidate = (event) => {
			this._messageHandler.send<ICECandidateData>({
				type: FileMessageTypes.RTC_ICE_CANDIDATE,
				clientId: clientId,
				data: {
					candidate: event.candidate
				}
			});
		};
		peerConnection.oniceconnectionstatechange = () => {
			if (peerConnection.iceConnectionState === 'failed') {
				restartAttempts++;
				if (restartAttempts <= this.ICE_RESTART_LIMIT) {
					console.info(
						`[RTCPeerConnection] ICE connection state with ${clientId} is 'failed', restarting ICE...`
					);
					peerConnection.restartIce();
				} else {
					peerConnection.close();
				}
			}
		};

		peerConnection.onconnectionstatechange = () => {
			this.emit(
				FileTransferEvents.FILE_TRANSFER_CONNECTION_STATE,
				peerConnection.connectionState,
				clientId
			);
			if (['closed'].includes(peerConnection.connectionState)) {
				console.info(
					`[RTCPeerConnection] Connection state with ${clientId} is '${peerConnection.connectionState}', cleaning up...`
				);
				this._RTCPeerConnections.delete(clientId);
			}
		};

		// Handle incoming data channels for file transfer
		peerConnection.ondatachannel = (event) => {
			const dataChannel = event.channel;
			if (dataChannel.label.startsWith('file-transfer:')) {
				const fileName = dataChannel.label.replace('file-transfer:', '');
				this._handleFileTransferChannel(clientId, fileName, dataChannel);
			} else {
				console.warn(`No handler for opened data channel with label "${dataChannel.label}"`);
			}
		};

		return peerConnection;
	}

	private async _getRTCPeerConnection(clientId: string): Promise<RTCPeerConnection> {
		if (!this._RTCPeerConnections.has(clientId)) {
			const peerConnection = await this._createRTCPeerConnection(clientId);
			this._RTCPeerConnections.set(clientId, peerConnection);
		}
		return this._RTCPeerConnections.get(clientId)!;
	}

	private _resetRTCPeerConnection(clientId: string): void {
		const existingConnection = this._RTCPeerConnections.get(clientId);
		if (existingConnection) {
			existingConnection.close();
			this._RTCPeerConnections.delete(clientId);
		}
	}

	private async _transferFile(file: File, clientId: string, peerConnection: RTCPeerConnection) {
		return new Promise<void>((resolve, reject) => {
			// Create data channel for file transfer
			const dataChannel = peerConnection.createDataChannel(`file-transfer:${file.name}`);
			dataChannel.binaryType = 'arraybuffer';
			dataChannel.bufferedAmountLowThreshold = this.FILE_BUFFER_SIZE;

			const fileReader = new FileReader();
			let fileTransferComplete = false;
			dataChannel.onopen = async () => {
				this.emit(FileTransferEvents.FILE_TRANSFER_OPENED, file.name, clientId);

				const readChunk = (o: number) => {
					return new Promise<ArrayBuffer>((resolve) => {
						fileReader.onload = (event) => {
							if (event.target?.result) {
								resolve(event.target.result as ArrayBuffer);
							}
						};

						const slice = file.slice(o, o + this.FILE_CHUNK_SIZE);
						fileReader.readAsArrayBuffer(slice);
					});
				};

				const waitForDrain = () =>
					new Promise<void>((resolve, reject) => {
						// already drained
						if (dataChannel.bufferedAmount <= dataChannel.bufferedAmountLowThreshold) {
							resolve();
							return;
						}

						const onLow = () => {
							cleanup();
							resolve();
						};
						const onClose = () => {
							cleanup();
							reject(new Error('Data channel closed while waiting for drain'));
						};
						const onError = (errev: RTCErrorEvent) => {
							cleanup();
							reject(errev.error);
						};

						function cleanup() {
							dataChannel.removeEventListener('bufferedamountlow', onLow);
							dataChannel.removeEventListener('close', onClose);
							dataChannel.removeEventListener('error', onError);
						}

						dataChannel.addEventListener('bufferedamountlow', onLow);
						dataChannel.addEventListener('close', onClose);
						dataChannel.addEventListener('error', onError);
					});

				let offset = 0;
				const bufferFile = async () => {
					// send chunks up to the buffer size, and wait for drain when needed
					while (offset < file.size) {
						try {
							const chunk = await readChunk(offset);
							offset += chunk.byteLength;
							dataChannel.send(chunk);
							this.emit(FileTransferEvents.FILE_TRANSFER_PROGRESS, offset, file.name, clientId);
						} catch (error) {
							reject(error);
							return;
						}

						// backpressure: if queued bytes exceed threshold, wait for bufferedamountlow
						if (dataChannel.bufferedAmount >= dataChannel.bufferedAmountLowThreshold) {
							await waitForDrain();
						}
					}

					if (offset >= file.size) {
						fileTransferComplete = true;
						this.emit(FileTransferEvents.FILE_TRANSFER_COMPLETED, file.name, clientId);
						dataChannel.close();
					}
				};

				await bufferFile();
			};

			dataChannel.onclose = () => {
				if (fileTransferComplete) {
					resolve();
				} else {
					// Likely closed by the receiver because of a timeout
					reject(new Error('Data channel closed before file transfer was complete'));
				}
			};

			dataChannel.onerror = (errev) => {
				reject(errev.error);
				console.warn(`Data channel error for file "${file.name}":`, errev.error);
			};
		});
	}

	private async _transferFiles(files: File[], clientId: string, peerConnection: RTCPeerConnection) {
		const fileTransferQueue: File[] = files.slice();
		const transferNextFile = async () => {
			if (fileTransferQueue.length === 0) return;
			const file = fileTransferQueue.shift()!;
			try {
				await this._transferFile(file, clientId, peerConnection);
			} catch (error) {
				this.emit(FileTransferEvents.FILE_TRANSFER_ERROR, error as Error, file.name, clientId);
			} finally {
				// Start next file transfer
				await transferNextFile();
			}
		};

		// Start initial concurrent transfers
		const initialTransfers = Math.min(this.FILE_MAX_CONCURRENT, fileTransferQueue.length);
		for (let i = 0; i < initialTransfers; i++) {
			transferNextFile();
		}
	}

	private _handleListRequest = async (message: MessagePacket<undefined>) => {
		const filesArray: FileData[] = [];
		for (let i = 0; i < (this._files?.length ?? 0); i++) {
			const file = this._files![i];
			filesArray.push({
				name: file.name,
				size: file.size,
				type: file.type
			});
		}

		this._messageHandler.send<FileListResponseData>({
			type: FileMessageTypes.LIST_RESPONSE,
			clientId: message.clientId,
			data: {
				files: filesArray
			}
		});
	};

	private _handleRtcOffer = async (message: MessagePacket<RTCSessionDescriptionInit>) => {
		try {
			const peerConnection = await this._getRTCPeerConnection(message.clientId);
			await peerConnection.setRemoteDescription(message.data);
			const answer = await peerConnection.createAnswer();
			await peerConnection.setLocalDescription(answer);
			this._messageHandler.send<RTCSessionDescriptionInit>({
				type: FileMessageTypes.RTC_ANSWER,
				clientId: message.clientId,
				data: answer
			});
		} catch (error) {
			console.warn('Error creating answer to RTC offer:', error);
		}
	};

	private _handleRtcAnswer = async (message: MessagePacket<RTCSessionDescriptionInit>) => {
		try {
			const peerConnection = await this._getRTCPeerConnection(message.clientId);
			await peerConnection.setRemoteDescription(message.data);
		} catch (error) {
			console.warn('Error setting remote description from RTC answer:', error);
		}
	};

	private _handleRtcIceCandidate = async (message: MessagePacket<ICECandidateData>) => {
		try {
			const peerConnection = await this._getRTCPeerConnection(message.clientId);
			await peerConnection.addIceCandidate(message.data.candidate);
		} catch (error) {
			console.warn('Error adding received ICE candidate:', error);
		}
	};

	private _handleReceiveRequest = async (message: MessagePacket<FileReceiveRequestData>) => {
		if (!this._files) {
			console.warn('Client requested file transfer but no transfer files are set.');
			return;
		}

		try {
			this._resetRTCPeerConnection(message.clientId);

			const peerConnection = await this._getRTCPeerConnection(message.clientId);
			const offer = await peerConnection.createOffer();
			await peerConnection.setLocalDescription(offer);
			this._messageHandler.send<RTCSessionDescriptionInit>({
				type: FileMessageTypes.RTC_OFFER,
				clientId: message.clientId,
				data: offer
			});
			const availableFiles = Array.from(this._files);
			const filesToTransfer = message.data.files.flatMap((fileName) => {
				const file = availableFiles.find((f) => f.name === fileName);
				if (file) {
					return [file];
				} else {
					console.warn(`Requested file "${fileName}" not found among available transfer files.`);
					return [];
				}
			});

			if (filesToTransfer.length === 0) {
				console.warn('No files to transfer after processing request.');
				return;
			}

			this._transferFiles(filesToTransfer, message.clientId, peerConnection);
		} catch (error) {
			console.warn('Error handling file transfer request:', error);
		}
	};

	/**
	 * Set up to receive files from remote client, then request em.
	 * @param message
	 */
	private _handleSendRequest = async (message: MessagePacket<FileSendRequestData>) => {
		try {
			const { clientId } = message;
			const { files } = message.data;
			const fileWriters = new Map<string, WritableStreamDefaultWriter<ArrayBuffer>>();
			const { fileIds } = await this._fileStorage.createFiles(
				files.map((file) => ({
					name: file.name,
					size: file.size,
					type: file.type,
					createdAt: Date.now(),
					clientId
				}))
			);
			fileIds.forEach((fileId, index) => {
				const writable = this._fileStorage.writeFileData(fileId);
				const writer = writable.getWriter();
				fileWriters.set(files[index].name, writer);
			});

			const fileTransferChunkReceived = (
				chunk: ArrayBuffer,
				fileName: string,
				fromClientId: string
			) => {
				if (fromClientId === clientId) {
					try {
						const writer = fileWriters.get(fileName);
						if (writer) writer.write(chunk);
					} catch {
						// If we fail to write for whatever reason immediately close the channel so the sender can retry.
						const activeChannel = this._activeFileTransferChannels.get(`${clientId}-${fileName}`);
						if (activeChannel) {
							activeChannel.close();
						}
					}
				}
			};

			const fileTransferComplete = (fileName: string, fromClientId: string) => {
				if (fromClientId === clientId) {
					const writer = fileWriters.get(fileName);
					if (writer) {
						writer.close();
						fileWriters.delete(fileName);
					}

					this.off(FileTransferEvents.FILE_RECEIVED_CHUNK, fileTransferChunkReceived);
					this.off(FileTransferEvents.FILE_TRANSFER_COMPLETED, fileTransferComplete);
					this.off(FileTransferEvents.FILE_TRANSFER_ERROR, fileTransferError);
				}
			};

			const fileTransferError = (error: Error, fileName: string, fromClientId: string) => {
				if (fromClientId === clientId) {
					const writer = fileWriters.get(fileName);
					if (writer) {
						writer.abort(error);
						fileWriters.delete(fileName);
					}

					this.off(FileTransferEvents.FILE_RECEIVED_CHUNK, fileTransferChunkReceived);
					this.off(FileTransferEvents.FILE_TRANSFER_COMPLETED, fileTransferComplete);
					this.off(FileTransferEvents.FILE_TRANSFER_ERROR, fileTransferError);
				}
			};

			this.on(FileTransferEvents.FILE_RECEIVED_CHUNK, fileTransferChunkReceived);
			this.on(FileTransferEvents.FILE_TRANSFER_COMPLETED, fileTransferComplete);
			this.on(FileTransferEvents.FILE_TRANSFER_ERROR, fileTransferError);

			this.requestFilesFromClient(
				message.clientId,
				message.data.files.map((file) => file.name),
				message.authentication
			);
		} catch (error) {
			console.error(`Error handling file receival from client ${message.clientId}:`, error);
		}
	};

	constructor({
		messageHandler,
		authHandler,
		fileStorage,
		storage = globalThis.localStorage ?? poxyStorage
	}: {
		messageHandler: MessageHandler;
		authHandler: MessageHandlerMiddleware;
		fileStorage: FileStorage;
		storage?: Storage;
	}) {
		super();

		this._messageHandler = messageHandler;
		this._authHandler = authHandler;
		this._fileStorage = fileStorage;
		this._storage = storage;

		this._messageHandler.handleMessage<undefined>(
			FileMessageTypes.LIST_REQUEST,
			this._authHandler,
			this._handleListRequest.bind(this)
		);

		this._messageHandler.handleMessage<RTCSessionDescriptionInit>(
			FileMessageTypes.RTC_OFFER,
			// No auth for RTC offer/answer exchange
			this._handleRtcOffer.bind(this)
		);

		this._messageHandler.handleMessage<RTCSessionDescriptionInit>(
			FileMessageTypes.RTC_ANSWER,
			// No auth for RTC offer/answer exchange
			this._handleRtcAnswer.bind(this)
		);

		this._messageHandler.handleMessage<ICECandidateData>(
			FileMessageTypes.RTC_ICE_CANDIDATE,
			// No auth for ICE candidate exchange
			this._handleRtcIceCandidate.bind(this)
		);

		this._messageHandler.handleMessage<FileReceiveRequestData>(
			FileMessageTypes.RECEIVE_REQUEST,
			this._authHandler,
			this._handleReceiveRequest.bind(this)
		);

		this._messageHandler.handleMessage<FileSendRequestData>(
			FileMessageTypes.SEND_REQUEST,
			this._authHandler,
			this._handleSendRequest.bind(this)
		);

		this.on(EventEmitter.ALL, (event, ...args) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this._sessionEventHandler.emit(event as keyof FileTransferEventMap, ...(args as any));
		});
	}

	destroy(): void {
		this.removeAllListeners();
	}

	/**
	 * Set local files available for transfer.
	 * @param files
	 */
	async setTransferFiles(files: FileList) {
		this._files = files;
	}

	/**
	 * Create a new session handler for file transfer events.
	 * Attach to this handler to listen for file transfer events.
	 * @returns
	 */
	createSessionHandler(): EventEmitter<FileTransferEventMap> {
		this._sessionEventHandler = new EventEmitter<FileTransferEventMap>();
		return this._sessionEventHandler;
	}

	/**
	 * List files available to transfer from remote client.
	 * @param targetClientId
	 * @param authToken
	 * @returns
	 */
	async listFilesFromClient(targetClientId: string, authToken?: string): Promise<FileData[]> {
		const requestMessage = {
			type: FileMessageTypes.LIST_REQUEST,
			clientId: targetClientId,
			authentication: authToken
		};

		this._messageHandler.send<undefined>(requestMessage);

		const response = await this._messageHandler.waitForMessage<FileListResponseData>(
			FileMessageTypes.LIST_RESPONSE,
			(message) => {
				return message.clientId === targetClientId;
			}
		);

		return response.data.files;
	}

	/**
	 * Request the remote client to begin sending files to this client.
	 * @param targetClientId
	 * @param files - List of file names to request
	 * @param authToken
	 */
	requestFilesFromClient(targetClientId: string, files: string[], authToken?: string): void {
		this._resetRTCPeerConnection(targetClientId);

		files.forEach((fileName) => {
			const key = `${targetClientId}-${fileName}`;
			// Clear any existing timeout for this file transfer request
			if (this._requestTimeoutIds.has(key)) {
				clearTimeout(this._requestTimeoutIds.get(key)!);
				this._requestTimeoutIds.delete(key);
			}

			// Set a timeout to handle no response
			const timeoutId = setTimeout(() => {
				this.emit(
					FileTransferEvents.FILE_TRANSFER_ERROR,
					new Error('File transfer request timed out'),
					fileName,
					targetClientId
				);
				this._requestTimeoutIds.delete(key);
			}, this.FILE_TRANSFER_TIMEOUT);

			this._requestTimeoutIds.set(key, timeoutId);
		});

		this._messageHandler.send<FileReceiveRequestData>({
			type: FileMessageTypes.RECEIVE_REQUEST,
			clientId: targetClientId,
			authentication: authToken,
			data: {
				files
			}
		});
	}

	/**
	 * Requests the remote client to receive files from this client.
	 * Confusing yes, we're telling the remote client to prepare to receive files we want to send it.
	 * It is expected to then send a receive request when ready.
	 * @param targetClientId
	 * @param files
	 * @param authToken
	 * @param refreshConnection
	 */
	async sendFilesToClient(
		targetClientId: string,
		files: string[],
		authToken?: string
	): Promise<void> {
		if (this._files?.length === 0) {
			throw new Error('No files set for transfer. Use setTransferFiles() first.');
		}

		const filesToTransfer = Array.from(this._files!).filter((file) => files.includes(file.name));
		if (filesToTransfer.length === 0) {
			throw new Error('None of the specified files are available for transfer.');
		}

		this._messageHandler.send<FileSendRequestData>({
			type: FileMessageTypes.SEND_REQUEST,
			clientId: targetClientId,
			authentication: authToken,
			data: {
				files: filesToTransfer.map((file) => ({
					name: file.name,
					size: file.size,
					type: file.type
				}))
			}
		});

		await this._messageHandler.waitForMessage<FileReceiveRequestData>(
			FileMessageTypes.RECEIVE_REQUEST,
			(message) => message.clientId === targetClientId
		);
	}

	/**
	 * Close connection with client, any ongoing transfers will be aborted.
	 * @param clientId
	 */
	closeConnection(clientId: string): void {
		const connection = this._RTCPeerConnections.get(clientId);
		if (connection) {
			connection.close();
		}
	}
}
