/**
 * DiagramFullscreen - 图块全屏模态查看（PRD-0012 §全屏）
 *
 * React Portal 到 document.body 的深色遮罩，脱离正文栏宽度约束。
 * 与图片灯箱的差异：图片是不透明矩形，/70 遮罩即可；mermaid SVG 透明底、
 * 主题色烘焙（light 主题深色文字无底色），深遮罩上直接不可读——故遮罩
 * 加深到 /85 压掉透出正文的干扰，图下垫 bg-background 衬底卡片（图主题
 * 跟随站点，衬底总与图匹配），ghost 白色按钮、Motion 淡入淡出 + 缩放。
 *
 * 关闭：Esc / 点图外空白 / 右上关闭按钮。
 * 焦点管理：打开时聚焦模态容器，关闭后焦点回触发按钮。
 *
 * AnimatePresence 由父组件（DiagramBlock）包裹，本组件只渲染 motion.div。
 */
import { FileCode, FileImage, Lock, RotateCcw, Unlock, X, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/base/button";
import { exportPng, exportSvg as exportSvgFile } from "./export";
import { FALLBACK_DIAGRAM_LABEL } from "./label";
import { useDiagramViewport } from "./useDiagramViewport";

export interface DiagramFullscreenProps {
	svg: string;
	label: string;
	onClose: () => void;
	triggerRef?: React.RefObject<HTMLElement | null>;
}

const BTN_CLS = "text-white hover:bg-white/15 hover:text-white active:scale-100";

/** 拖拽判定阈值（px）：按下后位移超过才算拖拽，避免手抖点击被误判 */
const DRAG_THRESHOLD_PX = 6;

export function DiagramFullscreen({ svg, label, onClose, triggerRef }: DiagramFullscreenProps) {
	const overlayRef = useRef<HTMLDivElement>(null);
	/** 拖拽标志：pointermove 超过阈值后置 true，抑制松手时的合成 click 关闭 */
	const draggedRef = useRef(false);
	/**
	 * 按下快照：pointer capture 会把松手后的 click 重定向到捕获元素，
	 * click 的 target 不再是真实命中元素——用按下时的 target 判定「点图/点空白」。
	 */
	const downRef = useRef<{ target: EventTarget; x: number; y: number } | null>(null);
	const {
		containerRef,
		state,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
		toggleLock,
		zoomIn,
		zoomOut,
		reset,
	} = useDiagramViewport(false);

	useEffect(() => {
		overlayRef.current?.focus();
	}, []);

	useEffect(() => {
		return () => triggerRef?.current?.focus();
	}, [triggerRef]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	// mermaid SVG 带 width="100%" + style="max-width:XXXpx"——max-width 在阅读端限制宽度。
	// 全屏态剥掉 max-width 并把 width 改为 viewBox 自然尺寸（居中，而非撑满容器）
	const fullscreenSvg = svg
		.replace(/max-width:\s*[\d.]+px;?/g, "")
		.replace(/width="[^"]*"/, (match, _o, full) => {
			const vb = full.match(/viewBox="([^"]*\s)([\d.]+)\s([\d.]+)"/);
			return vb ? `width="${vb[2]}" height="${vb[3]}"` : match;
		});

	const showLabel = label !== FALLBACK_DIAGRAM_LABEL;

	return createPortal(
		<motion.div
			ref={overlayRef}
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
			className="fixed inset-0 z-50 flex flex-col bg-black/85 focus-visible:outline-none"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			{/* 顶部工具栏：对齐灯箱——渐变背景、左缩放控件、右关闭 */}
			{/* 此 div 的 onClick 仅拦截事件冒泡（Esc 由外层 onKeyDown 处理） */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 纯事件拦截容器（stopPropagation），无点击语义，键盘交互由内部按钮提供 */}
			<div
				className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-2 bg-linear-to-b from-black/50 to-transparent p-2 sm:p-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* 左侧：缩放/锁定/导出 */}
				<div className="flex min-w-0 items-center gap-1 sm:gap-2">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={zoomOut}
						aria-label="缩小"
						className={BTN_CLS}
					>
						<ZoomOut className="size-4 sm:size-5" />
					</Button>
					<span className="min-w-10 shrink-0 text-center text-xs text-white sm:text-sm">
						{Math.round(state.scale * 100)}%
					</span>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={zoomIn}
						aria-label="放大"
						className={BTN_CLS}
					>
						<ZoomIn className="size-4 sm:size-5" />
					</Button>
					<div className="mx-0.5 h-5 w-px bg-white/20 sm:mx-1 sm:h-6" />
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={reset}
						aria-label="重置缩放"
						title="重置缩放与位置"
						className={BTN_CLS}
					>
						<RotateCcw className="size-4 sm:size-5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={toggleLock}
						aria-label={state.locked ? "解锁缩放" : "锁定缩放"}
						title={state.locked ? "解锁缩放（可平移放大）" : "锁定（恢复页面滚动）"}
						className={BTN_CLS}
					>
						{state.locked ? (
							<Lock className="size-4 sm:size-5" />
						) : (
							<Unlock className="size-4 sm:size-5" />
						)}
					</Button>
					<div className="mx-0.5 h-5 w-px bg-white/20 sm:mx-1 sm:h-6" />
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => exportSvgFile(svg)}
						aria-label="导出 SVG"
						title="导出 SVG"
						className={BTN_CLS}
					>
						<FileCode className="size-4 sm:size-5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => {
							exportPng(svg).catch(() => {});
						}}
						aria-label="导出 PNG"
						title="导出 PNG"
						className={BTN_CLS}
					>
						<FileImage className="size-4 sm:size-5" />
					</Button>
				</div>

				{/* 右侧：标题 + 关闭 */}
				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					{showLabel ? (
						<span className="text-xs text-white/60 sm:text-sm">{label}</span>
					) : null}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						aria-label="关闭全屏"
						className={BTN_CLS}
					>
						<X className="size-4 sm:size-5" />
					</Button>
				</div>
			</div>

			{/* 内容区：撑满视口，SVG 自然尺寸居中。
                点图外空白关闭（以按下时的真实命中元素判定，pointer capture
                会篡改 click target）；拖拽超阈值后的合成 click 不关闭。
                motion.div 管淡入动画，transform 在内层普通 div。
                will-change 只在 data-dragging 期间加：合成层按栅格化位图做
                transform，拖拽是纯平移（位图无损）所以流畅；若常设，缩放
                会变成拉伸位图（SVG 放大发虚）。非拖拽时浏览器对 transform
                重栅格化，矢量内容任意缩放保持清晰。 */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 点击空白关闭是鼠标手势，键盘关闭由外层 onKeyDown(Escape) 承担 */}
			<div
				ref={containerRef}
				className="relative flex-1 overflow-hidden overscroll-contain"
				onClick={(e) => {
					if (draggedRef.current) {
						draggedRef.current = false;
						return;
					}
					const down = downRef.current;
					downRef.current = null;
					const target = (down?.target ?? e.target) as HTMLElement;
					if (!target.closest?.("[role=img]")) onClose();
				}}
			>
				<motion.div
					className="absolute inset-0"
					initial={{ opacity: 0, scale: 0.96 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
				>
					<div
						className="absolute inset-0 flex touch-none cursor-grab select-none items-center justify-center data-[dragging]:cursor-grabbing data-[dragging]:will-change-transform [&_*]:cursor-inherit"
						style={{
							transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
							transformOrigin: "0 0",
						}}
						onPointerDown={(e) => {
							downRef.current = {
								target: e.target,
								x: e.clientX,
								y: e.clientY,
							};
							draggedRef.current = false;
							handlePointerDown(e);
						}}
						onPointerMove={(e) => {
							const down = downRef.current;
							if (
								down &&
								e.buttons > 0 &&
								Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) >
									DRAG_THRESHOLD_PX
							) {
								draggedRef.current = true;
							}
							handlePointerMove(e);
						}}
						onPointerUp={handlePointerUp}
						onPointerCancel={handlePointerUp}
						onKeyDown={handleKeyDown}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: role=application 的可聚焦容器，onKeyDown 提供方向键缩放/平移键盘契约（T4 a11y）
						tabIndex={0}
						role="application"
						aria-label="图表缩放区"
					>
						<div
							className="flex items-center justify-center rounded-lg bg-background p-6 shadow-2xl"
							role="img"
							aria-label={label}
							// biome-ignore lint/security/noDangerouslySetInnerHtml: svg 经 renderMermaid 内 DOMPurify 清理：svg/svgFilters profile + foreignObject 内纯文本 HTML 白名单（div/span/p 等，无 href/src 能力）+ FORBID script/a + on* 事件属性与 CSS url() 剥除，与阅读端同防线
							dangerouslySetInnerHTML={{ __html: fullscreenSvg }}
						/>
					</div>
				</motion.div>
			</div>
		</motion.div>,
		document.body,
	);
}
