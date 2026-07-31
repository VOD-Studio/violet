/**
 * formatDate - 把 ISO 日期格式化为 YYYY-MM-DD（关于页区块共用）
 *
 * 非法日期原样返回，避免吞错。抽公共以消除 ChangelogSection / ProjectTimelineSection 的重复。
 */
export function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}
