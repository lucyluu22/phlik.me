<script lang="ts">
	import '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';
	import Menu from '$lib/components/Menu.svelte';
	import MenuItem from '$lib/components/MenuItem.svelte';
	import Select from '$lib/components/Select.svelte';
	import { getLocalClient } from '$lib/models/LocalClient';
	import FileInput from '$lib/components/FileInput.svelte';
	import { getContext } from './context.svelte';
	import type { EventHandler } from 'svelte/elements';

	const context = getContext();
	const localClient = getLocalClient();

	const clients = localClient.getConnections().sort((a, b) => a.name.localeCompare(b.name));

	const sendFilesViaLink: EventHandler<Event, HTMLInputElement> = (event) => {
		context.files = event.currentTarget.files;
		goto('/send/link');
	};
</script>

<h2>Send Files</h2>
<p>
	You can either generate a link which can be manually sent to anyone, or send directly to one of
	your connected clients.
</p>
<Menu>
	<MenuItem>
		<FileInput multiple onchange={sendFilesViaLink}>
			<span class="icon icon--upload"></span>
			Send Via Link
		</FileInput>
	</MenuItem>
	<MenuItem separator><strong>OR</strong></MenuItem>
	<MenuItem>
		{#if clients.length > 0}
			<label for="client-select" class="sr-only">Select Connected Client</label>
			<Select
				id="client-select"
				placeholder="Select Connected Client"
				options={clients.map((client) => ({ value: client.publicId, label: client.name }))}
			/>
		{:else}
			<a class="button" href="/manage">
				<span class="icon icon--link"></span>
				Connect Your First Client
			</a>
		{/if}
	</MenuItem>
</Menu>

<style>
	:global(select.client-select) {
		text-align: center;
		font: var(--font-button);
	}
</style>
