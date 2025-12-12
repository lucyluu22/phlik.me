<script lang="ts">
	import { onMount } from 'svelte';
	import { getContext } from '../context.svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { FileTransferEvents } from '$lib/models/FileTransfer';
	import Progress from '$lib/components/Progress.svelte';
	import { showToast } from '$lib/components/Toast.svelte';
	import Separator from '$lib/components/Separator.svelte';
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
	const transferringClients = new Set<string>();

	let link = $state<string>('');

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_OPENED, (fileName, clientId) => {
		transferringClients.add(clientId);
		fileListState.find((file) => file.name === fileName)!.status = STATUS_TRANSFERRING;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_COMPLETED, (fileName) => {
		const file = fileListState.find((file) => file.name === fileName)!;
		file.bytesTransferred = file.size;
		file.status = STATUS_COMPLETED;
	});

	fileTransferSession.on(FileTransferEvents.FILE_TRANSFER_ERROR, (error, fileName) => {
		const file = fileListState.find((file) => file.name === fileName)!;
		file.status = STATUS_ERROR;
	});

	const transferProgressProps: TransferProgressProps = $derived.by(() => {
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
			label: `Transferring ${transferringFiles.length} File(s)...`
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
					throttle((bytesSent: number, fileName: string) => {
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
		for (const clientId of transferringClients) {
			fileTransfer.closeConnection(clientId);
		}
		if (link) {
			localClient.disposePublicURLPath(link.split('/files/')[1]);
		}
	});
</script>

{#snippet clientIcon()}
	<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16">
		<path
			fill="currentColor"
			d="M6 2h7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8v1h2v1H8v1h3.5a.5.5 0 0 0 0-1H11v-1h2a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2h1V3a1 1 0 0 1 1-1M3.5 12a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1zm-1-6A1.5 1.5 0 0 0 1 7.5v6A1.5 1.5 0 0 0 2.5 15h3A1.5 1.5 0 0 0 7 13.5v-6A1.5 1.5 0 0 0 5.5 6zm0 1h3a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5"
		/>
	</svg>
{/snippet}

{#snippet receiverIcon()}
	<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 20 20">
		<path
			fill="currentColor"
			d="M10 18q.338 0 .668-.027a2 2 0 0 1-1.559-1.319c-.392-.305-.783-.817-1.13-1.562a9.3 9.3 0 0 1-.56-1.592H9v-1H7.206A15 15 0 0 1 7 10c0-.883.073-1.725.206-2.5h5.588c.133.775.206 1.617.206 2.5h1c0-.87-.067-1.712-.193-2.5h2.733c.297.776.46 1.62.46 2.5h1a8 8 0 1 0-8 8m0-15c.657 0 1.407.59 2.022 1.908c.217.466.406 1.002.559 1.592H7.419c.153-.59.342-1.126.56-1.592C8.592 3.59 9.342 3 10 3M7.072 4.485A10.5 10.5 0 0 0 6.389 6.5H3.936a7.02 7.02 0 0 1 3.778-3.118c-.241.33-.456.704-.642 1.103M6.192 7.5A16 16 0 0 0 6 10c0 .87.067 1.712.193 2.5H3.46A7 7 0 0 1 3 10c0-.88.163-1.724.46-2.5zm.197 6c.176.743.407 1.422.683 2.015c.186.399.401.773.642 1.103A7.02 7.02 0 0 1 3.936 13.5zm5.897-10.118A7.02 7.02 0 0 1 16.064 6.5H13.61a10.5 10.5 0 0 0-.683-2.015a6.6 6.6 0 0 0-.642-1.103M10 12a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2v1h.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1h.5v-1h-2a1 1 0 0 1-1-1z"
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
		{@render receiverIcon()}
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
<Separator />
{#if fileListState.every((file) => file.status === STATUS_COMPLETED)}
	<a href="/" class="button">Done</a>
{:else}
	<a href="/" class="button">Cancel</a>
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
	.transfer-status .transfer {
		flex: 2;
		display: flex;
		flex-direction: column;
		justify-content: center;
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
