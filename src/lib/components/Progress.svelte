<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLProgressAttributes } from 'svelte/elements';
	interface Props extends HTMLProgressAttributes {
		value?: number;
		max?: number;
		label?: Snippet;
	}

	const { value, max = 100, label, ...props }: Props = $props();
	const id = $props.id();
</script>

{#if label}
	<label for={id}>{@render label()}</label>
{/if}
<progress {id} class="sr-only" {value} {max} {...props}></progress>
<div
	class={{ progress: true, indeterminate: value === undefined }}
	style="--progress-value: {value}; --progress-max: {max};"
>
	<div class="progress-bar"></div>
</div>

<style>
	@keyframes indeterminate {
		0% {
			margin-left: -20%;
		}
		50% {
			margin-left: 40%;
		}
		100% {
			margin-left: 100%;
		}
	}

	.progress {
		font: var(--font-input);
		width: 100%;
		height: max(var(--spacing-unit), 1rem);
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		background-color: var(--color-primary);
		overflow: hidden;
		margin: var(--spacing-unit) 0;
	}

	.progress .progress-bar {
		width: calc((var(--progress-value, 0) / var(--progress-max, 100)) * 100%);
		height: 100%;
		background-color: var(--color-info);
		transition: width 0.3s ease-in-out;
		display: flex;
	}

	.progress.indeterminate .progress-bar {
		width: 20%;
		animation: indeterminate 1.5s infinite;
	}
</style>
