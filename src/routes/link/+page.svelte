<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import { getLocalClient } from '$lib/models/LocalClient';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';

	let loading: boolean = true;
	let error: boolean = false;
	let code: string = '';

	const localClient = getLocalClient();
	const copyLinkCode = async (event: Event) => {
		try {
			await navigator.clipboard.writeText(code);
			showToast('Link code copied to clipboard');
		} catch {
			// If clipboard API fails, user will just select text manually
		}
	};
	const fetchLinkCode = async () => {
		loading = true;
		error = false;
		code = '';

		try {
			const response = await fetch('/api/v1/client/link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					privateId: localClient.getPrivateId()
				})
			});

			loading = false;
			if (!response.ok) {
				error = true;
				showToast(
					`Server responded with ${response.status}: ${response.statusText}`,
					Context.Error
				);
			} else {
				code = (await response.json()).linkCode;
			}
		} catch (e) {
			loading = false;
			error = true;
			showToast('An unexpected error occurred', Context.Error);
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
			<button type="button" class="link-code" title="Copy" onclick={copyLinkCode}>{code}</button>
			<p>
				Enter this generated code on the client that wishes to connect with you. It only works once
				and has a short expiration time.
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
