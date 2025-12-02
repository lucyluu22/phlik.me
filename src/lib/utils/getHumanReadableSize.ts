export const getHumanReadableSize = (sizeInBytes: number): string => {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = sizeInBytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	const decimalPlaces = size < 10 && unitIndex > 0 ? 2 : size < 100 && unitIndex > 0 ? 1 : 0;
	size = parseFloat(size.toFixed(decimalPlaces));

	return `${size} ${units[unitIndex]}`;
};
