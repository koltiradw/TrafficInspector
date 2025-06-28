export const prettyBytes = (bytes: number, decimals = 2) => {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

	return `${value} ${sizes[i]}`;
};

export default { prettyBytes };
