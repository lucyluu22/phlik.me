<script lang="ts">
	import { goto } from '$app/navigation';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
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
		const response = await fetch('/api/v1/client/create', {
			method: 'POST'
		});

		if (response.ok) {
			const clientData = await response.json();
			localClient.setup({
				name: clientName,
				publicId: clientData.publicId,
				privateId: clientData.privateId
			});
			showToast(`${clientName} is now ready!`);
			goto('/', { replaceState: true });
		} else {
			showToast('Client setup failed. Please try again.', Context.danger);
		}
	}}
>
	<Input bind:value={clientName} required autofocus aria-describedby="client-name-help">
		{#snippet label()}
			<h2>Name This Client</h2>
		{/snippet}
	</Input>
	<p id="client-name-help">
		Call it whatever is meaningful to you. The name is only stored locally and shared when you link
		another client.
	</p>
	<Button type="submit">Submit</Button>
</form>

<style>
	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
