<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: Snippet<[{ id: string }]>;
		addon?: Snippet<[{ addonClass: string }]>;
	}

	const id = $props.id();
	let { label, addon, value = $bindable(), type = 'text', ...inputProps }: Props = $props();
</script>

{#if label}
	<label for={id}>
		{@render label?.({ id })}
	</label>
{/if}
<div class="input-wrapper">
	<input {id} {type} bind:value {...inputProps} />
	{@render addon?.({ addonClass: 'input-addon' })}
</div>

<style>
	label {
		display: block;
		margin-bottom: var(--spacing-unit);
	}

	.input-wrapper {
		display: flex;
		align-items: stretch;
		width: 100%;
	}

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
		border-color: var(--color-danger);
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	input:not(:only-child) {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
		border-right: none;
	}

	input + :global(.input-addon) {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}
</style>
