<script lang="ts">
	import { goto } from '$app/navigation';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { onMount } from 'svelte';
	import { ContextClass } from '$lib/styles/Context';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import MenuItem from '$lib/components/MenuItem.svelte';
	import Separator from '$lib/components/Separator.svelte';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const localClient = getLocalClient();
	let connection = $state(localClient.getConnection(params.clientId));
	let renameClientInput = $state('');
	let confirmDisconnect = $state(false);

	const renameClient = (event: SubmitEvent) => {
		event.preventDefault();
		localClient.updateConnectionName(params.clientId, renameClientInput);
		connection = localClient.getConnection(params.clientId);
		renameClientInput = '';
		showToast('Client renamed');
	};

	onMount(() => {
		if (!connection) {
			// Route away if the clientId is not a connection
			goto('/manage', { replaceState: true });
		}
	});
</script>

<hgroup>
	<h2>{connection?.name}</h2>
	<p>{params.clientId}</p>
</hgroup>

<Menu>
	<MenuItem>
		<form action="" onsubmit={renameClient}>
			<Input
				bind:value={renameClientInput}
				name="client-name"
				aria-describedby="rename-client-help-text"
			>
				{#snippet label()}
					<strong>Rename Client</strong>
				{/snippet}
				{#snippet addon({ addonClass })}
					<Button type="submit" class={addonClass}>
						<span class="icon icon--check"></span>
						<span class="sr-only">Submit</span>
					</Button>
				{/snippet}
			</Input>
			<p id="rename-client-help-text">
				The default is the client's name when they connected, but you can refer to this client
				however you like.
			</p>
		</form>
	</MenuItem>
	<MenuItem separator />
	<MenuItem>
		{#if confirmDisconnect}
			<p class={ContextClass.danger}>Are you sure you want to disconnect this client?</p>
			<p>
				The client will be removed from your connected clients and you will need to relink with them
				again.
			</p>
			<div class="confirm-disconnect-buttons">
				<Button
					class={ContextClass.danger}
					onclick={() => {
						localClient.disconnectClient(params.clientId);
						showToast('Client disconnected', Context.danger);
						goto('/manage', { replaceState: true });
					}}
				>
					<span class="icon icon--trash"></span>
					Confirm Disconnect
				</Button>
				<Button onclick={() => (confirmDisconnect = false)}>Cancel</Button>
			</div>
		{:else}
			<Button class={ContextClass.danger} onclick={() => (confirmDisconnect = true)}>
				<span class="icon icon--trash"></span>
				Disconnect Client
			</Button>
		{/if}
	</MenuItem>
</Menu>
<Separator />
<a href="/manage" class="button">Done</a>

<style>
	.confirm-disconnect-buttons {
		display: flex;
		gap: var(--spacing-unit);
		margin-top: var(--spacing-unit);
	}
	.confirm-disconnect-buttons > :global(button) {
		flex: 1;
	}
</style>
