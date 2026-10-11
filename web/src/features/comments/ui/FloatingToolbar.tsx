/**
 * FloatingToolbar - 选区浮动工具条（划线批注创建入口）。
 *
 * 高频路径，体感关键（PRD-0001 Issue-0006）。零跳转、所见即所得。
 *
 * 行为：
 *   - 监听 mouseup/selectionchange（防抖），选区非空时浮在选区正上方
 *   - 单块判定（selectionToAnchor）：单块 → 启用「划线批注」；跨块 → 置灰 + tooltip「请在同一段落内选择」
 *   - 已登录：点「划线批注」→ 弹出内联输入区（选中原文为引言）→ 提交（带 anchor）→ 高亮落定
 *   - 未登录：按钮变「登录后批注」，点击 login-dialog-store.open()
 *
 * 视觉：bg-surface-glass 毛玻璃 + 描边 + neon 强调。
 */

import { useCreateComment } from "@features/comments/api/mutations";
import { toCreateCommentAnchor } from "@features/comments/lib/anchor-mapper";
import { findBlockElement } from "@features/comments/lib/extract-blocks";
import { clearMarks, wrapRange } from "@features/comments/lib/range-marks";
import {
	clearSelection,
	isSelectionInUnannotatableContainer,
	selectionToAnchor,
} from "@features/comments/lib/selection-to-anchor";
import type { Anchor } from "@features/comments/lib/types";
import { ApiError } from "@shared/api/error";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { Highlighter, LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import "./annotations.css";
import { AnnotationComposer } from "./AnnotationComposer";
import { SelectionHighlight } from "./SelectionHighlight";
import { useExclusivePanel } from "./use-exclusive-panel";

/** 草稿划线 mark 的 class：展开输入区时用暖色荧光笔标出正在批注的文字。 */
const DRAFT_MARK_CLASS = "annotation-draft-mark";

export interface FloatingToolbarProps {
	/** 正文容器 ref（选区必须在此容器内才显示工具条） */
	contentRef: React.RefObject<HTMLElement | null>;
	/** 当前是否登录（决定按钮文案与行为） */
	isLoggedIn: boolean;
	/** 文章 id（提交批注用） */
	postId: string;
}

/** 工具条位置 */
interface ToolbarPos {
	top: number;
	left: number;
}

export function FloatingToolbar({ contentRef, isLoggedIn, postId }: FloatingToolbarProps) {
	const [pos, setPos] = useState<ToolbarPos | null>(null);
	const [anchor, setAnchor] = useState<Anchor | null>(null);
	const [isCrossBlock, setIsCrossBlock] = useState(false);
	const [showInput, setShowInput] = useState(false);
	const [body, setBody] = useState("");
	const toolbarRef = useRef<HTMLDivElement>(null);
	const openLogin = useLoginDialogStore((s) => s.open);
	const createComment = useCreateComment(postId);

	// 缓存最近一次有效选区的 Range，用于滚动时重新定位（滚动不触发 selectionchange）。
	const lastRangeRef = useRef<Range | null>(null);

	/** 用缓存的 Range 重新算工具条视口位置（fixed 定位用视口坐标，滚动后需更新）。 */
	const updatePosFromRange = (range: Range, mode: "above" | "below" = "above") => {
		const rect = range.getBoundingClientRect();
		// 选区已滚出视口（width/height 0 或在视口外）→ 隐藏工具条
		if (rect.width === 0 && rect.height === 0) {
			setPos(null);
			return;
		}
		if (mode === "above") {
			setPos({
				top: rect.top - 48, // 选区上方 48px
				left: rect.left + rect.width / 2,
			});
		} else {
			// below 模式（输入面板展开时）：水平 clamp 到 [160, vw-160] 防气泡溢出
			const halfWidth = 208;
			const left = Math.max(
				halfWidth,
				Math.min(rect.left + rect.width / 2, window.innerWidth - halfWidth),
			);
			setPos({
				top: rect.bottom + 8,
				left,
			});
		}
	};

	// 监听选区变化 + 滚动跟随。
	// biome-ignore lint/correctness/useExhaustiveDependencies: 故意只依赖 [contentRef, showInput]——updatePosFromRange 是无状态的工具函数（只读 pos state），不需要进 deps；scroll handler 通过 closure 捕获最新 showInput。
	useEffect(() => {
		let rafId = 0;
		const handleSelectionChange = () => {
			// 输入面板展开时不响应新选区（避免用户在 textarea 里选词触发工具条）
			if (showInput) return;
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(async () => {
				const root = contentRef.current;
				if (!root) return;

				const selection = window.getSelection();
				if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
					lastRangeRef.current = null;
					setPos(null);
					setAnchor(null);
					setIsCrossBlock(false);
					return;
				}

				// 选区必须在正文容器内
				const range = selection.getRangeAt(0);
				if (!root.contains(range.commonAncestorContainer)) {
					lastRangeRef.current = null;
					setPos(null);
					return;
				}

				// 不可批注容器（代码块/图块/块级公式）→ 直接隐藏，不置灰。
				// 区别于跨块：跨块是用户选了多段（置灰 + 提示），这里选的是单个不可批注块，
				// 置灰 tooltip "请在同一段落内选择" 会误导用户，应直接消失。
				if (isSelectionInUnannotatableContainer(range)) {
					lastRangeRef.current = null;
					setPos(null);
					setAnchor(null);
					setIsCrossBlock(false);
					return;
				}

				// 缓存 Range 供滚动重定位用
				lastRangeRef.current = range.cloneRange();

				// 算 anchor（含跨块判定）
				const result = await selectionToAnchor({ root });
				if (result) {
					setAnchor(result);
					setIsCrossBlock(false);
				} else {
					setAnchor(null);
					setIsCrossBlock(true);
				}

				updatePosFromRange(range, "above");
			});
		};

		// 滚动时用缓存的 Range 重新算视口位置（fixed 定位跟随）。
		// capture: true 捕获阶段监听，避免被正文里的 stopPropagation 拦截。
		// 注意：scroll handler 不受 showInput 影响——输入面板展开时也要跟随滚动。
		const handleScroll = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				if (lastRangeRef.current) {
					// 输入面板展开时定位到选区下方（与 handleAnnotate 一致），否则上方
					updatePosFromRange(lastRangeRef.current, showInput ? "below" : "above");
				}
			});
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
			window.removeEventListener("scroll", handleScroll, { capture: true });
			cancelAnimationFrame(rafId);
		};
	}, [contentRef, showInput]);

	/** 把选区文字标成草稿划线（textarea 获得焦点后浏览器选区视觉会淡化，需要持续可见）。 */
	const addDraftMark = async (target: Anchor) => {
		const root = contentRef.current;
		if (!root) return;
		const el = await findBlockElement(root, target.blockId);
		if (el)
			wrapRange(el, { start: target.startOffset, end: target.endOffset }, DRAFT_MARK_CLASS);
	};

	/** 清除草稿划线（提交/取消时调用）。 */
	const clearDraftMark = () => {
		if (contentRef.current) clearMarks(contentRef.current, DRAFT_MARK_CLASS);
	};

	/** 点「划线批注」：登录展开输入区；未登录弹登录窗 */
	const handleAnnotate = () => {
		if (!anchor || isCrossBlock) return;
		// 重新定位到选区下方（输入区高度大，放上方会被视口顶部裁剪）。
		// 此时选区因 onMouseDown preventDefault 仍保留，可重新测量。
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			const rect = selection.getRangeAt(0).getBoundingClientRect();
			if (rect.width > 0 || rect.height > 0) {
				// 水平 clamp：气泡宽 320（w-80），居中需 left 在 [160, vw-160] 范围，
				// 否则 translate-x-1/2 会让气泡溢出视口左/右边界。
				const halfWidth = 208;
				const left = Math.max(
					halfWidth,
					Math.min(rect.left + rect.width / 2, window.innerWidth - halfWidth),
				);
				setPos({
					top: rect.bottom + 8, // 选区下方 8px
					left,
				});
			}
		}
		if (isLoggedIn) void addDraftMark(anchor);
		setShowInput(true);
		setBody("");
	};

	/** 提交批注 */
	const handleSubmit = () => {
		if (!anchor || !body.trim()) return;
		createComment.mutate(
			{ body: body.trim(), anchor: toCreateCommentAnchor(anchor) },
			{
				onSuccess: (created) => {
					toast.success(
						created.status === "pending" ? "批注已提交，等待审核" : "批注已提交",
					);
					clearDraftMark();
					setShowInput(false);
					setBody("");
					setPos(null);
					setAnchor(null);
					clearSelection();
				},
				onError: (err) => {
					const msg = err instanceof ApiError ? err.message : "提交失败";
					toast.error(msg);
				},
			},
		);
	};

	/** 取消输入 */
	const handleCancel = () => {
		clearDraftMark();
		setShowInput(false);
		setBody("");
		setPos(null);
		setAnchor(null);
		clearSelection();
	};

	useExclusivePanel("selection", showInput, handleCancel);

	// 无选区或输入区关闭 → 只保留选区笔触覆盖层
	if (!pos) return <SelectionHighlight contentRef={contentRef} />;

	return (
		<>
			<SelectionHighlight contentRef={contentRef} />
			<div
				ref={toolbarRef}
				className="fixed z-50 -translate-x-1/2"
				style={{ top: pos.top, left: pos.left }}
				role="toolbar"
				aria-label="批注工具"
			>
				{showInput && anchor ? (
					<AnnotationComposer
						title="划线批注"
						quote={anchor.selectedText}
						body={body}
						onBodyChange={setBody}
						onSubmit={handleSubmit}
						onCancel={handleCancel}
						pending={createComment.isPending}
						loginRequired={!isLoggedIn}
						onLogin={() => {
							handleCancel();
							openLogin();
						}}
					/>
				) : (
					/* 浮动工具条（划线批注按钮） */
					<div className="annotation-pop flex items-center rounded-full bg-card/90 px-1.5 py-1 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10">
						<button
							type="button"
							onClick={handleAnnotate}
							// preventDefault 防止 mousedown 破坏选区——
							// 否则点击瞬间选区被清，selectionchange 触发把 pos 清空，
							// 展开的输入气泡就丢失了「紧贴选区」的定位。
							onMouseDown={(e) => e.preventDefault()}
							disabled={isCrossBlock}
							title={isCrossBlock ? "请在同一段落内选择" : "划线批注"}
							className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isLoggedIn ? (
								<>
									<Highlighter className="size-3.5" />
									划线批注
								</>
							) : (
								<>
									<LogIn className="size-3.5" />
									登录后批注
								</>
							)}
						</button>
					</div>
				)}
			</div>
		</>
	);
}

export default FloatingToolbar;
