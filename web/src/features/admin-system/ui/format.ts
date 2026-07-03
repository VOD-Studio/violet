/**
 * format - 服务监控数值格式化纯函数
 *
 * 不依赖 React，便于单元测试。所有函数对边界值（NaN/负数/0）有确定性输出。
 */

/**
 * formatBytes - 字节数转人类可读容量（二进制 KB/MB/GB，1KB=1024B）
 *
 * @param bytes 字节数
 * @param fractionDigits 小数位数，默认 1
 * @returns 形如 "1.5 GB"、"512 MB"；bytes<1024 时回退到 "N B"
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

/**
 * formatRate - 字节/秒速率转人类可读（用 KB/s、MB/s）
 *
 * @param bytesPerSec 每秒字节数
 * @returns 形如 "1.2 MB/s"
 */
export function formatRate(bytesPerSec: number): string {
    return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * formatPercent - 百分比格式化
 *
 * @param value 0-100 的数值
 * @param fractionDigits 小数位数，默认 1
 * @returns 形如 "42.5%"
 */
export function formatPercent(value: number, fractionDigits = 1): string {
    if (!Number.isFinite(value)) return "0%";
    return `${value.toFixed(fractionDigits)}%`;
}

/**
 * formatLatency - 延迟毫秒格式化
 *
 * @param ms 毫秒数（后端 latencyMs）
 * @returns 形如 "2ms"；为 0 时返回 "0ms"
 */
export function formatLatency(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "-";
    return `${ms}ms`;
}

/**
 * formatUptime - 运行时长（秒）转 "Xd Yh" / "Yh Zm"
 *
 * @param seconds 秒数
 * @returns 1 天以上用 "Xd Yh"，否则用 "Yh Zm"；不足 1 分钟返回 "<1m"
 */
export function formatUptime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "-";
    if (seconds < 60) return "<1m";
    const totalMinutes = Math.floor(seconds / 60);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days >= 1) return `${days}d ${hours}h`;
    return `${hours}h ${minutes}m`;
}

/**
 * formatNsToMs - 纳秒（GC 暂停时长）转毫秒字符串
 *
 * @param ns 纳秒
 * @returns 形如 "1.2ms"
 */
export function formatNsToMs(ns: number): string {
    if (!Number.isFinite(ns) || ns < 0) return "0ms";
    return `${(ns / 1_000_000).toFixed(2)}ms`;
}
