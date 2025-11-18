<script lang="ts">
	import '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	interface Props {
		disabled?: boolean;
		chars: string[];
		onLinkCodeEntered?: (linkCode: string) => void;
	}

	let linkCodeFieldset: HTMLFieldSetElement;

	const { disabled, chars = $bindable(Array(4).fill('')), onLinkCodeEntered }: Props = $props();

	const handleLinkCodeCharKeydown = (event: KeyboardEvent, index: number) => {
		const input = event.target as HTMLInputElement;
		// Has to be done on keydown since browsers don't consistently implement beforeinput for deletions
		if (event.key === 'Backspace' || event.key === 'Delete') {
			if (input.value) {
				// If the current input has a value, just clear it
				chars[index] = '';
			} else {
				// Move to previous character on delete
				const prevInput = linkCodeFieldset.querySelector<HTMLInputElement>(
					`input[data-char-index="${index - 1}"]`
				);
				if (prevInput) {
					prevInput.focus();
				}
			}
		}
	};

	const handleLinkCodeCharInput = (event: InputEvent, index: number) => {
		event.preventDefault();

		const input = event.target as HTMLInputElement;
		const char = event.data ?? '';
		const inputType = event.inputType;

		if (inputType === 'insertFromPaste') {
			if (/^[A-Z0-9]{4}$/.test(char)) {
				// Split the code into individual characters and assign them to the inputs
				char.split('').forEach((c, i) => {
					chars[i] = c;
				});
			}
		} else if (inputType === 'insertText') {
			// Allow only alphanumeric characters
			if (!input.value && char && /^[a-zA-Z0-9]$/.test(char)) {
				// Transform to uppercase
				chars[index] = char.toUpperCase();
				// Move to next character after input
				const nextInput = linkCodeFieldset.querySelector<HTMLInputElement>(
					`input[data-char-index="${index + 1}"]`
				);
				if (nextInput) {
					nextInput.focus();
				}

				if (chars.every((c) => c !== '')) {
					// If all characters are filled, consider the code complete
					onLinkCodeEntered?.(chars.join(''));
				}
			}
		}
	};
</script>

<fieldset bind:this={linkCodeFieldset}>
	<legend><strong>Enter Link Code</strong></legend>
	{#each chars as char, index}
		<Input
			{disabled}
			value={char}
			autocomplete="off"
			autocapitalize="characters"
			maxlength={1}
			onkeydown={(event) => handleLinkCodeCharKeydown(event, index)}
			onbeforeinput={(event) => handleLinkCodeCharInput(event, index)}
			data-char-index={index}
			class="input--link-code-char"
		/>
	{/each}
</fieldset>

<style>
	fieldset {
		display: flex;
		justify-content: space-between;
		padding: var(--spacing-unit);
		border: 2px solid var(--color-on-primary);
		border-radius: var(--border-radius);
		gap: var(--spacing-unit);
	}

	fieldset :global(.input--link-code-char) {
		font: var(--font-heading);
		padding: 0;
		text-align: center;
	}
</style>
