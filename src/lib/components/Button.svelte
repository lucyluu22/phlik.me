<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	interface Props extends HTMLButtonAttributes {}
	let { children, ...buttonProps }: Props = $props();
</script>

<button {...buttonProps}>{@render children?.()}</button>

<style>
	button {
		font: var(--font-button);
		padding: var(--spacing-unit);
		border: none;
		border: 2px solid transparent;
		border-radius: var(--border-radius);
		background-color: var(--color-on-primary);
		color: var(--color-primary);
		cursor: pointer;
		transition:
			background-color 0.2s ease-in-out,
			color 0.2s ease-in-out,
			border-color 0.2s ease-in-out;
	}

	button:hover,
	button:focus {
		border-color: var(--color-on-primary);
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		outline: none;
	}

	button:disabled {
		opacity: 0.6;
		pointer-events: none;
	}
</style>
