/**
 * DiagramViewport - 图块缩放平移容器（PRD-0011）
 *
 * 阅读端（DiagramBlock）与编辑器弹层预览（DiagramEditPanel）共用：
 * - 锁定态（默认）：外层 overflow-x-auto，保留 PRD-0005「横向滚动而非缩放变形」决策，
 *   页面滚动/选文本正常
 * - 解锁态：外层 overflow-hidden，内容 transform 缩放平移（滚轮光标锚 + 拖拽 + 按钮），
 *   touch-none 禁触摸滚动让位给拖拽（移动端）
 * - 工具条：锁定态只显示锁（解锁入口）与可选的复制按钮；解锁态追加 +/−/重置/百分比
 *
 * 不感知 mermaid：children 是任意渲染产物（SVG），纯交互容器。
 */
import {
    Check,
    Copy,
    Download,
    FileCode,
    FileImage,
    Lock,
    Maximize,
    RotateCcw,
    Unlock,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { exportPng, exportSvg as exportSvgFile } from "./export";
import { useDiagramViewport } from "./useDiagramViewport";

export interface DiagramViewportProps {
    children: ReactNode;
    /** 提供时工具条显示复制按钮（阅读端传 source，编辑器弹层不传） */
    onCopySource?: () => void;
    /** 已复制反馈（短暂替换复制图标，由调用方控制计时） */
    copied?: boolean;
    /** 提供时工具条显示导出按钮（SVG/PNG 菜单）；传已清理的 SVG 字符串 */
    exportSvg?: string;
    /** 提供时工具条显示全屏按钮（阅读端传回调，编辑器弹层不传） */
    onFullscreen?: () => void;
    /** 是否渲染工具条（默认 true；阅读端渲染完成前隐藏，避免空区域角落出现按钮） */
    renderToolbar?: boolean;
    /** 初始锁定态（默认 true；全屏模态传 false 默认解锁） */
    defaultLocked?: boolean;
    /** 外层容器额外 className（全屏态传 h-full 撑满高度） */
    className?: string;
}

/** 键盘聚焦时的可见焦点环（与按钮 focus-visible 统一） */
const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function DiagramViewport({
    children,
    onCopySource,
    copied,
    defaultLocked = true,
    exportSvg,
    className,
    onFullscreen,
    renderToolbar = true,
}: DiagramViewportProps) {
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
    } = useDiagramViewport(defaultLocked);

    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // 导出菜单：点击外部或 Esc 关闭
    useEffect(() => {
        if (!exportMenuOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (exportMenuRef.current?.contains(e.target as Node)) return;
            setExportMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setExportMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [exportMenuOpen]);

    return (
        <div ref={containerRef} className={`relative w-full ${className ?? ""}`}>
            {/* 锁定态横向滚动（PRD-0005 决策），解锁态裁剪给 transform；
			    overscroll-contain 阻断滚轮滚动链传播到页面（配合 hook 原生 passive:false 监听）。
			    键盘缩放平移契约见 onKeyDown（T4 a11y）。 */}
            <div
                className={
                    state.locked
                        ? `code-block-scrollbar overflow-x-auto ${FOCUS_RING}`
                        : `overflow-hidden overscroll-contain ${FOCUS_RING}`
                }
                role="application"
                aria-label="图表缩放区"
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                <div
                    className={
                        state.locked
                            ? undefined
                            : "cursor-grab touch-none select-none data-[dragging]:cursor-grabbing data-[dragging]:will-change-transform [&_*]:cursor-inherit"
                    }
                    style={{
                        transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
                        transformOrigin: "0 0",
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    {children}
                </div>
            </div>
            {/* 工具条：锁定态仅锁 + 复制；解锁态追加缩放控制（renderToolbar=false 时整条隐藏） */}
            {renderToolbar ? (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-edge-hairline bg-background/80 p-0.5 shadow-sm backdrop-blur">
                    {!state.locked ? (
                        <>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={zoomIn}
                                aria-label="放大"
                                title="放大"
                            >
                                <ZoomIn className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={zoomOut}
                                aria-label="缩小"
                                title="缩小"
                            >
                                <ZoomOut className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={reset}
                                aria-label="重置缩放"
                                title="重置缩放与位置"
                            >
                                <RotateCcw className="size-3.5" />
                            </Button>
                            <span className="w-9 text-center text-[10px] tabular-nums text-muted-foreground">
                                {Math.round(state.scale * 100)}%
                            </span>
                            <span className="mx-0.5 h-4 w-px bg-border" />
                        </>
                    ) : null}
                    {onCopySource ? (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={onCopySource}
                            aria-label="复制 mermaid 源码"
                            title={copied ? "已复制" : "复制源码"}
                        >
                            {copied ? (
                                <Check className="size-3.5 text-green-400" />
                            ) : (
                                <Copy className="size-3.5" />
                            )}
                        </Button>
                    ) : null}
                    {exportSvg ? (
                        <div ref={exportMenuRef} className="relative">
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setExportMenuOpen((v) => !v)}
                                aria-label="导出图表"
                                aria-haspopup="menu"
                                aria-expanded={exportMenuOpen}
                                title="导出"
                            >
                                <Download className="size-3.5" />
                            </Button>
                            {exportMenuOpen ? (
                                <div
                                    role="menu"
                                    className="code-block-scrollbar absolute right-0 top-full z-20 mt-1 flex min-w-32 flex-col gap-0.5 rounded-md border border-edge-hairline bg-popover p-1 text-popover-foreground shadow-md"
                                >
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                                        onClick={() => {
                                            exportSvgFile(exportSvg);
                                            setExportMenuOpen(false);
                                        }}
                                    >
                                        <FileCode className="size-3.5" />
                                        导出 SVG
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                                        onClick={() => {
                                            exportPng(exportSvg).catch(() => {
                                                // PNG 转换失败（canvas 不可用/解码失败）：静默降级，不阻塞
                                            });
                                            setExportMenuOpen(false);
                                        }}
                                    >
                                        <FileImage className="size-3.5" />
                                        导出 PNG
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={toggleLock}
                        aria-label={state.locked ? "解锁缩放" : "锁定缩放"}
                        title={state.locked ? "解锁缩放（可平移放大）" : "锁定（恢复页面滚动）"}
                    >
                        {state.locked ? (
                            <Lock className="size-3.5" />
                        ) : (
                            <Unlock className="size-3.5" />
                        )}
                    </Button>
                    {onFullscreen ? (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={onFullscreen}
                            aria-label="全屏查看"
                            title="全屏查看"
                        >
                            <Maximize className="size-3.5" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
