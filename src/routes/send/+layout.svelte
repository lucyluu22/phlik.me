<script lang="ts">
	import { context, setContext } from './context.svelte';

	setContext(context);

	const { children } = $props();
</script>

{@render children()}
