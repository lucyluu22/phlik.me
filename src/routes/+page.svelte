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
		<FileInput multiple title="Upload files and send to another phlick.me client">
			<span class="icon icon--inline icon--upload"></span>
			Send Files
		</FileInput>
	</li>
	<li role="menuitem">
		<a class="button" href="/link" title="Generate a link code for another phlick.me client">
			<span class="icon icon--inline icon--link"></span>
			Link Code
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
