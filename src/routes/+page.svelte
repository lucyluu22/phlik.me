<script lang="ts">
	import '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';
	import FileInput from '$lib/components/FileInput.svelte';

	const localClient = getLocalClient();

	onMount(() => {
		if (!localClient.isSetup()) {
			goto('/setup', { replaceState: true });
		}
	});
</script>

<ul role="menu">
	<li role="menuitem">
		<a class="button" href="/send" title="Upload files to another phlick.me client">
			<span class="icon icon--inline icon--upload"></span>
			Send Files
		</a>
	</li>
	<li role="menuitem">
		<a class="button" href="/manage" title="Manage linked clients">
			<span class="icon icon--inline icon--link"></span>
			Manage Linked Clients
		</a>
	</li>
</ul>

<style>
	ul {
		width: 100%;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		display: flex;
		flex-direction: column;
		margin: var(--spacing-unit) 0;
	}
</style>
