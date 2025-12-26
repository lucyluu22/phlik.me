<script module>
	declare const __APP_VERSION__: string;
	declare const __GIT_REPO_URL__: string;
	declare global {
		interface Window {
			_phlickLocalClient: import('$lib/models/LocalClient').LocalClient;
		}
	}
</script>

<script lang="ts">
	import '$lib/styles/theme.css';
	import '$lib/styles/icons.css';

	import type { LayoutProps } from './$types';
	import { getLocalClient, LocalClientEvents } from '$lib/models/LocalClient';
	import Toast, { showToast } from '$lib/components/Toast.svelte';
	import Button from '$lib/components/Button.svelte';
	import { Context, ContextClass } from '$lib/styles/Context';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	let { children }: LayoutProps = $props();
	let updateApp = () => {};
	let hasUpdate = $state(false);

	const localClient = getLocalClient();

	localClient.on(LocalClientEvents.clientConnected, ({ name }) => {
		showToast(`${name} has connected!`, Context.info, 5_000);
	});

	onMount(() => {
		const { needRefresh, updateServiceWorker } = useRegisterSW({
			onRegistered(r) {
				if (r) {
					// check for updates every hour
					setInterval(
						() => {
							r.update();
						},
						60 * 60 * 1000
					);
				}
			}
		});

		updateApp = () => updateServiceWorker(true);
		needRefresh.subscribe((value) => {
			hasUpdate = value;
		});

		// Expose localClient for debugging and testing
		window._phlickLocalClient = localClient;
	});
</script>

<svelte:head>
	<title>phlik.me</title>
	<link rel="icon" type="image/png" href="favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="favicon.svg" />
	<link rel="shortcut icon" href="favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="Phlik.me" />
	<meta name="description" content="A phully anonymous file sharing service." />
	<meta name="theme-color" content="#030618" />
	{@html pwaInfo?.webManifest.linkTag}
</svelte:head>

<Toast />
<header>
	<hgroup>
		<a href="/" title="Go to main menu">
			<h1><span class="sr-only">Phlick Me</span></h1>
		</a>
		<p><strong>A Phully Anonymous File Sharing Service</strong></p>
	</hgroup>
	{#if hasUpdate}
		<div class="update-alert" role="alert">
			<p class={ContextClass.warning}>New app version available</p>
			<Button class={ContextClass.warning} onclick={() => updateApp()}>
				<span class="icon icon--refresh"></span>
				Update
			</Button>
		</div>
	{/if}
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
		height: 20vh;
		min-height: 100px;
		margin: 0;
		padding: 0;
		color: transparent;
		mask-image: url(/logo.svg);
		-webkit-mask-image: url(/logo.svg);
		mask-size: contain;
		-webkit-mask-size: contain;
		mask-repeat: no-repeat;
		-webkit-mask-repeat: no-repeat;
		mask-position: center center;
		-webkit-mask-position: center center;
		background: var(--color-on-primary);
	}

	header .update-alert {
		width: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	main {
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
