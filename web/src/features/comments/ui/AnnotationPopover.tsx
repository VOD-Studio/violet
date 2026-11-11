import type { Comment } from "@entities/comment/model/types";
import { Popover } from "radix-ui";
import { useContext, useEffect, useRef, useState } from "react";
import { useBlockAnnotations } from "../api/queries";
import { useAnnotationAnchorVisible } from "../hooks/use-annotation-anchor-visible";
import { rangeKey } from "../lib/annotation-marks";
import type { AnnotationAuthorFilter, BlockAuthor } from "../model/types";
import { AnnotationThread } from "./AnnotationCard";
import { AnnotationPending } from "./AnnotationPending";
import { AnnotationPopoverHeader } from "./AnnotationPopoverHeader";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { BlockAnnotationComposer } from "./BlockAnnotationComposer";

export interface AnnotationPopoverTarget {
	blockId: string;
	/** 真正关闭后再次打开属于新会话，不能复活离场尾帧中的草稿。 */
	sessionId: number;
	/** 划线区间的分组键；null 表示整段批注卡，列出该块全部批注。 */
	rangeKey: string | null;
	/** 整段批注卡的评论者筛选：null 显示全部，身份对象只显示该评论者。 */
	author: AnnotationAuthorFilter;
	/** 批注卡的定位参照：划线或固定尺寸的角标组，不随组内头像展开而移动。 */
	anchorEl: HTMLElement;
	/** 从划线打开时，关闭后还焦点的划线按钮。 */
	returnFocusEl: HTMLElement | null;
	/** 规范正文块；段评以它计算锚点，入口和编辑器不得写入此节点。 */
	blockEl: HTMLElement | null;
	authors: BlockAuthor[];
	count: number;
}

export interface AnnotationPopoverProps {
	open: boolean;
	target: AnnotationPopoverTarget | null;
	postId: string;
	isLoggedIn: boolean;
	/** 整段批注卡里切换评论者筛选 */
	onFilter: (author: AnnotationAuthorFilter) => void;
	onClose: () => void;
}

/** 关闭后还焦点的元素：划线打开的还给划线按钮，角标打开的还给对应头像。 */
function restoreFocus(target: AnnotationPopoverTarget): HTMLElement | null {
	if (target.rangeKey !== null) return target.returnFocusEl;
	const anchor = target.anchorEl;
	const authorButton = Array.from(
		anchor.querySelectorAll<HTMLElement>("[data-annotation-author]"),
	).find((element) => element.dataset.annotationAuthor === JSON.stringify(target.author));
	if (anchor.matches("button")) return anchor;
	if (window.matchMedia("(max-width: 767.98px)").matches) {
		return anchor.querySelector<HTMLElement>(".annotation-marker-mobile");
	}
	return authorButton ?? anchor.querySelector<HTMLElement>(".annotation-avatar");
}

/** 批注卡；滚动离屏只隐藏，真正关闭才结束当前编辑会话。 */
export function AnnotationPopover({
	open,
	target,
	postId,
	isLoggedIn,
	onFilter,
	onClose,
}: AnnotationPopoverProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const pointerOutside = useRef(false);
	const offscreen = !useAnnotationAnchorVisible(target?.anchorEl, open);

	useEffect(() => {
		if (open) pointerOutside.current = false;
	}, [open]);
	useEffect(() => {
		if (offscreen && contentRef.current?.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
	}, [offscreen]);

	if (!target) return null;
	return (
		<Popover.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<Popover.Anchor virtualRef={{ current: target.anchorEl }} />
			<AnnotationPortal>
				<Popover.Content
					ref={contentRef}
					aria-label={target.rangeKey === null ? "段落批注" : "批注"}
					aria-hidden={offscreen || !open ? true : undefined}
					inert={offscreen || !open}
					data-offscreen={offscreen ? "true" : undefined}
					align={target.rangeKey === null ? "end" : "start"}
					side="bottom"
					sideOffset={8}
					collisionPadding={16}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						if (pointerOutside.current || offscreen) return;
						restoreFocus(target)?.focus({ preventScroll: true });
					}}
					onInteractOutside={(event) => {
						const node = event.target;
						if (
							node instanceof Element &&
							node.closest("[data-annotation-blockid], mark.annotation-mark")
						) {
							event.preventDefault();
							return;
						}
						// 保持原有外部点击语义，不因用户在正文选择文字而丢失草稿。
						if (event.detail.originalEvent.type === "focusin") event.preventDefault();
						else pointerOutside.current = true;
					}}
					className="annotation-card v-float z-50 outline-none"
				>
					<AnnotationOverlayContext value={open && !offscreen}>
						<PopoverBody
							key={`${target.blockId}:${target.sessionId}`}
							target={target}
							postId={postId}
							isLoggedIn={isLoggedIn}
							onFilter={onFilter}
							onClose={onClose}
						/>
					</AnnotationOverlayContext>
				</Popover.Content>
			</AnnotationPortal>
		</Popover.Root>
	);
}

/** 同一处划线的顶层批注归为一组，按首次出现的先后排列。 */
interface CommentGroup {
	key: string;
	quote: string;
	comments: Comment[];
}

function groupByRange(comments: Comment[]): CommentGroup[] {
	const groups = new Map<string, CommentGroup>();
	for (const comment of comments) {
		if (!comment.anchor) continue;
		const key = rangeKey(comment.anchor.start_offset, comment.anchor.end_offset);
		const group = groups.get(key);
		if (group) group.comments.push(comment);
		else groups.set(key, { key, quote: comment.anchor.selected_text, comments: [comment] });
	}
	return [...groups.values()];
}

function PopoverBody({
	target,
	postId,
	isLoggedIn,
	onFilter,
	onClose,
}: {
	target: AnnotationPopoverTarget;
	postId: string;
	isLoggedIn: boolean;
	onFilter: (author: AnnotationAuthorFilter) => void;
	onClose: () => void;
}) {
	const query = useBlockAnnotations(postId, target.blockId);
	// 缓存命中时与卡片一起浮出；经过等待才到的内容单独淡入，避免等待区被硬替换
	const [waited] = useState(query.isLoading);
	const overlayActive = useContext(AnnotationOverlayContext);
	const all = groupByRange(query.data?.data ?? []);
	const groups = target.rangeKey === null ? all : all.filter((g) => g.key === target.rangeKey);
	/** 整段批注卡可按评论者筛选；被筛掉的批注只隐藏不卸载，回复草稿得以保留。 */
	const matches = (comment: Comment) =>
		target.author === null ||
		(comment.author_name === target.author.name && !!comment.is_ai === target.author.is_ai);

	return (
		<>
			{target.rangeKey === null && (
				<AnnotationPopoverHeader target={target} onFilter={onFilter} onClose={onClose} />
			)}
			<div className="annotation-card-list" data-waited={waited || undefined}>
				{query.isLoading && <AnnotationPending label="批注加载中" className="py-6" />}
				{query.isError && (
					<p role="alert" className="text-sm text-muted-foreground">
						批注加载失败，请稍后重试。
					</p>
				)}
				{groups.map((group) => (
					<AnnotationThread
						key={group.key}
						quote={group.quote}
						comments={group.comments}
						postId={postId}
						isLoggedIn={isLoggedIn}
						isVisible={matches}
						active={overlayActive}
					/>
				))}
			</div>
			{target.blockEl && (
				<div role="group" aria-label="发表段评" className="annotation-card-composer">
					<BlockAnnotationComposer
						block={target.blockEl}
						postId={postId}
						isLoggedIn={isLoggedIn}
					/>
				</div>
			)}
		</>
	);
}
