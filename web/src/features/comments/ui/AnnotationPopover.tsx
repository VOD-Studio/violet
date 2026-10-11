import { avatarUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlockAnnotations } from "../api/queries";
import type { BlockAuthor } from "../model/types";
import { AnnotationCard } from "./AnnotationCard";
import { usePresence } from "./use-presence";

/** 与 annotations.css 中 .annotation-popover 的 transition 时长一致 */
const EXIT_MS = 180;
const WIDTH_PX = 448;
const EDGE_PX = 16;
const GAP_PX = 10;
/** 气泡至少要给内容留出的视口高度，px */
const MIN_ROOM_PX = 200;

export interface AnnotationPopoverTarget {
	blockId: string;
	/** 只看某位评论者的批注；null 为全部 */
	author: string | null;
	/** 触发它的头像或高亮，气泡贴着它定位 */
	anchorEl: HTMLElement;
	/** 该块批注的评论者，用于顶部筛选头像 */
	authors: BlockAuthor[];
	count: number;
}

export interface AnnotationPopoverProps {
	open: boolean;
	/** 关闭过程中仍需渲染内容，调用方应保留最近一次的 target */
	target: AnnotationPopoverTarget | null;
	postId: string;
	isLoggedIn: boolean;
	onFilter: (author: string | null) => void;
	onClose: () => void;
}

/**
 * AnnotationPopover - 点击评论者头像后在头像旁淡入的批注气泡。
 *
 * 进出场只用透明度与模糊过渡，不缩放、不位移；贴着触发元素定位并随滚动跟随，
 * 触发元素离开视口、点击气泡外或按 Esc 时关闭。
 */
export function AnnotationPopover({
	open,
	target,
	postId,
	isLoggedIn,
	onFilter,
	onClose,
}: AnnotationPopoverProps) {
	const { mounted, visible } = usePresence(open, EXIT_MS);
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
	const anchorEl = target?.anchorEl;

	useLayoutEffect(() => {
		if (!mounted || !anchorEl) return;
		let frame = 0;
		const place = () => {
			frame = 0;
			const rect = anchorEl.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > window.innerHeight) {
				onClose();
				return;
			}
			const left = Math.max(
				EDGE_PX,
				Math.min(rect.right - WIDTH_PX, window.innerWidth - WIDTH_PX - EDGE_PX),
			);
			const top = Math.min(rect.bottom + GAP_PX, window.innerHeight - MIN_ROOM_PX - EDGE_PX);
			setPos({ top, left, maxHeight: window.innerHeight - top - EDGE_PX });
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(place);
		};
		place();
		window.addEventListener("scroll", schedule, { passive: true, capture: true });
		window.addEventListener("resize", schedule);
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
		};
	}, [mounted, anchorEl, onClose]);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const node = event.target as Element | null;
			if (!node || ref.current?.contains(node)) return;
			// 点击角标头像与划线高亮由它们自己的处理器切换，这里不抢先关闭
			if (node.closest("[data-annotation-blockid], mark.annotation-mark")) return;
			onClose();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	if (!mounted || !target || !pos) return null;

	return (
		<div
			ref={ref}
			role="dialog"
			aria-label="段落批注"
			data-state={visible ? "open" : "closed"}
			style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight, width: WIDTH_PX }}
			className="annotation-popover fixed z-50 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-surface-glass shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10"
		>
			<PopoverHeader target={target} onFilter={onFilter} onClose={onClose} />
			<PopoverBody target={target} postId={postId} isLoggedIn={isLoggedIn} />
		</div>
	);
}

function PopoverHeader({
	target,
	onFilter,
	onClose,
}: {
	target: AnnotationPopoverTarget;
	onFilter: (author: string | null) => void;
	onClose: () => void;
}) {
	return (
		<div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
			<span className="text-xs font-medium text-muted-foreground">{target.count} 条批注</span>
			{target.authors.length > 1 && (
				<div className="ml-1 flex items-center gap-1">
					{target.authors.map((author) => {
						const selected = target.author === author.name;
						return (
							<button
								key={author.name}
								type="button"
								title={author.name}
								aria-label={`只看 ${author.name}`}
								aria-pressed={selected}
								onClick={() => onFilter(selected ? null : author.name)}
								className={cn(
									"inline-flex size-6 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-semibold text-primary transition-opacity",
									target.author && !selected && "opacity-40 hover:opacity-80",
									selected &&
										"ring-2 ring-primary ring-offset-2 ring-offset-card",
								)}
							>
								{author.avatar_url ? (
									<img
										src={avatarUrl(author.avatar_url, author.name)}
										alt=""
										className="size-full object-cover"
									/>
								) : (
									author.name.slice(0, 1).toUpperCase()
								)}
							</button>
						);
					})}
				</div>
			)}
			<button
				type="button"
				onClick={onClose}
				className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
				aria-label="关闭"
			>
				<X className="size-4" />
			</button>
		</div>
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
	const comments = useMemo(
		() =>
			(query.data?.data ?? []).filter(
				(c) => target.author === null || c.author_name === target.author,
			),
		[query.data, target.author],
	);

	return (
		<div className="annotation-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pb-3">
			{query.isLoading && <PopoverSkeleton />}
			{comments.map((comment) => (
				<AnnotationCard
					key={comment.id}
					node={{
						comment,
						replies: (comment.replies ?? []).map((r) => ({ comment: r, replies: [] })),
					}}
					selectedText={comment.anchor?.selected_text ?? ""}
					postId={postId}
					isLoggedIn={isLoggedIn}
				/>
			))}
		</div>
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
