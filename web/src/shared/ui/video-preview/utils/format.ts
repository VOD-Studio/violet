/**
 * 媒体时间/大小格式化工具
 */

/**
 * 秒数格式化为 mm:ss 或 h:mm:ss
 */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, "0");
	if (h > 0) {
		const mm = String(m).padStart(2, "0");
		return `${h}:${mm}:${ss}`;
	}
	return `${m}:${ss}`;
}

/**
 * 字节数格式化为人类可读大小
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}
