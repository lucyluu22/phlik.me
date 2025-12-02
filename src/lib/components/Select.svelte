<script lang="ts">
	import type { HTMLSelectAttributes, HTMLOptionAttributes } from 'svelte/elements';
	interface Option extends HTMLOptionAttributes {
		value: unknown;
		label?: string;
	}

	interface Props extends HTMLSelectAttributes {
		placeholder?: string;
		options: Option[];
	}

	let { options, value = $bindable(''), placeholder, ...selectProps }: Props = $props();
</script>

<select {...selectProps} bind:value>
	{#if placeholder}
		<option value="" disabled hidden>{placeholder}</option>
	{/if}
	{#each options as { value, label, ...option }}
		<option {value} {...option}>{label ?? value}</option>
	{/each}
</select>

<style>
	select {
		appearance: none; /* Fallback value if base-select is not supported */
		appearance: base-select;
		display: flex;
		justify-content: center;
		font: var(--font-button);
		width: 100%;
		padding: var(--spacing-unit);
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		transition: border-color 0.2s ease-in-out;
		text-align: center;
		text-align-last: center;
	}

	select::picker(select) {
		appearance: base-select;
		background-color: var(--color-primary);
		border-radius: var(--border-radius);
		border: 2px solid var(--color-on-primary);
		padding: 0;
		color: var(--color-on-primary);
		top: calc(anchor(bottom) + var(--spacing-unit));
		text-align: center;
	}

	select::picker-icon {
		display: none;
	}

	option {
		padding: var(--spacing-unit);
	}

	option:hover {
		background-color: var(--color-on-primary);
		color: var(--color-primary);
	}

	option::checkmark {
		display: none;
	}

	@media (pointer: coarse) {
		select::picker(select) {
			/* For touch devices, the system picker is usually better UX */
			appearance: auto;
		}
	}
</style>
