<script lang="ts">
	import type { HTMLLiAttributes } from 'svelte/elements';
	interface Props extends HTMLLiAttributes {
		separator?: boolean;
	}
	const { separator, children }: Props = $props();
</script>

<li role={separator ? 'separator' : 'menuitem'} class={{ separator }}>
	{@render children?.()}
</li>

<style>
	li {
		display: flex;
		flex-direction: column;
		margin: var(--spacing-unit) 0;
	}
</style>
