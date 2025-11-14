<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import { getLocalClient, LocalClientEvents } from '$lib/models/LocalClient';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let loading: boolean = false;
	let error: boolean = false;
	let linkCode: string = '';

	const localClient = getLocalClient();

	localClient.on(LocalClientEvents.clientConnected, () => {
		// If a client connects while on this page, we can assume it was using the generated link code.
		// For convenience, navigate back to the manage page.
		goto('/manage', { replaceState: true });
	});

	const copyLinkCode = async () => {
		try {
			await navigator.clipboard.writeText(linkCode);
			showToast('Link code copied to clipboard');
		} catch {
			// If clipboard API fails, user will just copy text manually
		}
	};

	const fetchLinkCode = async () => {
		loading = true;
		error = false;
		linkCode = '';

		try {
			linkCode = await localClient.generateLinkCode();
			loading = false;
		} catch (e) {
			loading = false;
			error = true;
			showToast((e as Error).message, Context.Error);
		}
	};

	onMount(fetchLinkCode);
</script>

{#if loading}
	<label for="generate-link-progress">Generating Link...</label>
	<Progress id="generate-link-progress" />
{/if}
<output aria-busy={loading} aria-describedby="generate-link-progress">
	{#if !loading}
		{#if error}
			<h2>Error Generating Link Code</h2>
		{:else}
			<h2>Your Link Code</h2>
			<button type="button" class="link-code" title="Copy" onclick={copyLinkCode}>{linkCode}</button
			>
			<p>
				Enter this generated code on the client you wish to connect with. It only works once and has
				a short expiration time.
			</p>
		{/if}
	{/if}
</output>
{#if !loading}
	{#if error}
		<Button onclick={fetchLinkCode}>Retry</Button>
	{:else}
		<a class="button" href="/">Done</a>
	{/if}
{/if}

<style>
	label {
		font: var(--font-subheading);
		display: block;
		margin: var(--spacing-unit) 0;
	}

	output {
		text-align: center;
	}

	button.link-code {
		user-select: all;
		padding: 0;
		background-color: transparent;
		color: var(--color-on-primary);
		border: none;
		font: var(--font-heading);
	}
</style>
