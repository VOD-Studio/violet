import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import { cn } from "cn";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlockAnnotations } from "../api/queries";
import type { AnnotationAuthorFilter, BlockAuthor } from "../model/types";
import { AnnotationCard } from "./AnnotationCard";
import { usePresence } from "./use-presence";

/** 与 annotations.css 中 .annotation-popover 的 transition 时长一致 */
const EXIT_MS = 180;
const WIDTH_PX = 400;
const EDGE_PX = 16;
const GAP_PX = 10;
/** 气泡至少要给内容留出的视口高度，px */
const MIN_ROOM_PX = 200;
const HEADER_PX = 56;
const BODY_PX = 416;

export interface AnnotationPopoverTarget {
	blockId: string;
	/** 只看某位评论者的批注（含 is_ai）；null 为全部 */
	author: AnnotationAuthorFilter;
	/** 固定尺寸的角标组或划线；不跟随组内头像的展开位移。 */
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
	onFilter: (author: AnnotationAuthorFilter) => void;
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
			const width = Math.min(WIDTH_PX, window.innerWidth - EDGE_PX * 2);
			const left = Math.max(
				EDGE_PX,
				Math.min(rect.right - width, window.innerWidth - width - EDGE_PX),
			);
			const top = Math.max(
				EDGE_PX,
				Math.min(rect.bottom + GAP_PX, window.innerHeight - MIN_ROOM_PX - EDGE_PX),
			);
			setPos({ top, left, maxHeight: Math.max(0, window.innerHeight - top - EDGE_PX) });
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
			if (event.key === "Escape" && !event.defaultPrevented) onClose();
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
			style={{
				top: pos.top,
				left: pos.left,
				height: Math.min(HEADER_PX + BODY_PX, pos.maxHeight),
				width: WIDTH_PX,
			}}
			className="annotation-popover fixed z-50 flex max-w-[calc(100vw-2rem)] flex-col rounded-2xl bg-surface-glass shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10"
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
	onFilter: (author: AnnotationAuthorFilter) => void;
	onClose: () => void;
}) {
	const showAiBadge =
		target.author === null ? target.authors.some((a) => a.is_ai) : target.author.is_ai;
	return (
		<div className="grid h-14 shrink-0 grid-cols-[auto_3rem_minmax(0,1fr)_1.5rem] items-center gap-2 px-4 py-2">
			<span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
				{target.count} 条批注
			</span>
			<span
				className={cn("inline-flex h-6 items-center", !showAiBadge && "invisible")}
				aria-hidden={!showAiBadge}
			>
				<AIBadge show name={target.author?.name} />
			</span>
			{target.authors.length > 1 && (
				<div className="col-start-3 flex h-10 min-w-0 items-center gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
					{target.authors.map((author) => {
						const identity = { name: author.name, is_ai: !!author.is_ai };
						const { displayName, personaId } = getCommentAuthorPresentation({
							author_name: author.name,
							avatar_url: author.avatar_url,
							is_ai: author.is_ai,
						});
						const label = author.is_ai ? `${displayName}（AI）` : displayName;
						const selected =
							target.author !== null &&
							target.author.name === identity.name &&
							target.author.is_ai === identity.is_ai;
						return (
							<button
								key={`${identity.is_ai ? "ai" : "user"}:${identity.name}`}
								type="button"
								title={label}
								aria-label={`只看 ${label}`}
								aria-pressed={selected}
								data-ai={author.is_ai ? "true" : undefined}
								data-ai-persona={personaId}
								onClick={() => onFilter(selected ? null : identity)}
								className={cn(
									"annotation-filter-avatar inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
									target.author && !selected && "opacity-40 hover:opacity-80",
									selected && "ring-2 ring-offset-2 ring-offset-card",
									selected &&
										(author.is_ai ? "ring-(--ai-accent)" : "ring-primary"),
								)}
							>
								<CommentAuthorAvatar
									name={author.name}
									avatarUrl={author.avatar_url}
									isAI={!!author.is_ai}
									className="size-full bg-transparent"
								/>
							</button>
						);
					})}
				</div>
			)}
			<button
				type="button"
				onClick={onClose}
				className="col-start-4 row-start-1 inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
				(c) =>
					target.author === null ||
					(c.author_name === target.author.name && !!c.is_ai === target.author.is_ai),
			),
		[query.data, target.author],
	);

	return (
		<div className="annotation-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pt-1 pb-3">
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
