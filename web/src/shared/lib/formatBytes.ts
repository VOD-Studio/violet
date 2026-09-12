/**
 * 将字节数转换为二进制容量单位；非有限值和负数按 `0 B` 处理。
 *
 * @param fractionDigits 1024 字节及以上数值的小数位数
 * @default 1
 */
export function formatBytes(bytes: number, fractionDigits = 1): string {
	if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB", "PB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}
