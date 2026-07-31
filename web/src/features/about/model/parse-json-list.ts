/**
 * parseJsonList - 解析 {<key>:[...]} 结构的聚合 JSON，容错回退空数组
 *
 * 关于页 B5/B6/B7 等区块的配置（project_stack/blog_numbers/thanks）均为此结构。
 * 后端透明存储原始 JSON，前端在此容错解析——非法 JSON / key 不存在 / 值非数组
 * 都返回空数组，调用方据此降级。
 *
 * 抽到 model 层供多区块组件复用（原先从 ProjectStackSection 导出，跨文件 import 归属不当）。
 */
export function parseJsonList<T>(raw: string | undefined | null, key: string): T[] {
    if (!raw || raw.trim() === "") return [];
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const arr = parsed[key];
        return Array.isArray(arr) ? (arr as T[]) : [];
    } catch {
        return [];
    }
}
