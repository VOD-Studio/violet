/**
 * relocate —— 锚点三态重定位机（PRD-0001 风险最高的算法）。
 *
 * 文章改版后，历史批注的 anchor 可能漂移。本模块负责在新版文章的候选块列表里
 * 重新定位 anchor，三态穷尽：
 *
 *   路径 1（hash 匹配，快路径，99% 场景）：
 *     anchor.blockTextHash 与候选块的 blockId 一致 → 文章未改 → 直接用 anchor 的 offset。
 *
 *   路径 2（fuzzy 子串查找，hash 不匹配但内容大致保留）：
 *     在候选块（先按 anchor.blockId 找，找不到则全候选）里用 anchor.selectedText 做子串查找；
 *     多次命中时用前后 16 字 context（即 selectedText 在 anchor 中的前后文）唯一化。
 *
 *   路径 3（降级 page-level，全失败）：
 *     fuzzy 也找不到 → 不丢失内容，作为页面级评论展示（不挂高亮）。
 *
 * 设计取舍：
 *   - 严格子串匹配（非最长公共子串）：前缀/中缀修改导致 selectedText 找不到 → 降级。
 *     保守不误定位优于「猜错位置」。前缀修改的 fuzzy 由后续 issue 增强。
 *   - context 取 selectedText 在 anchor 创建时的前后 16 字——但 anchor 只存了 selectedText
 *     本身，没存 context。本期实现：多次命中且无 context 时，退化到第一个匹配。
 *     完整 context 唯一化需要 anchor 额外存 context 字段（后续增强）。
 */
import type { Anchor } from "./types";

/** RelocateResult 重定位结果（discriminated union）。 */
export type RelocateResult =
    | {
          kind: "located";
          blockId: string;
          startOffset: number;
          endOffset: number;
          selectedText: string;
          /** 是否经过 fuzzy 重定位（true 表示 hash 不匹配，靠子串查找命中） */
          fuzzy: boolean;
      }
    | {
          kind: "page-level";
          /** 降级原因（调试用） */
          reason: "no-candidates" | "not-found";
      };

/** 候选块（运行时从 DOM 提取的块列表）。 */
export interface CandidateBlock {
    id: string;
    text: string;
}

/**
 * relocate 在候选块列表里重新定位 anchor。
 *
 * @param anchor 待重定位的锚点
 * @param blocks 当前文章渲染后的候选块列表
 */
export async function relocate(anchor: Anchor, blocks: CandidateBlock[]): Promise<RelocateResult> {
    if (blocks.length === 0) {
        return { kind: "page-level", reason: "no-candidates" };
    }

    // 路径 1：hash 匹配（快路径）。
    // anchor.blockTextHash 是创建时块的 hash；现在重新算每个候选块的 hash，找匹配。
    // 注：候选块的 id 是「运行时块 hash」，anchor.blockTextHash 是「创建时块 hash」；
    // 二者匹配说明该块未改 → 直接用 anchor 的 offset。
    for (const block of blocks) {
        if (block.id === anchor.blockTextHash) {
            // hash 匹配：offset 直接复用（截断到当前块长度防越界）
            const len = block.text.length;
            const start = Math.max(0, Math.min(anchor.startOffset, len));
            const end = Math.max(start + 1, Math.min(anchor.endOffset, len));
            return {
                kind: "located",
                blockId: block.id,
                startOffset: start,
                endOffset: end,
                selectedText: block.text.slice(start, end),
                fuzzy: false,
            };
        }
    }

    // 路径 2：fuzzy 子串查找。
    // 优先在 anchor.blockId 对应的块里找（如果它还在）；否则遍历所有候选块。
    const orderedBlocks = orderBlocksForFuzzy(anchor, blocks);
    for (const block of orderedBlocks) {
        const hit = fuzzyFind(anchor.selectedText, block.text);
        if (hit !== null) {
            return {
                kind: "located",
                blockId: block.id,
                startOffset: hit.start,
                endOffset: hit.end,
                selectedText: block.text.slice(hit.start, hit.end),
                fuzzy: true,
            };
        }
    }

    // 路径 3：全失败降级
    return { kind: "page-level", reason: "not-found" };
}

/** orderBlocksForFuzzy 把 anchor.blockId 对应的块排在最前（如果存在）。 */
function orderBlocksForFuzzy(anchor: Anchor, blocks: CandidateBlock[]): CandidateBlock[] {
    const preferred = blocks.find((b) => b.id === anchor.blockId);
    if (preferred) {
        return [preferred, ...blocks.filter((b) => b.id !== anchor.blockId)];
    }
    return blocks;
}

/** fuzzyFind 在 text 里查找 selectedText，多次命中退化到第一个。返回 null 表示未命中。 */
function fuzzyFind(selectedText: string, text: string): { start: number; end: number } | null {
    if (!selectedText) return null;
    const start = text.indexOf(selectedText);
    if (start === -1) return null;
    return { start, end: start + selectedText.length };
}
