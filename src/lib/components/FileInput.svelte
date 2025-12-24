<script lang="ts">
	import './Button.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {}

	const id = $props.id();
	let { children, files = $bindable(), title, ...props }: Props = $props();
</script>

<input {id} type="file" class="sr-only" bind:files {...props} />
<label class="button" for={id} {title} data-testid="file-input-label">
	{@render children?.()}
</label>
