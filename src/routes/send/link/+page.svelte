<script lang="ts">
	import { onMount } from 'svelte';
	import { getContext } from '../context.svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { FileTransferEvents } from '$lib/models/FileTransfer';
	import Progress from '$lib/components/Progress.svelte';
	import { showToast } from '$lib/components/Toast.svelte';
	import FileList, {
		type FileListItem,
		STATUS_TRANSFERRING,
		STATUS_COMPLETED,
		STATUS_ERROR
	} from '$lib/components/FileList.svelte';
	import { throttle } from '$lib/utils/throttle';

	interface TransferProgressProps {
		value: number | undefined;
		max: number;
		label: string;
	}

	const { files } = getContext();
	const localClient = getLocalClient();
	const fileTransfer = localClient.getFileTransfer();
	const fileTransferSession = fileTransfer.createSessionHandler();
	const fileListState = $state<FileListItem[]>([]);

	let link = $state<string>('');

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_OPENED, (fileName) => {
		fileListState.find((file) => file.name === fileName)!.status = STATUS_TRANSFERRING;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_COMPLETED, (fileName) => {
		const file = fileListState.find((file) => file.name === fileName)!;
		file.bytesTransferred = file.size;
		file.status = STATUS_COMPLETED;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_ERROR, (fileName, error) => {
		const file = fileListState.find((file) => file.name === fileName)!;
		file.status = STATUS_ERROR;
	});

	const transferProgressProps: TransferProgressProps = $derived.by(() => {
		const transferringFiles = fileListState.filter((file) => file.status === STATUS_TRANSFERRING);
		const completedFiles = fileListState.filter((file) => file.status === STATUS_COMPLETED);

		if (transferringFiles.length === 0) {
			if (completedFiles.length === 0) {
				return {
					max: 1,
					value: undefined,
					label: 'Waiting for receiver...'
				};
			}

			return {
				max: fileListState.reduce((sum, file) => sum + file.size, 0),
				value: completedFiles.reduce((sum, file) => sum + file.size, 0),
				label: `Transferred ${completedFiles.length}/${fileListState.length} file(s)`
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

	onMount(() => {
		if (!files) {
			goto('/send', { replaceState: true });
		} else {
			fileTransfer.setTransferFiles(files);
			Array.from(files).forEach((file, index) => {
				fileListState.push({
					name: file.name,
					size: file.size,
					type: file.type,
					bytesTransferred: 0
				});

				fileTransferSession.on(
					FileTransferEvents.FILE_TRANSFER_PROGRESS,
					throttle((fileName: string, bytesSent: number) => {
						if (fileName === file.name) {
							fileListState[index].bytesTransferred = bytesSent;
						}
					}, 100)
				);
			});

			link = `${location.origin}/files/${localClient.generatePublicURLPath()}`;
		}
	});

	onNavigate(() => {
		if (link) {
			localClient.disposePublicURLPath(link.split('/files/')[1]);
		}
	});
</script>

{#snippet clientIcon()}
	<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16">
		<path
			fill="currentColor"
			d="M5 1a2 2 0 0 0-2 2v2.401a3 3 0 0 1 1-.36V3a1 1 0 0 1 1-1h3v2.5A1.5 1.5 0 0 0 9.5 6H12v7a1 1 0 0 1-1 1H8.632a3.3 3.3 0 0 1-.804.985L7.81 15H11a2 2 0 0 0 2-2V5.414a1.5 1.5 0 0 0-.44-1.06L9.647 1.439A1.5 1.5 0 0 0 8.586 1zm6.793 4H9.5a.5.5 0 0 1-.5-.5V2.207zM6.5 8a2 2 0 1 1-4 0a2 2 0 0 1 4 0M8 12.5C8 13.745 7 15 4.5 15S1 13.75 1 12.5A1.5 1.5 0 0 1 2.5 11h4A1.5 1.5 0 0 1 8 12.5"
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
	</div>
	<div class="receiver">
		{@render clientIcon()}
	</div>
</div>
<h2>Your Link</h2>
<button
	class="link"
	type="button"
	onclick={() => {
		navigator.clipboard.writeText(link);
		showToast('Link copied to clipboard');
	}}
>
	{link}
</button>
<p>
	Send your link to the person you want to share with. Files are transfered directly, so keep this
	page open until they have completed.
</p>

<h2>Files</h2>
{#if files}
	<FileList files={fileListState} />
{/if}

<style>
	.transfer-status {
		display: flex;
		margin-bottom: var(--spacing-unit);
	}
	.transfer-status .sender,
	.transfer-status .receiver {
		flex: 1;
	}
	.transfer-status .receiver {
		transform: scaleX(-1);
	}
	.transfer-status .transfer {
		flex: 2;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.link {
		appearance: none;
		user-select: all;
		font: var(--font-body);
		font-weight: bold;
		color: var(--color-on-primary);
		padding: 0;
		background: none;
		border: none;
	}
</style>
