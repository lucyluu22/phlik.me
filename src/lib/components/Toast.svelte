<script module>
	let toastTimeoutId: ReturnType<typeof setTimeout>;

	// Only a single toast should be rendered at the root
	export const globalToastState = $state<{ show: boolean; context: Context; message: string }>({
		show: false,
		context: Context.info,
		message: ''
	});

	/**
	 * Show a toast message
	 * @param msg - The message to display
	 * @param ctx - The context of the toast (e.g., info, error)
	 * @param duration - The duration to display the toast (in milliseconds)
	 */
	export function showToast(msg: string, ctx: Context = Context.info, duration: number = 3000) {
		if (toastTimeoutId) {
			clearTimeout(toastTimeoutId);
		}

		globalToastState.message = msg;
		globalToastState.context = ctx;
		globalToastState.show = true;
		toastTimeoutId = setTimeout(() => {
			globalToastState.show = false;
		}, duration);
	}

	export { Context } from '$lib/styles/Context'; // Re-export Context enum for convenience
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import { Context, ContextClass } from '$lib/styles/Context';
</script>

{#if globalToastState.show}
	<output
		transition:slide={{ duration: 200 }}
		aria-live={globalToastState.context === Context.danger ? 'assertive' : 'polite'}
		class={ContextClass[globalToastState.context]}
	>
		{globalToastState.message}
	</output>
{/if}

<style>
	output {
		font: var(--font-alert);
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		width: 100dvw;
		text-align: center;
		opacity: var(--opacity);
		padding: var(--spacing-unit);
		z-index: 999;
	}
	output.context--info {
		background-color: var(--color-info);
		color: var(--color-on-info);
	}
	output.context--danger {
		background-color: var(--color-danger);
		color: var(--color-on-danger);
	}
	output.context--warning {
		background-color: var(--color-warning);
		color: var(--color-on-warning);
	}
</style>
