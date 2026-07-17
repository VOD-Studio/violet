/**
 * range-to-anchor —— 把选区数据转成 Anchor 五元组。
 *
 * 浏览器 Selection/Range API 复杂且 jsdom 支持有限，故核心逻辑抽成纯函数
 * buildAnchorFromRange（输入规范化数据），selectionToAnchor 是从真实 Selection
 * 提取数据后调纯函数的薄包装。
 *
 * PRD-0001 锚点定位：单块内选区成功，跨块返回 null（不产生无法稳定锚定的批注）。
 */
import { computeBlockId } from "./block-id";
import type { Anchor } from "./types";

/** 判断两个块是否同一块（blockId 相同且都非空）。 */
export function sameBlock(a: string | null, b: string | null): boolean {
    return a !== null && b !== null && a === b;
}

/** BuildAnchorInput 规范化的选区数据（已从 DOM Selection 提取）。 */
export interface BuildAnchorInput {
    /** 选区所在块的 block_id；null 表示跨块选区 */
    blockId: string | null;
    /** 选区所在块的纯文本；null 表示跨块 */
    blockText: string | null;
    /** 选区起始偏移（块内字符位） */
    startOffset: number;
    /** 选区结束偏移（块内字符位，exclusive） */
    endOffset: number;
}

/**
 * buildAnchorFromRange 纯函数：把规范化选区数据转成 Anchor 五元组。
 *
 * 校验：
 *   - 跨块（blockId/blockText 为 null）→ 返回 null
 *   - startOffset >= endOffset → 返回 null（无效选区）
 *   - offset 越界 → 截断到合法范围（避免 DOM 边界 case 导致 NaN/越界）
 *
 * 返回的 Anchor.blockTextHash 是「块内容快照」，与 blockId 用同一文本计算（未改文章时二者相同）；
 * 这是漂移检测的前提：hash 匹配 → 直接用 offset 快路径，不匹配 → fuzzy 重定位。
 */
export async function buildAnchorFromRange(input: BuildAnchorInput): Promise<Anchor | null> {
    const { blockId, blockText, startOffset, endOffset } = input;

    // 跨块或无效块 → 无法锚定
    if (blockId === null || blockText === null) return null;
    // 无效选区
    if (startOffset >= endOffset) return null;

    const blockTextHash = await computeBlockId(blockText);
    if (blockTextHash === null) return null; // 空块无法锚定

    // offset 越界截断到合法范围
    const len = blockText.length;
    const start = Math.max(0, Math.min(startOffset, len));
    const end = Math.max(start + 1, Math.min(endOffset, len));
    const selectedText = blockText.slice(start, end);

    return {
        blockId,
        startOffset: start,
        endOffset: end,
        selectedText,
        blockTextHash,
    };
}
