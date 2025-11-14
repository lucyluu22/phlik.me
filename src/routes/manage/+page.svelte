<script lang="ts">
	import '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import { showToast, Context } from '$lib/components/Toast.svelte';
	import { getLocalClient } from '$lib/models/LocalClient';

	const localClient = getLocalClient();

	const linkChars: string[] = $state(Array(4).fill(''));
	let linking: boolean = $state(false);

	const linkClient = async (linkCode: string) => {
		linking = true;
		try {
			await localClient.connectClientFromLinkCode(linkCode);
		} catch (e) {
			showToast((e as Error).message, Context.Error);
		} finally {
			linking = false;
			linkChars.fill('');
		}
	};

	const handleLinkCodeCharKeydown = (event: KeyboardEvent, index: number) => {
		const input = event.target as HTMLInputElement;
		// Has to be done on keydown since browsers don't consistently implement beforeinput for deletions
		if (event.key === 'Backspace' || event.key === 'Delete') {
			if (input.value) {
				// If the current input has a value, just clear it
				linkChars[index] = '';
			} else {
				// Move to previous character on delete
				const prevInput = input.previousElementSibling as HTMLInputElement;
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
					linkChars[i] = c;
				});
			}
		} else if (inputType === 'insertText') {
			// Allow only alphanumeric characters
			if (!input.value && char && /^[a-zA-Z0-9]$/.test(char)) {
				// Transform to uppercase
				linkChars[index] = char.toUpperCase();
				// Move to next character after input
				const nextInput = input.nextElementSibling as HTMLInputElement;
				if (nextInput) {
					nextInput.focus();
				}

				if (linkChars.every((c) => c !== '')) {
					// If all characters are filled, attempt to link the client
					linkClient(linkChars.join(''));
				}
			}
		}
	};
</script>

<p>Before you can send files, you need to link to atleast one other client.</p>
<p>
	Link codes are used to establish a trusted connection between clients. You can either enter a link
	code generated from another client or generate one yourself.
</p>
<fieldset>
	<legend><strong>Enter Link Code</strong></legend>
	{#each linkChars as char, index}
		<Input
			value={char}
			disabled={linking}
			autocomplete="off"
			autocapitalize="characters"
			maxlength={1}
			onkeydown={(event) => handleLinkCodeCharKeydown(event, index)}
			onbeforeinput={(event) => handleLinkCodeCharInput(event, index)}
			class="input--link-code-char"
		/>
	{/each}
</fieldset>
{#if linking}
	<Progress />
{/if}
<p><strong>OR</strong></p>
<a href="manage/link" class="button"
	><span class="icon icon--inline icon--link"></span>
	Generate Link Code</a
>

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
