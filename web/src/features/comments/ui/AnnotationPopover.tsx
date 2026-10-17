import { Popover } from "radix-ui";
import { useContext, useEffect, useRef } from "react";
import { useBlockAnnotations } from "../api/queries";
import { useAnnotationAnchorVisible } from "../hooks/use-annotation-anchor-visible";
import type { AnnotationAuthorFilter, BlockAuthor } from "../model/types";
import { AnnotationCard } from "./AnnotationCard";
import { AnnotationPopoverHeader } from "./AnnotationPopoverHeader";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { BlockAnnotationComposer } from "./BlockAnnotationComposer";

export interface AnnotationPopoverTarget {
	blockId: string;
	/** 真正关闭后再次打开属于新会话，不能复活离场尾帧中的草稿。 */
	sessionId: number;
	/** null 显示全部，身份对象只显示该评论者。 */
	author: AnnotationAuthorFilter;
	/** 固定尺寸的角标组或划线，不随组内头像展开而移动。 */
	anchorEl: HTMLElement;
	/** 规范正文块；入口和编辑器不得写入此节点。 */
	blockEl: HTMLElement | null;
	authors: BlockAuthor[];
	count: number;
}

export interface AnnotationPopoverProps {
	open: boolean;
	target: AnnotationPopoverTarget | null;
	postId: string;
	isLoggedIn: boolean;
	onFilter: (author: AnnotationAuthorFilter) => void;
	onClose: () => void;
}

/** 段落批注浮层；滚动离屏只隐藏，真正关闭才结束当前编辑会话。 */
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
					aria-label="段落批注"
					aria-hidden={offscreen || !open ? true : undefined}
					inert={offscreen || !open}
					data-offscreen={offscreen ? "true" : undefined}
					align="end"
					side="bottom"
					sideOffset={10}
					collisionPadding={16}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						if (pointerOutside.current || offscreen) return;
						const authorButton = Array.from(
							target.anchorEl.querySelectorAll<HTMLElement>(
								"[data-annotation-author]",
							),
						).find(
							(element) =>
								element.dataset.annotationAuthor === JSON.stringify(target.author),
						);
						const button = target.anchorEl.matches("button")
							? target.anchorEl
							: window.matchMedia("(max-width: 767.98px)").matches
								? target.anchorEl.querySelector<HTMLElement>(
										".annotation-marker-mobile",
									)
								: (authorButton ??
									target.anchorEl.querySelector<HTMLElement>(
										".annotation-avatar",
									));
						button?.focus({ preventScroll: true });
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
					className="annotation-popover z-50 flex w-100 max-w-[calc(100vw-2rem)] flex-col rounded-2xl bg-(--surface-glass) shadow-[0_4px_24px_rgb(0_0_0/0.05)] outline-none backdrop-blur-md dark:ring-1 dark:ring-white/10"
				>
					<AnnotationOverlayContext value={open && !offscreen}>
						<AnnotationPopoverHeader
							target={target}
							onFilter={onFilter}
							onClose={onClose}
						/>
						<PopoverBody
							key={`${target.blockId}:${target.sessionId}`}
							target={target}
							postId={postId}
							isLoggedIn={isLoggedIn}
						/>
					</AnnotationOverlayContext>
				</Popover.Content>
			</AnnotationPortal>
		</Popover.Root>
	);
}

function PopoverBody({
	target,
	postId,
	isLoggedIn,
}: {
	target: AnnotationPopoverTarget;
	postId: string;
	isLoggedIn: boolean;
}) {
	const query = useBlockAnnotations(postId, target.blockId);
	const overlayActive = useContext(AnnotationOverlayContext);
	return (
		<>
			<div className="annotation-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pt-1 pb-3">
				{query.isLoading && <PopoverSkeleton />}
				{query.isError && (
					<p role="alert" className="p-3 text-sm text-muted-foreground">
						批注加载失败，请稍后重试。
					</p>
				)}
				{(query.data?.data ?? []).map((comment) => (
					<div
						key={comment.id}
						className="mb-2"
						hidden={
							target.author !== null &&
							(comment.author_name !== target.author.name ||
								!!comment.is_ai !== target.author.is_ai)
						}
					>
						<AnnotationOverlayContext
							value={
								overlayActive &&
								(target.author === null ||
									(comment.author_name === target.author.name &&
										!!comment.is_ai === target.author.is_ai))
							}
						>
							<AnnotationCard
								node={{
									comment,
									replies: (comment.replies ?? []).map((reply) => ({
										comment: reply,
										replies: [],
									})),
								}}
								selectedText={comment.anchor?.selected_text ?? ""}
								postId={postId}
								isLoggedIn={isLoggedIn}
							/>
						</AnnotationOverlayContext>
					</div>
				))}
			</div>
			{target.blockEl && (
				<div role="group" aria-label="发表段评" className="shrink-0 px-3 pt-2 pb-3">
					<BlockAnnotationComposer
						embedded
						block={target.blockEl}
						postId={postId}
						isLoggedIn={isLoggedIn}
					/>
				</div>
			)}
		</>
	);
}

function PopoverSkeleton() {
	return (
		<div className="space-y-2">
			{[1, 2].map((i) => (
				<div key={i} className="rounded-2xl bg-muted/40 p-3.5">
					<div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
					<div className="mb-1 h-2 w-1/2 animate-pulse rounded bg-muted" />
					<div className="h-2 w-full animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	);
}
