/**
 * block-id —— 选区批注锚点的块标识符。
 *
 * block_id = SHA-256(块纯文本)[:8]，作为锚点挂在选区所在块级元素上的稳定标识。
 *
 * 为什么用 SHA-256 而非 PRD 原写的 SHA-1：
 *   Web Crypto API 的 crypto.subtle.digest 不支持 SHA-1（仅 SHA-256/384/512）。
 *   block_id 的用途是「跨渲染稳定识别块」，不涉及 SHA-1 的特定兼容性；
 *   SHA-256 取前 8 位 hex（32 bit）碰撞概率与 SHA-1 同级，完全满足需求，
 *   且与项目现有 upload/lib/sha256.ts 范式一致，零依赖、jsdom 测试友好。
 *
 * 跨 SSR/客户端一致性：基于纯文本计算，不依赖 DOM runtime-only API，
 * 同一篇 MD 源文无论在哪端渲染都生成同一 block_id。
 */
const BLOCK_ID_LENGTH = 8;

/**
 * computeBlockId 计算块纯文本的 block_id（SHA-256 前 8 位 hex）。
 *
 * @param text 块级元素的纯文本内容（<p>/<h2>/<li>/<pre> 等）
 * @returns 8 位 hex 字符串；空/纯空白文本返回 null（约定哨兵，避免空段撞同一 id）
 */
export async function computeBlockId(text: string): Promise<string | null> {
    const trimmed = text.trim();
    if (trimmed === "") return null;

    const data = new TextEncoder().encode(trimmed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, BLOCK_ID_LENGTH);
}
