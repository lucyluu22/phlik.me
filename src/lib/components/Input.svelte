<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: Snippet<[{ id: string }]>;
	}

	const id = $props.id();
	let { label, value = $bindable(), type = 'text', ...inputProps }: Props = $props();
</script>

{@render label?.({ id })}
<input {id} {type} bind:value {...inputProps} />

<style>
	input {
		font: var(--font-input);
		width: 100%;
		padding: var(--spacing-unit);
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		transition: border-color 0.2s ease-in-out;
	}

	input:focus {
		outline: none;
	}

	input:invalid {
		border-color: var(--color-error);
	}
</style>
