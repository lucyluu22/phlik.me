<script lang="ts">
	import { goto } from '$app/navigation';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Separator from '$lib/components/Separator.svelte';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';

	const localClient = getLocalClient();

	onMount(() => {
		if (localClient.isSetup()) {
			showToast('Client is already setup!', Context.info);
			goto('/', { replaceState: true });
		}
	});
	let clientName = $state('');
</script>

<form
	method="POST"
	onsubmit={async (event) => {
		event.preventDefault();
		try {
			await localClient.setup(clientName);
			showToast(`${clientName} is now ready!`);
			goto('/', { replaceState: true });
		} catch {
			showToast('Client setup failed. Please try again.', Context.danger);
		}
	}}
>
	<Input bind:value={clientName} required aria-describedby="client-name-help">
		{#snippet label()}
			<h2>Name This Client</h2>
		{/snippet}
	</Input>
	<p id="client-name-help">
		A "client" represents this specific device, call it whatever is meaningful to you. The client
		name is only stored locally and shared with other clients you link to.
	</p>
	<Separator />
	<Button type="submit">Submit</Button>
</form>

<style>
	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
</style>
