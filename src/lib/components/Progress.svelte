<script lang="ts">
	import type { HTMLProgressAttributes } from 'svelte/elements';
	const { value, max, ...props }: HTMLProgressAttributes = $props();
</script>

<progress class="sr-only" {value} {max} {...props}></progress>
<div class={{ progress: true, indeterminate: value === undefined }}>
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
		height: 1rem;
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		background-color: var(--color-primary);
		overflow: hidden;
		margin: var(--spacing-unit) 0;
	}
	.indeterminate .progress-bar {
		width: 20%;
		height: 100%;
		background-color: var(--color-info);
		animation: indeterminate 1.5s infinite;
	}
</style>
