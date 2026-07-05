/**
 * useAnnotations —— 批注数据 hook。
 *
 * 接收正文容器 ref 和评论列表，做：
 *  1. 正文渲染后提取 CandidateBlock[]（按正文指纹缓存，正文不变不重算）
 *  2. 对每个 anchor 评论调 relocate（串行），得到 located/page-level 结果
 *  3. 返回 { located: LocatedAnnotation[]; pageLevelComments: Comment[] }
 *
 * located 的每个条目含 comment + relocate 结果（blockId/startOffset/endOffset/selectedText），
 * 用于 AnnotationLayer 渲染高亮、AnnotationSidebar 渲染卡片。
 *
 * 并发模型（串行 + 版本号防竞态）：
 *   - extractCandidateBlocks 昂贵（N 次 crypto.subtle.digest），按正文指纹缓存，正文不变不重算。
 *   - relocate 本身是同步逻辑（包了 async 签名），串行开销小，并行化收益微小但引入 Promise.all 复杂度。
 *   - 竞态用 requestId：每次 effect 自增，async 完成时比对，过期则丢弃——比 cancelled 布尔更精确
 *     （cancelled 只防 unmount，防不了同组件内 anchorComments 快速连续变化）。
 */
import type { Comment } from "@entities/comment/model/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { fromCommentAnchor } from "./anchor-mapper";
import { extractCandidateBlocks } from "./extract-blocks";
import { type CandidateBlock, type RelocateResult, relocate } from "./relocate";
import type { Anchor } from "./types";

export interface LocatedAnnotation {
    comment: Comment;
    anchor: Anchor;
    /** relocate 结果：located 才进这个数组；page-level 进 pageLevelComments */
    result: Extract<RelocateResult, { kind: "located" }>;
}

export interface UseAnnotationsResult {
    located: LocatedAnnotation[];
    /** 降级为页面级评论的批注（anchor 失效，不挂高亮，作为页面级评论展示） */
    pageLevelComments: Comment[];
    /** 候选块列表（用于 findBlockElement 滚动定位） */
    blocks: CandidateBlock[];
    /** 是否仍在 relocate（首次提取 + 计算时为 true） */
    isLoading: boolean;
}

/** CandidateBlock[] 缓存条目：按正文指纹关联。 */
interface BlockCache {
    /** 指纹（正文文本长度 + 首/尾片段），用于判定正文是否变化 */
    fingerprint: string;
    blocks: CandidateBlock[];
}

/** 计算正文指纹：长度 + 前 64 字 + 后 64 字。比完整 hash 快，足够检测内容变化。 */
function contentFingerprint(text: string): string {
    const head = text.slice(0, 64);
    const tail = text.slice(-64);
    return `${text.length}|${head}|${tail}`;
}

/**
 * useAnnotations 计算批注的 relocate 结果。
 *
 * @param contentRef 正文容器 ref
 * @param comments 评论列表（含 anchor 与自由评论；本 hook 只处理 anchor 非空的）
 */
export function useAnnotations(
    contentRef: React.RefObject<HTMLElement | null>,
    comments: Comment[],
): UseAnnotationsResult {
    const [located, setLocated] = useState<LocatedAnnotation[]>([]);
    const [pageLevelComments, setPageLevelComments] = useState<Comment[]>([]);
    const [blocks, setBlocks] = useState<CandidateBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // CandidateBlock[] 缓存：正文指纹不变则复用，避免每次 query invalidate 重算 blockId。
    const blockCacheRef = useRef<BlockCache | null>(null);
    // 竞态版本号：每次 effect 自增，async 完成时比对，过期丢弃。
    const requestIdRef = useRef(0);

    // anchorKey：批注评论 id 列表的内容指纹。
    // 用作 effect 的 dep（字符串比较，引用稳定），避免 comments 数组引用变化（TanStack refetch）
    // 触发无谓重算。effect 内部按 key 重新 filter（filter 很便宜）。
    const anchorKey = useMemo(
        () =>
            comments
                .filter((c) => c.anchor && !c.parent_id)
                .map((c) => c.id)
                .join(","),
        [comments],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: 故意只依赖 anchorKey（批注 id 列表的内容指纹）而非 comments 数组引用——避免 TanStack refetch 时 comments 引用变化触发无谓重算（extractCandidateBlocks 昂贵）。effect 内通过闭包读 comments，捕获的是 anchorKey 变化那次的渲染快照，对 relocate 足够。
    useEffect(() => {
        // 按 key 重新 filter 出当前批注列表（key 变化才进 effect，filter 代价小）
        const anchorComments = comments.filter((c) => c.anchor && !c.parent_id);
        const root = contentRef.current;
        if (!root || anchorComments.length === 0) {
            setLocated([]);
            setPageLevelComments([]);
            setBlocks([]);
            setIsLoading(false);
            return;
        }

        // 分配本次请求的版本号；cleanup 时自增使后续过期结果失效。
        const myRequestId = ++requestIdRef.current;
        const isStale = () => myRequestId !== requestIdRef.current;

        (async () => {
            setIsLoading(true);

            // 1. 提取候选块（按正文指纹缓存）
            const text = root.textContent ?? "";
            const fp = contentFingerprint(text);
            let candidateBlocks: CandidateBlock[];
            if (blockCacheRef.current?.fingerprint === fp) {
                candidateBlocks = blockCacheRef.current.blocks;
            } else {
                candidateBlocks = await extractCandidateBlocks(root);
                if (isStale()) return;
                blockCacheRef.current = { fingerprint: fp, blocks: candidateBlocks };
            }

            // 2. 串行 relocate 每个 anchor
            const locatedList: LocatedAnnotation[] = [];
            const pageList: Comment[] = [];
            for (const comment of anchorComments) {
                if (!comment.anchor) continue;
                const anchor = fromCommentAnchor(comment.anchor);
                const result = await relocate(anchor, candidateBlocks);
                if (isStale()) return; // 期间又有新请求，丢弃本次结果
                if (result.kind === "located") {
                    locatedList.push({ comment, anchor, result });
                } else {
                    pageList.push(comment);
                }
            }

            if (isStale()) return;
            setBlocks(candidateBlocks);
            setLocated(locatedList);
            setPageLevelComments(pageList);
            setIsLoading(false);
        })();
    }, [contentRef, anchorKey]);

    return { located, pageLevelComments, blocks, isLoading };
}
