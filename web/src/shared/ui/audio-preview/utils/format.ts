/**
 * 音频时间格式化工具
 */

/** 秒数格式化为 m:ss 或 h:mm:ss */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, "0");
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
	return `${m}:${ss}`;
}
