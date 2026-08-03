/**
 * DiagramFullscreen - 图块全屏模态查看（PRD-0012 §全屏）
 *
 * React Portal 到 document.body 的深色遮罩，脱离正文栏宽度约束。
 * 视觉完全对齐图片灯箱（ImagePreviewControls）：顶部渐变工具栏、
 * ghost 白色按钮、framer-motion 淡入淡出 + 缩放。
 *
 * 关闭：Esc / 点遮罩空白 / 右上关闭按钮。
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

export function DiagramFullscreen({ svg, label, onClose, triggerRef }: DiagramFullscreenProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    /** 拖拽标志：pointermove 超过阈值后置 true，抑制松手时的合成 click 关闭 */
    const draggedRef = useRef(false);
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
            className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm focus-visible:outline-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
        >
            {/* 顶部工具栏：对齐灯箱——渐变背景、左缩放控件、右关闭 */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc 由全局 keydown 监听 + 元素 onKeyDown 处理 */}
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
                点击空白处（非 SVG）关闭；拖拽后的合成 click 不关闭。
                motion.div 管淡入动画，transform 在内层普通 div。 */}
            <div
                ref={containerRef}
                className="relative flex-1 overflow-hidden overscroll-contain"
                onClick={(e) => {
                    if (draggedRef.current) {
                        draggedRef.current = false;
                        return;
                    }
                    const target = e.target as HTMLElement;
                    if (!target.closest("[role=img]")) onClose();
                }}
            >
                <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                >
                    <div
                        className="absolute inset-0 flex touch-none items-center justify-center"
                        style={{
                            transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
                            transformOrigin: "0 0",
                        }}
                        onPointerDown={(e) => {
                            draggedRef.current = false;
                            handlePointerDown(e);
                        }}
                        onPointerMove={(e) => {
                            if (e.buttons > 0) draggedRef.current = true;
                            handlePointerMove(e);
                        }}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        tabIndex={0}
                        role="application"
                        aria-label="图表缩放区"
                    >
                        <div
                            className="flex cursor-grab items-center justify-center active:cursor-grabbing"
                            role="img"
                            aria-label={label}
                            onClick={(e) => e.stopPropagation()}
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
