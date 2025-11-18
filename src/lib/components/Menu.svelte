<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	interface Props extends HTMLAttributes<HTMLUListElement> {}
	const { children }: Props = $props();
</script>

<ul role="menu">
	{@render children?.()}
</ul>

<style>
	ul {
		width: 100%;
		list-style: none;
		padding: 0;
		margin: 0;
	}
</style>
