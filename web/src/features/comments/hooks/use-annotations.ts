/**
 * 批注数据重定位 Hook，根据正文 DOM 提取候选块并重新计算批注锚点位置。
 */
import type { Comment } from "@entities/comment/model/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { fromCommentAnchor } from "../lib/anchor-mapper";
import { extractCandidateBlocks } from "../lib/extract-blocks";
import { type CandidateBlock, type RelocateResult, relocate } from "../lib/relocate";
import type { Anchor } from "../lib/types";

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
 * 根据正文容器 DOM 计算全部有效批注的重定位结果。
 *
 * @param contentRef - 正文渲染容器 DOM Ref
 * @param comments - 待定位批注列表（要求 anchor 字段非空）
 *
 * @returns 包含成功定位的 `located` 批注、降级为页面级的 `pageLevelComments`、候选块列表及加载态
 *
 * @example
 * ```tsx
 * const { located, pageLevelComments, isLoading } = useAnnotations(articleRef, annotationComments);
 * ```
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

	// anchorKey：批注 id 列表的内容指纹（含回复批注）。
	// 用作 effect 的 dep（字符串比较，引用稳定），避免 comments 数组引用变化（TanStack refetch）
	// 触发无谓重算。effect 内部直接用 comments（入参已是批注列表）。
	// 含回复批注：回复批注加入时 key 变化，effect 重跑，回复批注才进 located。
	const anchorKey = useMemo(() => comments.map((c) => c.id).join(","), [comments]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 故意只依赖 anchorKey（批注 id 列表的内容指纹）而非 comments 数组引用——避免 TanStack refetch 时 comments 引用变化触发无谓重算（extractCandidateBlocks 昂贵）。effect 内通过闭包读 comments，捕获的是 anchorKey 变化那次的渲染快照，对 relocate 足够。
	useEffect(() => {
		// 入参 comments 已是批注列表（接口层 type=annotation 过滤过）。
		// 含回复批注（继承父 anchor，block_id 与父相同，relocate 会成功定位到同一块）。
		const anchorComments = comments;
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
				// 防御性兜底：约定入参全是批注，但 Comment.anchor 是可选字段，
				// 万一上游误传自由评论，跳过而非崩溃。
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
