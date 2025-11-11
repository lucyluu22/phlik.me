<script lang="ts">
	import './Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {}
	let { children, title, ...props }: Props = $props();
</script>

<Input type="file" class="sr-only" {...props}>
	{#snippet label({ id })}
		<label class="button" for={id} {title}>
			{@render children?.()}
		</label>
	{/snippet}
</Input>
