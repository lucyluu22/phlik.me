<script module>
	export const STATUS_REQUESTING = 'REQUESTING';
	export const STATUS_TRANSFERRING = 'TRANSFERRING';
	export const STATUS_COMPLETED = 'COMPLETED';
	export const STATUS_ERROR = 'ERROR';

	export interface FileListItem {
		id?: string;
		name: string;
		size: number;
		type: string;
		status?: string;
		bytesTransferred?: number;
	}
</script>

<script lang="ts" generics="FileListItemType extends FileListItem = FileListItem">
	import { getHumanReadableSize } from '$lib/utils/getHumanReadableSize';
	import Progress from '$lib/components/Progress.svelte';
	import Button from './Button.svelte';
	import type { Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		files: FileListItemType[];
		fileItemControls?: Snippet<[FileListItemType]>;
		fileItemDetails?: Snippet<[FileListItemType]>;
		onSelectFile?: (file: FileListItemType) => void;
	}

	const { files, fileItemControls, fileItemDetails, onSelectFile }: Props = $props();
	const expandable = !!fileItemDetails;

	const expandState = new SvelteMap<number | string, boolean>();

	const filetypeClassMap: Record<string, string> = {
		image: 'file-list__filetype-image',
		text: 'file-list__filetype-text',
		audio: 'file-list__filetype-audio',
		video: 'file-list__filetype-video',
		'application/zip': 'file-list__filetype-zip',
		'application/x-zip-compressed': 'file-list__filetype-zip',
		'application/gzip': 'file-list__filetype-zip',
		'application/x-gzip': 'file-list__filetype-zip',
		'application/x-bzip': 'file-list__filetype-zip',
		'application/x-bzip2': 'file-list__filetype-zip',
		'application/x-7z-compressed': 'file-list__filetype-zip',
		'application/vnd.rar': 'file-list__filetype-zip',
		'application/x-tar': 'file-list__filetype-zip',
		'application/msword': 'file-list__filetype-text',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			'file-list__filetype-text',
		'application/pdf': 'file-list__filetype-pdf'
	};

	const getFileTypeClass = (file: FileListItem): string | undefined => {
		const [mainType] = file.type.split('/');
		// Check for full type match first
		let match = filetypeClassMap[file.type];
		if (match) return match;
		// Then check for main type match
		match = filetypeClassMap[mainType];
		return match;
	};
</script>

