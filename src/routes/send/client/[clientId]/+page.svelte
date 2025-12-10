<script lang="ts">
	import type { EventHandler } from 'svelte/elements';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { FileTransferEvents } from '$lib/models/FileTransfer';
	import Button from '$lib/components/Button.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import FileList, {
		type FileListItem,
		STATUS_TRANSFERRING,
		STATUS_COMPLETED,
		STATUS_ERROR
	} from '$lib/components/FileList.svelte';
	import FileInput from '$lib/components/FileInput.svelte';
	import { throttle } from '$lib/utils/throttle';
	import type { PageProps } from './$types';

	interface TransferProgressProps {
		value: number | undefined;
		max: number;
		label: string;
	}

	const { params }: PageProps = $props();

	const localClient = getLocalClient();
	const fileTransfer = localClient.getFileTransfer();
	const fileTransferSession = fileTransfer.createSessionHandler();
	const fileListState = $state<FileListItem[]>([]);
	const receiver = localClient.getConnection(params.clientId);

	let clientConnectionError = $state<boolean>(false);

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_OPENED, (fileName) => {
		const fileItem = fileListState.find((file) => file.name === fileName);
		if (!fileItem) return;
		fileItem.status = STATUS_TRANSFERRING;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_COMPLETED, (fileName) => {
		const fileItem = fileListState.find((file) => file.name === fileName);
		if (!fileItem) return;
		fileItem.status = STATUS_COMPLETED;
		fileItem.bytesTransferred = fileItem.size;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_ERROR, (error, fileName) => {
		const fileItem = fileListState.find((file) => file.name === fileName);
		if (!fileItem) return;
		fileItem.status = STATUS_ERROR;
		fileItem.bytesTransferred = 0;
	});

	const transferProgressProps: TransferProgressProps = $derived.by(() => {
		if (fileListState.length === 0) {
			return {
				max: 1,
				value: undefined,
				label: 'Waiting For Files...'
			};
		}

		if (clientConnectionError) {
			return {
				max: 1,
				value: 0,
				label: 'Connection Error'
			};
		}

		const transferringFiles = fileListState.filter((file) => file.status === STATUS_TRANSFERRING);
		const completedFiles = fileListState.filter((file) => file.status === STATUS_COMPLETED);
		const errorFiles = fileListState.filter((file) => file.status === STATUS_ERROR);

		if (transferringFiles.length === 0) {
			if (completedFiles.length === 0) {
				if (errorFiles.length > 0) {
					return {
						max: 1,
						value: 0,
						label: `Transfer Failed`
					};
				}

				return {
					max: 1,
					value: undefined,
					label: 'Waiting For Receiver...'
				};
			}

			return {
				max: fileListState.reduce((sum, file) => sum + file.size, 0),
				value: completedFiles.reduce((sum, file) => sum + file.size, 0),
				label: `Transferred ${completedFiles.length}/${fileListState.length} File(s)`
			};
		}

		const totalSize = transferringFiles.reduce((sum, file) => sum + file.size, 0);
		const totalTransferred = transferringFiles.reduce(
			(sum, file) => sum + (file.bytesTransferred || 0),
			0
		);

		return {
			max: totalSize,
			value: totalTransferred,
			label: `Transferring ${transferringFiles.length} file(s)...`
		};
	});

	const showDoneButton = $derived(fileListState.every((file) => file.status === STATUS_COMPLETED));
	const showRetryButton = $derived(fileListState.some((file) => file.status === STATUS_ERROR));

	const sendFiles: EventHandler<Event, HTMLInputElement> = async (event) => {
		const files = event.currentTarget.files!;
		const fileArray = Array.from(files);
		fileArray.forEach((file, index) => {
			fileListState.push({
				name: file.name,
				size: file.size,
				type: file.type,
				bytesTransferred: 0
			});

			fileTransferSession.on(
				FileTransferEvents.FILE_TRANSFER_PROGRESS,
				throttle((bytesTransferred: number, fileName: string) => {
					if (file.name === fileName) {
						fileListState[index].bytesTransferred = bytesTransferred;
					}
				}, 100)
			);
		});

		try {
			fileTransfer.setTransferFiles(files);
			await fileTransfer.sendFilesToClient(
				params.clientId,
				fileArray.map((file) => file.name)
			);
		} catch (error) {
			// Most likely the connection can't be established
			clientConnectionError = true;
		}
	};

	const retrySend = async () => {
		clientConnectionError = false;
		const filesToRetry = fileListState.filter(
			(file) => !file.status || file.status === STATUS_ERROR
		);
		filesToRetry.forEach((file) => {
			file.status = undefined;
			file.bytesTransferred = 0;
		});

		try {
			await fileTransfer.sendFilesToClient(
				params.clientId,
				filesToRetry.map((file) => file.name)
			);
		} catch (error) {
			// Most likely the connection can't be established
			clientConnectionError = true;
		}
	};
</script>

{#snippet clientIcon()}
	<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16">
		<path
			fill="currentColor"
			d="M6 2h7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8v1h2v1H8v1h3.5a.5.5 0 0 0 0-1H11v-1h2a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2h1V3a1 1 0 0 1 1-1M3.5 12a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1zm-1-6A1.5 1.5 0 0 0 1 7.5v6A1.5 1.5 0 0 0 2.5 15h3A1.5 1.5 0 0 0 7 13.5v-6A1.5 1.5 0 0 0 5.5 6zm0 1h3a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5"
		/>
	</svg>
{/snippet}

{#snippet transferProgress({ value, max, label: labelString }: TransferProgressProps)}
	<Progress {value} {max}>
		{#snippet label()}
			<strong>{labelString}</strong>
		{/snippet}
	</Progress>
{/snippet}

<div class="transfer-status">
	<div class="sender">
		{@render clientIcon()}
	</div>
	<div class="transfer">
		{@render transferProgress(transferProgressProps)}
		<p class="receiver-name">
			Sending To
			<br />
			<strong>{receiver?.name || '...'}</strong>
		</p>
	</div>
	<div class="receiver">
		{@render clientIcon()}
	</div>
</div>
{#if fileListState.length === 0}
	<FileInput multiple onchange={sendFiles}>
		<span class="icon icon--upload"></span>
		Select Files
	</FileInput>
	<p>Once you select files, the transfer will begin.</p>
{:else if clientConnectionError}
	<p>Connection to client failed. Make sure the receiver has phlick.me open.</p>
	<Button onclick={retrySend}>
		<span class="icon icon--refresh"></span>
		Retry
	</Button>
{:else}
	<h2>Files</h2>
	<FileList files={fileListState} />
	{#if showRetryButton}
		<Button onclick={retrySend}>
			<span class="icon icon--refresh"></span>
			Retry Failed Transfers
		</Button>
	{/if}
	{#if showDoneButton}
		<a class="button" href="/">Done</a>
	{/if}
{/if}

<style>
	.transfer-status {
		display: flex;
		margin-bottom: var(--spacing-unit);
	}
	.transfer-status .sender,
	.transfer-status .receiver {
		flex: 1;
		position: relative;
	}
	.transfer-status .receiver {
		transform: scaleX(-1);
	}

	.transfer-status .transfer {
		flex: 2;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.receiver-name {
		margin: 0;
	}
</style>
