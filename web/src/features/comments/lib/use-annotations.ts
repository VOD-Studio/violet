/**
 * useAnnotations —— 批注数据 hook。
 *
 * 接收正文容器 ref 和评论列表，做：
 *  1. 正文渲染后提取 CandidateBlock[]（一次性，缓存）
 *  2. 对每个 anchor 评论调 relocate，得到 located/page-level 结果
 *  3. 返回 { located: LocatedAnnotation[]; pageLevelComments: Comment[] }
 *
 * located 的每个条目含 comment + relocate 结果（blockId/startOffset/endOffset/selectedText），
 * 用于 AnnotationLayer 渲染高亮、AnnotationSidebar 渲染卡片。
 */

import type { Comment } from "@entities/comment/model/types";
import { useEffect, useMemo, useState } from "react";
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

    // 只处理 anchor 非空的顶级评论（批注）。useMemo 稳定引用，避免 comments 引用变化触发死循环。
    const anchorComments = useMemo(
        () => comments.filter((c) => c.anchor && !c.parent_id),
        [comments],
    );

    useEffect(() => {
        const root = contentRef.current;
        if (!root || anchorComments.length === 0) {
            setLocated([]);
            setPageLevelComments([]);
            setBlocks([]);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const candidateBlocks = await extractCandidateBlocks(root);
            if (cancelled) return;

            const locatedList: LocatedAnnotation[] = [];
            const pageList: Comment[] = [];

            for (const comment of anchorComments) {
                // filter 已保证 anchor 存在，但 lint 不识别——显式跳过 undefined
                if (!comment.anchor) continue;
                const anchor = fromCommentAnchor(comment.anchor);
                const result = await relocate(anchor, candidateBlocks);
                if (cancelled) return;
                if (result.kind === "located") {
                    locatedList.push({ comment, anchor, result });
                } else {
                    pageList.push(comment);
                }
            }

            if (cancelled) return;
            setBlocks(candidateBlocks);
            setLocated(locatedList);
            setPageLevelComments(pageList);
            setIsLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [contentRef, anchorComments]);

    return { located, pageLevelComments, blocks, isLoading };
}
