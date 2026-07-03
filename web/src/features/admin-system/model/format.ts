/** 字节转人类可读（KB/MB/GB） */
export function fmtBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(decimals)} ${sizes[i]}`;
}

/** 速率（bytes/s）转人类可读 */
export function fmtRate(bytesPerSec: number): string {
    return `${fmtBytes(bytesPerSec)}/s`;
}

/** 百分比格式化 */
export function fmtPercent(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
}

/** 秒数转运行时长（3d 2h） */
export function fmtUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/** ISO 时间转 HH:MM */
export function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/** 纳秒转毫秒（GC 暂停） */
export function fmtNsToMs(ns: number): string {
    return `${(ns / 1e6).toFixed(2)}ms`;
}

/** 根据百分比返回阈值颜色 token */
export function thresholdColor(percent: number): string {
    if (percent > 85) return "var(--destructive)";
    if (percent > 60) return "var(--chart-4)";
    return "var(--chart-2)";
}
