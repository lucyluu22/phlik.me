<script lang="ts">
	import { getLocalClient } from '$lib/models/LocalClient';
	import FileList, { type FileListItem, STATUS_REQUESTING } from '$lib/components/FileList.svelte';
	import { ContextClass } from '$lib/styles/Context';
	import Button from '$lib/components/Button.svelte';
	import Separator from '$lib/components/Separator.svelte';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';

	interface StoredFile extends FileListItem {
		id: string;
		clientId: string;
		createdAt?: number;
	}

	const localClient = getLocalClient();
	const fileStorage = localClient.getFileStorage();

	let files: StoredFile[] | null = $state(null);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleString();
	};

	const saveFile = async (file: StoredFile) => {
		const fileDataReader = fileStorage.readFileData(file.id);
		if (fileDataReader === null) {
			// This should not happen, but just in case
			showToast('File data missing. Please delete and resend.', Context.danger);
			return;
		}

		const fileParts: ArrayBuffer[] = [];
		const reader = fileDataReader.getReader();
		file.status = STATUS_REQUESTING;
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				const blob = new Blob(fileParts, { type: file.type });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = file.name;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				file.status = undefined;
				break;
			}
			fileParts.push(value);
		}
	};

	const deleteFile = async (file: StoredFile) => {
		file.status = STATUS_REQUESTING;
		await fileStorage.deleteFiles([file.id]);
		files!.splice(
			files!.findIndex((f) => f.id === file.id),
			1
		);
		showToast(`Deleted "${file.name}"`);
	};

	onMount(async () => {
		const storedFiles = await fileStorage.listFiles();
		files = [];
		storedFiles.forEach((file) => {
			files!.push({
				id: file.fileId,
				name: file.name,
				size: file.size,
				type: file.type,
				clientId: file.clientId,
				createdAt: file.createdAt
			});
		});
	});
</script>

{#if files === null}
	<h2>Received Files</h2>
	<p>Loading files...</p>
{:else if files.length > 0}
	<h2>Received Files</h2>
	<FileList {files}>
		{#snippet fileItemControls(file)}
			<Button
				title="Save File"
				disabled={file.status === STATUS_REQUESTING}
				onclick={() => saveFile(file)}
			>
				<span class="icon icon--save"></span>
				<span class="sr-only">Save File</span>
			</Button>
		{/snippet}
		{#snippet fileItemDetails(file)}
			<p>
				<strong>Sent By</strong>
				<br />
				{localClient.getConnection(file.clientId)?.name || `Unknown Client (${file.clientId})`}
			</p>
			<p><strong>Sent On</strong><br />{formatDate(file.createdAt!)}</p>
			<Button
				title="Delete File"
				disabled={file.status === STATUS_REQUESTING}
				class={ContextClass.danger}
				onclick={() => deleteFile(file)}
			>
				<span class="icon icon--trash"></span>
				<span class="sr-only">Delete File</span>
			</Button>
		{/snippet}
	</FileList>
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
	<p>Files sent to this client will be listed here.</p>
{/if}
<Separator />
<a class="button" href="/">Done</a>
