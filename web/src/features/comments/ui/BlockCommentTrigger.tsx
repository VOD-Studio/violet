import { closestAnnotatableBlock } from "@features/comments/lib/selection-to-anchor";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { MessageSquareText } from "lucide-react";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationAnchorVisible } from "../hooks/use-annotation-anchor-visible";
import { AnnotationPortal } from "./AnnotationPortal";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { useExclusivePanel } from "./use-exclusive-panel";

const loadBlockComposer = () =>
	import("./BlockAnnotationComposer").then((module) => ({
		default: module.BlockAnnotationComposer,
	}));

/** 指针离开段落后入口延迟隐藏的时间，留给指针经过留白移向入口按钮。 */
const HIDE_DELAY_MS = 300;
/** 入口纵向对齐块首行的偏移，px */
const TOP_OFFSET_PX = 2;
/** 输入面板与所批注段落底边的间距，px */
const COMPOSER_GAP_PX = 8;
const DRAFT_CLASS = "annotation-draft-highlight";

/** 正文中的段评入口及其浮层定位上下文。 */
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
 * 鼠标悬停某段时在右侧边距显示段评入口。
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
	const [height, setHeight] = useState(0);
	const [composerBlock, setComposerBlock] = useState<HTMLElement | null>(null);
	const hideTimer = useRef<number | undefined>(undefined);
	/** 指针当前在入口或右侧热区上：此时不安排收起。 */
	const overEntry = useRef(false);
	const composerVisible = useAnnotationAnchorVisible(composerBlock, composerBlock !== null);

	const scheduleHide = useCallback(() => {
		if (overEntry.current) return;
		clearTimeout(hideTimer.current);
		hideTimer.current = window.setTimeout(() => setHovered(null), HIDE_DELAY_MS);
	}, []);
	const enterEntry = useCallback(() => {
		overEntry.current = true;
		clearTimeout(hideTimer.current);
	}, []);
	const leaveEntry = useCallback(() => {
		overEntry.current = false;
		scheduleHide();
	}, [scheduleHide]);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) return;
		let frame = 0;
		const onMove = (event: MouseEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const block = closestAnnotatableBlock(event.target, root);
				// 指针落在段落之间或段落与右缘的留白上，多半是在赶往右侧入口：保留当前段，延时再收起。
				if (!block) {
					scheduleHide();
					return;
				}
				clearTimeout(hideTimer.current);
				setHovered((cur) => (cur === block ? cur : block));
			});
		};
		// 离开正文时排在下一帧的移动回调作废，免得它在指针已到入口上之后才安排收起。
		const onLeave = () => {
			cancelAnimationFrame(frame);
			scheduleHide();
		};
		root.addEventListener("mousemove", onMove);
		root.addEventListener("mouseleave", onLeave);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(hideTimer.current);
			root.removeEventListener("mousemove", onMove);
			root.removeEventListener("mouseleave", onLeave);
		};
	}, [contentRef, scheduleHide]);

	const visibleBlock = composerBlock ?? hovered;
	useEffect(() => {
		const layer = layerRef.current;
		if (!visibleBlock || !layer) return;
		const rect = visibleBlock.getBoundingClientRect();
		setTop(rect.top - layer.getBoundingClientRect().top + TOP_OFFSET_PX);
		setHeight(rect.height);
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
			{showTrigger && (
				<div
					data-trigger-rail
					aria-hidden="true"
					style={{ top, height }}
					onMouseEnter={enterEntry}
					onMouseLeave={leaveEntry}
					className="annotation-trigger-rail pointer-events-auto absolute"
				/>
			)}
			<button
				type="button"
				style={{ top }}
				tabIndex={showTrigger ? 0 : -1}
				onMouseEnter={enterEntry}
				onMouseLeave={leaveEntry}
				onClick={open}
				aria-label="发表段评"
				aria-hidden={!showTrigger}
				title="发表段评"
				data-show={showTrigger ? "true" : undefined}
				className="annotation-trigger pointer-events-auto absolute"
			>
				<MessageSquareText className="size-3.5" />
			</button>
			{composerBlock && (
				<Popover.Root open onOpenChange={(next) => !next && close()}>
					<Popover.Anchor virtualRef={{ current: composerBlock }} />
					<AnnotationPortal>
						<Popover.Content
							className="annotation-card annotation-block-composer v-float pointer-events-auto z-50 outline-none"
							align="end"
							side="bottom"
							sideOffset={COMPOSER_GAP_PX}
							collisionPadding={16}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
							onInteractOutside={(event) => {
								// 聚焦移动不算离开；真正的外部按下才收起
								if (event.detail.originalEvent.type === "focusin")
									event.preventDefault();
							}}
							inert={!composerVisible}
							aria-hidden={!composerVisible || undefined}
							data-offscreen={!composerVisible ? "true" : undefined}
							aria-label="发表段评"
						>
							<AnnotationOverlayContext value={composerVisible}>
								<DeferredContent
									defer={false}
									load={loadBlockComposer}
									label="段评表单"
									fallback={
										<div className="text-sm">
											<p role="status">正在准备段评…</p>
											<button
												type="button"
												onClick={close}
												className="mt-3 rounded-md px-2 py-1 text-primary focus-visible:outline-2 focus-visible:outline-ring"
											>
												关闭段评
											</button>
										</div>
									}
									componentProps={{
										block: composerBlock,
										postId,
										isLoggedIn,
										onClose: close,
									}}
								/>
							</AnnotationOverlayContext>
						</Popover.Content>
					</AnnotationPortal>
				</Popover.Root>
			)}
		</>
	);
}
