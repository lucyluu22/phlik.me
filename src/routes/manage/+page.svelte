<script lang="ts">
	import '$lib/components/Button.svelte';
	import LinkCodeInput from '$lib/components/LinkCodeInput.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { getLocalClient } from '$lib/models/LocalClient';

	const localClient = getLocalClient();
	let connections = $state(localClient.getConnections());

	let linkCodeChars = $state(Array(4).fill(''));
	let linking: boolean = $state(false);

	const linkClient = async (linkCode: string) => {
		linking = true;
		try {
			await localClient.connectClientFromLinkCode(linkCode);
			connections = localClient.getConnections();
		} catch (e) {
			showToast((e as Error).message, Context.danger);
		} finally {
			linking = false;
			linkCodeChars = Array(4).fill('');
		}
	};
</script>

{#if connections.length > 0}
	<h2>Connected Clients</h2>
	<ul>
		{#each connections as connnection}
			<li>
				<span><strong>{connnection.name}</strong> ({connnection.publicId})</span>
				<a href="manage/{connnection.publicId}" class="button">
					<span class="icon icon--cog"></span>
					<span class="sr-only">Configure Client</span>
				</a>
			</li>
		{/each}
	</ul>
	<h2>Link Another Client</h2>
{:else}
	<h2>No Connected Clients</h2>
	<p>
		Link codes are used to establish a trusted connection between clients. A typical use case is
		linking your own desktop and mobile devices. To connect, you can either enter a link code
		generated from another client or generate one yourself.
	</p>
{/if}

<LinkCodeInput
	disabled={linking}
	bind:chars={linkCodeChars}
	onLinkCodeEntered={(code) => linkClient(code)}
/>
{#if linking}
	<Progress />
{/if}
<p><strong>OR</strong></p>
<a href="manage/link" class="button">
	<span class="icon icon--link"></span>
	Generate Link Code
</a>

<style>
	ul {
		text-align: left;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: var(--spacing-unit) 0;
	}
</style>
