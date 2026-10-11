import { useCreateComment } from "@features/comments/api/mutations";
import { toCreateCommentAnchor } from "@features/comments/lib/anchor-mapper";
import { computeBlockId } from "@features/comments/lib/block-id";
import { getBlockText } from "@features/comments/lib/extract-blocks";
import { buildAnchorFromRange } from "@features/comments/lib/range-to-anchor";
import { closestAnnotatableBlock } from "@features/comments/lib/selection-to-anchor";
import { ApiError } from "@shared/api/error";
import { MessageSquareText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnnotationComposer } from "./AnnotationComposer";
import { useExclusivePanel } from "./use-exclusive-panel";

/** 鼠标离开正文后入口延迟隐藏的时间，留给指针移向入口按钮。 */
const HIDE_DELAY_MS = 200;
/** 入口纵向对齐块首行的偏移，px */
const TOP_OFFSET_PX = 2;
/** 输入面板与所批注段落底边的间距，px */
const COMPOSER_GAP_PX = 8;
const DRAFT_CLASS = "annotation-draft-highlight";

export interface BlockCommentTriggerProps {
	contentRef: React.RefObject<HTMLElement | null>;
	/** 覆盖层元素：入口的纵向坐标相对它计算 */
	layerRef: React.RefObject<HTMLElement | null>;
	/** 已有批注的块元素；这些块由头像角标承担入口，不再显示新建入口 */
	annotatedBlocks: ReadonlySet<HTMLElement>;
	isLoggedIn: boolean;
	postId: string;
}

/**
 * BlockCommentTrigger - 鼠标悬停某段时在右侧边距出现的「段评」入口。
 *
 * 点击后在入口下方展开输入面板，对整段文字发表批注（锚点覆盖全块）。
 * 入口与面板都不进正文流，悬停时正文不位移。
 */
export function BlockCommentTrigger({
	contentRef,
	layerRef,
	annotatedBlocks,
	isLoggedIn,
	postId,
}: BlockCommentTriggerProps) {
	const [hovered, setHovered] = useState<HTMLElement | null>(null);
	const [top, setTop] = useState(0);
	/** 面板挂在覆盖层里，随页面一起滚动；top 是相对覆盖层的纵向位置 */
	const [composer, setComposer] = useState<{ block: HTMLElement; top: number } | null>(null);
	const [body, setBody] = useState("");
	const hideTimer = useRef<number | undefined>(undefined);
	const createComment = useCreateComment(postId);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		let frame = 0;
		const onMove = (event: MouseEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				clearTimeout(hideTimer.current);
				const block = closestAnnotatableBlock(event.target, root);
				setHovered((cur) => (cur === block ? cur : block));
			});
		};
		const onLeave = () => {
			clearTimeout(hideTimer.current);
			hideTimer.current = window.setTimeout(() => setHovered(null), HIDE_DELAY_MS);
		};
		root.addEventListener("mousemove", onMove);
		root.addEventListener("mouseleave", onLeave);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(hideTimer.current);
			root.removeEventListener("mousemove", onMove);
			root.removeEventListener("mouseleave", onLeave);
		};
	}, [contentRef]);

	const visibleBlock = composer?.block ?? hovered;
	useEffect(() => {
		const layer = layerRef.current;
		if (!visibleBlock || !layer) return;
		setTop(
			visibleBlock.getBoundingClientRect().top -
				layer.getBoundingClientRect().top +
				TOP_OFFSET_PX,
		);
	}, [visibleBlock, layerRef]);

	const close = useCallback(() => {
		setComposer((cur) => {
			cur?.block.classList.remove(DRAFT_CLASS);
			return null;
		});
		setBody("");
	}, []);
	useExclusivePanel("block", composer !== null, close);

	// Esc 关闭输入面板
	useEffect(() => {
		if (!composer) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [composer, close]);

	const open = () => {
		const layer = layerRef.current;
		if (!hovered || !layer) return;
		if (isLoggedIn) hovered.classList.add(DRAFT_CLASS);
		setComposer({
			block: hovered,
			top:
				hovered.getBoundingClientRect().bottom -
				layer.getBoundingClientRect().top +
				COMPOSER_GAP_PX,
		});
	};

	const submit = async () => {
		if (!composer || !body.trim()) return;
		const text = getBlockText(composer.block);
		const blockId = await computeBlockId(text);
		const anchor = await buildAnchorFromRange({
			blockId,
			blockText: text,
			startOffset: 0,
			endOffset: text.length,
		});
		if (!anchor) {
			toast.error("这一段暂不支持段评");
			return;
		}
		createComment.mutate(
			{ body: body.trim(), anchor: toCreateCommentAnchor(anchor) },
			{
				onSuccess: (created) => {
					toast.success(
						created.status === "pending" ? "段评已提交，等待审核" : "段评已提交",
					);
					close();
				},
				onError: (err) => toast.error(err instanceof ApiError ? err.message : "提交失败"),
			},
		);
	};

	const showTrigger = Boolean(visibleBlock && !annotatedBlocks.has(visibleBlock));
	return (
		<>
			<button
				type="button"
				style={{ top }}
				tabIndex={showTrigger ? 0 : -1}
				onMouseEnter={() => clearTimeout(hideTimer.current)}
				onMouseLeave={() => {
					hideTimer.current = window.setTimeout(() => setHovered(null), HIDE_DELAY_MS);
				}}
				onClick={open}
				aria-label="发表段评"
				aria-hidden={!showTrigger}
				title="发表段评"
				data-show={showTrigger ? "true" : undefined}
				className="annotation-trigger pointer-events-auto absolute"
			>
				<MessageSquareText className="size-4" />
			</button>
			{composer && (
				<div
					className="pointer-events-auto absolute right-0 z-50 max-w-full"
					style={{ top: composer.top }}
				>
					<AnnotationComposer
						title="段评"
						icon={<MessageSquareText className="size-4" />}
						quote={getBlockText(composer.block)}
						body={body}
						onBodyChange={setBody}
						onSubmit={submit}
						onCancel={close}
						pending={createComment.isPending}
						placeholder="写下你对这一段的想法…"
						loginRequired={!isLoggedIn}
						onLoggedIn={submit}
					/>
				</div>
			)}
		</>
	);
}
