<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { type FileData, FileTransferEvents } from '$lib/models/FileTransfer';
	import { throttle } from '$lib/utils/throttle';
	import Progress from '$lib/components/Progress.svelte';
	import FileList, {
		type FileListItem,
		STATUS_REQUESTING,
		STATUS_TRANSFERRING,
		STATUS_COMPLETED,
		STATUS_ERROR
	} from '$lib/components/FileList.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { PageProps } from './$types';

	interface File {
		size: number;
		bytesTransferred: number;
		data: Uint8Array;
		index: number;
	}

	const { params }: PageProps = $props();

	const localClient = getLocalClient();
	const fileTransfer = localClient.getFileTransfer();
	const fileTransferSession = fileTransfer.createSessionHandler();
	const fileListState = $state<FileListItem[]>([]);
	const files = new Map<string, File>();

	let error: string | null = $state(null);
	let loading: boolean = $state(true);
	let clientName = $state(params.publicId);

	const hasFilesToTransfer = $derived(
		fileListState.some((file) => !file.status || file.status === STATUS_ERROR)
	);

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_ERROR, (fileName) => {
		const file = files.get(fileName)!;
		fileListState[file.index].status = STATUS_ERROR;
		fileListState[file.index].bytesTransferred = 0;
		file.bytesTransferred = 0;
		file.data = new Uint8Array(file.size);
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_OPENED, (fileName) => {
		fileListState[files.get(fileName)!.index].status = STATUS_TRANSFERRING;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_COMPLETED, (fileName) => {
		const file = files.get(fileName)!;
		fileListState[file.index].bytesTransferred = file.size;
		fileListState[file.index].status = STATUS_COMPLETED;
	});

	fileTransferSession.on(FileTransferEvents.FILE_RECEIVED_CHUNK, (fileName, byteArray) => {
		const file = files.get(fileName);
		if (!file) {
			console.warn('Received chunk for unknown file:', fileName);
			return;
		}

		const data = new Uint8Array(byteArray);
		file.data.set(data, file.bytesTransferred);
		file.bytesTransferred += data.length;
	});

	const transferFile = (fileName: string) => {
		const file = fileListState[files.get(fileName)!.index];
		const refreshConnection = file.status === STATUS_ERROR;
		file.status = STATUS_REQUESTING;
		fileTransfer.requestFileTransfer(
			params.publicId,
			[fileName],
			params.authToken,
			refreshConnection
		);
	};

	const transferAll = async () => {
		const filesToTransfer: string[] = [];
		let refreshConnection = false;
		fileListState.forEach((file) => {
			if (![STATUS_REQUESTING, STATUS_TRANSFERRING, STATUS_COMPLETED].includes(file.status || '')) {
				if (file.status === STATUS_ERROR) refreshConnection = true;
				filesToTransfer.push(file.name);
				file.status = STATUS_REQUESTING;
			}
		});
		fileTransfer.requestFileTransfer(
			params.publicId,
			filesToTransfer,
			params.authToken,
			refreshConnection
		);
	};

	const saveFile = (fileName: string) => {
		const data = files.get(fileName)?.data;
		if (!data) {
			console.error('No data available for file:', fileName);
			// This should never happen since the button would be disabled
			return;
		}

		const blob = new Blob([new Uint8Array(data)]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	onMount(async () => {
		try {
			// If they don't already have a local client set up, make an anonymous one for them
			if (!localClient.isSetup()) await localClient.setup();
		} catch (e) {
			error = 'Failed to set up client. Please try reloading.';
			loading = false;
			return;
		}

		localClient.identifyClient(params.publicId, params.authToken).then((name) => {
			clientName = name;
		});

		try {
			const listedFiles = await fileTransfer.listFilesFromClient(params.publicId, params.authToken);
			listedFiles.forEach((file, index) => {
				files.set(file.name, {
					index,
					size: file.size,
					bytesTransferred: 0,
					data: new Uint8Array(file.size)
				});
				fileListState.push({
					name: file.name,
					size: file.size,
					type: file.type,
					bytesTransferred: 0
				});

				// Since we throttle the progress updates we need a dedicated one for each file
				fileTransferSession.on(
					FileTransferEvents.FILE_TRANSFER_PROGRESS,
					throttle((fileName: string, bytesReceived: number) => {
						if (fileName === file.name) {
							fileListState[index].bytesTransferred = bytesReceived;
						}
					}, 100)
				);
			});
		} catch (e) {
			error =
				'Failed to load files from client. The link may be invalid or the sender has disconnected.';
		} finally {
			loading = false;
		}
	});
</script>

{#if fileListState.length > 0}
	<hgroup>
		<h2>Available Files</h2>
		<p>Shared from <strong>{clientName}</strong></p>
	</hgroup>
	<FileList files={fileListState}>
		{#snippet fileItemControls(file: FileListItem)}
			{#if !file.status || file.status === STATUS_ERROR}
				<span class="file-list__item-download">
					<Button title="Download" onclick={() => transferFile(file.name)}>
						<span class="icon icon--download"></span>
						<span class="sr-only">Download</span>
					</Button>
				</span>
			{:else if [STATUS_REQUESTING, STATUS_TRANSFERRING, STATUS_COMPLETED].includes(file.status)}
				<span class="file-list__item-save">
					<Button
						disabled={file.status !== STATUS_COMPLETED}
						title={file.status === STATUS_COMPLETED ? 'Save File' : 'Downloading...'}
						onclick={() => saveFile(file.name)}
					>
						<span class="icon icon--save"></span>
						<span class="sr-only">
							{file.status === STATUS_COMPLETED ? 'Save File' : 'Downloading...'}
						</span>
					</Button>
				</span>
			{/if}
		{/snippet}
	</FileList>
	{#if hasFilesToTransfer}
		<Button onclick={transferAll}>
			<span class="icon icon--download"></span>
			Download All
		</Button>
	{/if}
{:else if loading}
	<Progress>
		{#snippet label()}
			<h2>Loading Files...</h2>
		{/snippet}
	</Progress>
{:else}
	<h2>No Files Available ;_;</h2>
	<div>
		<svg xmlns="http://www.w3.org/2000/svg" width="5rem" height="5rem" viewBox="0 0 20 20">
			<path
				fill="currentColor"
				d="M4 4.707L2.146 2.854a.5.5 0 1 1 .708-.708l15 15a.5.5 0 0 1-.708.708l-1.241-1.242A2 2 0 0 1 14 18H6a2 2 0 0 1-2-2zm11 11l-1.032-1.032A.5.5 0 0 1 13.5 15h-5a.5.5 0 0 1 0-1h4.793l-1-1H8.5a.5.5 0 0 1 0-1h2.793l-1-1H8.5a.5.5 0 0 1 0-1h.793L5 5.707V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1zM12.121 10l1 1h.379a.5.5 0 0 0 0-1zM15 8v4.879l1 1V7.414a1.5 1.5 0 0 0-.44-1.06l-3.914-3.915A1.5 1.5 0 0 0 10.586 2H6c-.521 0-.996.2-1.352.526l.708.709A1 1 0 0 1 6 3h4v3.5A1.5 1.5 0 0 0 11.5 8zm-9 2.5a.5.5 0 1 0 1 0a.5.5 0 0 0-1 0m.5 1.5a.5.5 0 1 0 0 1a.5.5 0 0 0 0-1M6 14.5a.5.5 0 1 1 1 0a.5.5 0 0 1-1 0M14.793 7H11.5a.5.5 0 0 1-.5-.5V3.207z"
			/>
		</svg>
	</div>
	<p>{error}</p>
{/if}
