export const getHumanReadableSize = (sizeInBytes: number): string => {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = sizeInBytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${Math.round(size)} ${units[unitIndex]}`;
};
