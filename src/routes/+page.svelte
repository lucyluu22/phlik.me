<script lang="ts">
	import { goto } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';

	const localClient = getLocalClient();

	onMount(() => {
		if (!localClient.isSetup()) {
			goto('/setup', { replaceState: true });
		}
	});
</script>
