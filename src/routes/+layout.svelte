<script lang="ts">
	import '$lib/styles/theme.css';
	import '$lib/styles/icons.css';

	import { dev } from '$app/environment';
	import { LocalClient, setLocalClient } from '$lib/models/LocalClient';
	import Toast from '$lib/components/Toast.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	const localClient = new LocalClient();
	setLocalClient(localClient);

	onMount(() => {
		// @ts-expect-error Expose localClient for debugging
		if (dev) window.localClient = localClient;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>phlick.me</title>
	<meta name="description" content="A phully anonymous file sharing service." />
</svelte:head>

<Toast />
<header>
	<hgroup>
		<h1 style="--logo: url({logo});">Phlick Me</h1>
		<p>A phully anonymous file sharing service.</p>
	</hgroup>
</header>
<main>
	{@render children()}
</main>

<style>
	header {
		height: 25vh;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		margin-bottom: calc(var(--spacing-unit) * 4);
	}

	header hgroup {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		text-align: center;
	}

	header h1 {
		flex: 1;
		width: 100%;
		margin: 0;
		padding: 0;
		color: transparent;
		mask-image: var(--logo);
		-webkit-mask-image: var(--logo);
		mask-size: contain;
		-webkit-mask-size: contain;
		mask-repeat: no-repeat;
		-webkit-mask-repeat: no-repeat;
		mask-position: center;
		-webkit-mask-position: center;
		background: var(--color-on-primary);
	}

	header p {
		margin: 0;
		padding: 0;
		font-weight: bold;
	}

	main {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
