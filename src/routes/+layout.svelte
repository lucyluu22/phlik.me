<script module>
	declare const __APP_VERSION__: string;
	declare const __GIT_REPO_URL__: string;
</script>

<script lang="ts">
	import '$lib/styles/theme.css';
	import '$lib/styles/icons.css';

	import type { LayoutProps } from './$types';
	import { dev } from '$app/environment';
	import { getLocalClient, LocalClientEvents } from '$lib/models/LocalClient';
	import Toast, { showToast, Context } from '$lib/components/Toast.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.svg';
	import { onMount } from 'svelte';

	let { children }: LayoutProps = $props();

	const localClient = getLocalClient();

	localClient.on(LocalClientEvents.clientConnected, ({ name }) => {
		showToast(`${name} has connected!`, Context.info, 5_000);
	});

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
		<a href="/" title="Phlick Me">
			<h1 style="--logo: url({logo});">Phlick Me</h1>
		</a>
		<p>A phully anonymous file sharing service.</p>
	</hgroup>
</header>
<main>
	{@render children()}
</main>
<footer>
	<p>
		<abbr title="Version">v</abbr>{__APP_VERSION__} |
		<a href={__GIT_REPO_URL__} target="_blank">
			<span class="icon icon-inline icon--github"></span> GitHub
		</a>
	</p>
</footer>

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

	header a {
		display: block;
		flex: 1;
		text-decoration: none;
	}

	header h1 {
		width: 100%;
		height: 100%;
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
		text-align: center;
	}

	footer {
		position: absolute;
		top: 0;
		left: 0;
	}

	footer p {
		margin: 0;
		padding: var(--spacing-unit);
		font-weight: bold;
	}

	footer a {
		text-decoration: none;
		color: inherit;
	}
</style>
