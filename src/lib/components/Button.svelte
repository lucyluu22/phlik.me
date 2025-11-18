<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	interface Props extends HTMLButtonAttributes {}
	let { children, ...buttonProps }: Props = $props();
</script>

<button {...buttonProps}>{@render children?.()}</button>

<style>
	button,
	:global(.button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-unit);
		font: var(--font-button);
		text-decoration: none;
		text-align: center;
		padding: var(--spacing-unit);
		border: none;
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		cursor: pointer;
		transition:
			background-color 0.2s ease-in-out,
			color 0.2s ease-in-out,
			border-color 0.2s ease-in-out;
	}

	button:hover,
	:global(.button:hover),
	button:focus,
	:global(.button:focus) {
		border-color: transparent;
		background-color: var(--color-on-primary);
		color: var(--color-primary);
		outline: none;
	}

	button:disabled,
	:global(.button:disabled) {
		opacity: 0.6;
		pointer-events: none;
	}

	button:global(.context--danger) {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	button:global(.context--danger):hover,
	button:global(.context--danger):focus {
		background-color: var(--color-danger);
		color: var(--color-on-danger);
	}
</style>
