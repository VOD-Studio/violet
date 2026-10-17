import { closestAnnotatableBlock } from "@features/comments/lib/selection-to-anchor";
import { MessageSquareText } from "lucide-react";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationAnchorVisible } from "../hooks/use-annotation-anchor-visible";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { BlockAnnotationComposer } from "./BlockAnnotationComposer";
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
	/** 已有批注的块在批注面板中提供独立段评入口，避免侧栏入口与头像重叠。 */
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
	const [composerBlock, setComposerBlock] = useState<HTMLElement | null>(null);
	const hideTimer = useRef<number | undefined>(undefined);
	const composerVisible = useAnnotationAnchorVisible(composerBlock, composerBlock !== null);

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

	const visibleBlock = composerBlock ?? hovered;
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
		setComposerBlock((cur) => {
			cur?.classList.remove(DRAFT_CLASS);
			return null;
		});
	}, []);
	useExclusivePanel("block", composerBlock !== null, close);

	const open = () => {
		if (!hovered) return;
		if (isLoggedIn) hovered.classList.add(DRAFT_CLASS);
		setComposerBlock(hovered);
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
			{composerBlock && (
				<Popover.Root open onOpenChange={(next) => !next && close()}>
					<Popover.Anchor virtualRef={{ current: composerBlock }} />
					<AnnotationPortal>
						<Popover.Content
							className="annotation-block-composer pointer-events-auto z-50 max-w-[calc(100vw-2rem)] rounded-2xl outline-none"
							align="end"
							side="bottom"
							sideOffset={COMPOSER_GAP_PX}
							collisionPadding={16}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
							onInteractOutside={(event) => event.preventDefault()}
							inert={!composerVisible}
							aria-hidden={!composerVisible || undefined}
							data-offscreen={!composerVisible ? "true" : undefined}
							aria-label="发表段评"
						>
							<AnnotationOverlayContext value={composerVisible}>
								<BlockAnnotationComposer
									block={composerBlock}
									postId={postId}
									isLoggedIn={isLoggedIn}
									onClose={close}
								/>
							</AnnotationOverlayContext>
						</Popover.Content>
					</AnnotationPortal>
				</Popover.Root>
			)}
		</>
	);
}
