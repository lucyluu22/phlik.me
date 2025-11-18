<script lang="ts">
	import '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';
	import Menu from '$lib/components/Menu.svelte';
	import MenuItem from '$lib/components/MenuItem.svelte';

	const localClient = getLocalClient();

	onMount(() => {
		if (!localClient.isSetup()) {
			goto('/setup', { replaceState: true });
		}
	});
</script>

<Menu>
	<MenuItem>
		<a class="button" href="/send" title="Upload files to another phlick.me client">
			<span class="icon icon-inline icon--upload"></span>
			Send Files
		</a>
	</MenuItem>
	<MenuItem>
		<a class="button" href="/manage" title="Manage linked clients">
			<span class="icon icon-inline icon--link"></span>
			Manage Connected Clients
		</a>
	</MenuItem>
</Menu>