<ul class="file-list">
	{#each files as file, index}
		<li
			class={{
				'file-list__item': true,
				'file-list__item--expanded': expandState.get(file.id ?? index)
			}}
		>
			<span class="file-list__container">
				<span class="file-list__header">
					<button
						class="file-list__select"
						disabled={!onSelectFile}
						onclick={() => onSelectFile?.(file)}
					>
						<span class={['file-list__icon', getFileTypeClass(file)]} title={file.type}>
							<span class="sr-only">{file.type}</span>
						</span>
						<span class="file-list__name">{file.name}</span>
						<span class="file-list__size">
							{#if file.status && file.bytesTransferred !== undefined}
								({getHumanReadableSize(file.bytesTransferred!)} / {getHumanReadableSize(file.size)})
							{:else}
								({getHumanReadableSize(file.size)})
							{/if}
						</span>
					</button>
					{#if expandable}
						<span class="file-list__expand">
							<Button
								onclick={() =>
									expandState.set(file.id ?? index, !expandState.get(file.id ?? index))}
							>
								<span class="icon icon--info"></span>
							</Button>
						</span>
					{/if}
					{#if !expandable && fileItemControls}
						<span class="file-list__controls">
							{@render fileItemControls(file)}
						</span>
					{/if}
				</span>
				{#if expandable && expandState.get(file.id ?? index)}
					<span class="file-list__details">
						{@render fileItemDetails?.(file)}
						{#if fileItemControls}
							<span class="file-list__controls">
								{@render fileItemControls(file)}
							</span>
						{/if}
					</span>
				{/if}
				{#if file.status}
					{#if file.status === STATUS_COMPLETED}
						<p>Transfer Completed</p>
					{:else if file.status === STATUS_ERROR}
						<p class="file-list__error">Transfer Failed</p>
					{:else}
						<span class="file-list__progress">
							<Progress
								max={file.size}
								value={file.status === STATUS_REQUESTING ? undefined : file.bytesTransferred}
							></Progress>
						</span>
					{/if}
				{/if}
			</span>
		</li>
	{/each}
</ul>

<style>
	.file-list {
		text-align: left;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.file-list__item {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-unit);
		margin: var(--spacing-unit) 0;
	}
	.file-list__icon {
		display: block;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		background: var(--color-on-primary);
		mask-image: var(
			--file-icon,
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M8 1v3.5A1.5 1.5 0 0 0 9.5 6H13v7.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-11A1.5 1.5 0 0 1 4.5 1zm1 .25V4.5a.5.5 0 0 0 .5.5h3.25z'/%3E%3C/svg%3E")
		);
		mask-size: contain;
		mask-position: center;
		mask-repeat: no-repeat;
	}
	.file-list__container {
		display: block;
		flex: 1;
		overflow: hidden;
	}
	.file-list__header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-unit);
	}
	button.file-list__select {
		display: flex;
		gap: var(--spacing-unit);
		overflow: hidden;
		width: 100%;
		padding: 0;
		background: inherit;
		font: inherit;
		text-align: left;
		color: inherit;
		border: none;
		cursor: pointer;
		user-select: text;
	}
	button.file-list__select:disabled {
		cursor: default;
	}
	.file-list__details {
		display: block;
		margin-left: calc(2rem + var(--spacing-unit));
		flex: 1;
	}
	.file-list__name {
		flex: 1;
		font-weight: bold;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
	.file-list__item--expanded .file-list__name {
		overflow: visible;
		line-break: anywhere;
		white-space: normal;
	}
	.file-list__size {
		white-space: nowrap;
	}
	.file-list__controls {
		display: flex;
		gap: var(--spacing-unit);
	}
	.file-list__error {
		color: var(--color-danger);
	}

	.file-list__filetype-image {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M4.5 2A2.5 2.5 0 0 0 2 4.5v7c0 .51.152.983.414 1.379l4.384-4.384a1.7 1.7 0 0 1 2.404 0l4.384 4.384A2.5 2.5 0 0 0 14 11.5v-7A2.5 2.5 0 0 0 11.5 2zm7 3.502a1.002 1.002 0 1 1-2.004 0a1.002 1.002 0 0 1 2.004 0m1.379 8.084L8.495 9.202a.7.7 0 0 0-.99 0l-4.384 4.384c.396.262.87.414 1.379.414h7c.51 0 .983-.152 1.379-.414'/%3E%3C/svg%3E");
	}
	.file-list__filetype-pdf {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M2.5 10a1.5 1.5 0 0 1 0 3H2v1.5a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5zM2 12h.5a.5.5 0 0 0 0-1H2zm4-2a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 6 15H5a.5.5 0 0 1-.5-.5v-4A.5.5 0 0 1 5 10zm-.5 4H6a.5.5 0 0 0 .5-.5v-2A.5.5 0 0 0 6 11h-.5zm5.5-4a.5.5 0 0 1 0 1H9.5v1h1a.5.5 0 0 1 0 1h-1v1.5a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 9 10zM9 4.5A1.5 1.5 0 0 0 10.5 6H14v7.5a1.5 1.5 0 0 1-1.5 1.5h-2.087q.085-.236.087-.5V14a1.5 1.5 0 0 0 1.306-2.236A1.497 1.497 0 0 0 11 9H9c-.534 0-1.003.28-1.269.7A2.5 2.5 0 0 0 6 9H5c-.385 0-.735.146-1 .385V2.5A1.5 1.5 0 0 1 5.5 1H9zm4.75.5H10.5a.5.5 0 0 1-.5-.5V1.25z'/%3E%3C/svg%3E");
	}
	.file-list__filetype-text {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M8 4.5V1H4.5A1.5 1.5 0 0 0 3 2.5v11A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V6H9.5A1.5 1.5 0 0 1 8 4.5m1 0V1.25L12.75 5H9.5a.5.5 0 0 1-.5-.5M5.5 8h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1M5 10.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m.5 1.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1'/%3E%3C/svg%3E");
	}
	.file-list__filetype-zip {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M11 11a1 1 0 0 1 1 1v2.75a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25V12l.005-.102A1 1 0 0 1 11 11m1.5-7A2.5 2.5 0 0 1 15 6.5v5a2.5 2.5 0 0 1-2 2.45V12a2 2 0 1 0-4 0v2H3.5A2.5 2.5 0 0 1 1 11.5V7h4.586a1.5 1.5 0 0 0 1.06-.44L9.207 4zM11 10h1.5a.5.5 0 0 0 0-1H11zM9.5 8a.5.5 0 0 0 0 1H11V8zM11 8h1.5a.5.5 0 0 0 0-1H11zM9.5 6a.5.5 0 0 0 0 1H11V6zM5.586 2a1.5 1.5 0 0 1 1.06.44L8 3.792l-2.06 2.06A.5.5 0 0 1 5.585 6H1V4.5A2.5 2.5 0 0 1 3.5 2z'/%3E%3C/svg%3E");
	}
	.file-list__filetype-audio {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M6.235 2.192A1.5 1.5 0 0 0 4 3.499v9a1.5 1.5 0 0 0 2.235 1.308l8-4.5a1.5 1.5 0 0 0 0-2.615z'/%3E%3C/svg%3E");
	}
	.file-list__filetype-video {
		--file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23000' d='M3.5 3A2.5 2.5 0 0 0 1 5.5v5A2.5 2.5 0 0 0 3.5 13h9a2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 12.5 3zm9 2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5M12 9.5a.5.5 0 0 1 1 0v1a.5.5 0 0 1-1 0zM3.5 5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5M3 9.5a.5.5 0 0 1 1 0v1a.5.5 0 0 1-1 0zm4-3c0-.385.346-.626.62-.43l2.206 1.56c.233.165.233.573 0 .738L7.621 9.93C7.346 10.126 7 9.885 7 9.499z'/%3E%3C/svg%3E");
	}
</style>
