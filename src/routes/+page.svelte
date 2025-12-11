<script lang="ts">
	import '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';
	import Menu from '$lib/components/Menu.svelte';
	import MenuItem from '$lib/components/MenuItem.svelte';

	const localClient = getLocalClient();
	const fileStorage = localClient.getFileStorage();
	let fileCount = 0;

	onMount(async () => {
		if (!localClient.isSetup()) {
			goto('/setup', { replaceState: true });
			return;
		}

		fileCount = (await fileStorage.listFiles()).length;
	});
</script>

<Menu>
	<MenuItem>
		<a class="button" href="/send" title="Upload files to another client">
			<span class="icon icon--upload"></span>
			Send Files
		</a>
	</MenuItem>
	<MenuItem>
		<a class="button" href="/files" title="View files sent to this client">
			<span class="icon icon--file"></span>
			View Files
			{#if fileCount > 0}
				<span class="file-count-badge">{fileCount}</span>
			{/if}
		</a>
	</MenuItem>
	<MenuItem separator />
	<MenuItem>
		<a class="button" href="/manage" title="Manage connected clients">
			<span class="icon icon--link"></span>
			Connected Clients
		</a>
	</MenuItem>
</Menu>

<style>
	a {
		position: relative;
	}
	.file-count-badge {
		display: flex;
		position: absolute;
		right: var(--spacing-unit);
		justify-self: flex-end;
		background-color: var(--color-on-primary);
		color: var(--color-primary);
		border-radius: 50%;
		min-width: calc(1rem + var(--spacing-unit));
		min-height: calc(1rem + var(--spacing-unit));
		padding: 0 4px;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	a:hover .file-count-badge,
	a:focus .file-count-badge {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
	}
</style>
