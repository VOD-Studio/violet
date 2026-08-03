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
import { Check, Copy, Lock, RotateCcw, Unlock, ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import { useDiagramViewport } from "./useDiagramViewport";

export interface DiagramViewportProps {
    children: ReactNode;
    /** 提供时工具条显示复制按钮（阅读端传 source，编辑器弹层不传） */
    onCopySource?: () => void;
    /** 已复制反馈（短暂替换复制图标，由调用方控制计时） */
    copied?: boolean;
    /** 是否渲染工具条（默认 true；阅读端渲染完成前隐藏，避免空区域角落出现按钮） */
    renderToolbar?: boolean;
}

export function DiagramViewport({
    children,
    onCopySource,
    copied,
    renderToolbar = true,
}: DiagramViewportProps) {
    const {
        containerRef,
        state,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        toggleLock,
        zoomIn,
        zoomOut,
        reset,
    } = useDiagramViewport();

    return (
        <div ref={containerRef} className="relative w-full">
            {/* 滚动/裁剪切换：锁定态横向滚动（PRD-0005 决策），解锁态裁剪给 transform；
			    overscroll-contain 阻断滚轮滚动链传播到页面（配合 hook 原生 passive:false 监听） */}
            <div
                className={
                    state.locked
                        ? "code-block-scrollbar overflow-x-auto"
                        : "overflow-hidden overscroll-contain"
                }
            >
                <div
                    className={
                        state.locked
                            ? undefined
                            : "cursor-grab touch-none select-none active:cursor-grabbing"
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
                <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-edge-hairline bg-background/85 p-0.5 shadow-sm backdrop-blur">
                    {!state.locked ? (
                        <>
                            <button
                                type="button"
                                onClick={zoomIn}
                                aria-label="放大"
                                title="放大"
                                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <ZoomIn className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={zoomOut}
                                aria-label="缩小"
                                title="缩小"
                                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <ZoomOut className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                aria-label="重置缩放"
                                title="重置缩放与位置"
                                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <RotateCcw className="size-3.5" />
                            </button>
                            <span className="w-9 text-center text-[10px] tabular-nums text-muted-foreground">
                                {Math.round(state.scale * 100)}%
                            </span>
                            <span className="mx-0.5 h-4 w-px bg-border" />
                        </>
                    ) : null}
                    {onCopySource ? (
                        <button
                            type="button"
                            onClick={onCopySource}
                            aria-label="复制 mermaid 源码"
                            title={copied ? "已复制" : "复制源码"}
                            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            {copied ? (
                                <Check className="size-3.5 text-emerald-500" />
                            ) : (
                                <Copy className="size-3.5" />
                            )}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={toggleLock}
                        aria-label={state.locked ? "解锁缩放" : "锁定缩放"}
                        title={state.locked ? "解锁缩放（可平移放大）" : "锁定（恢复页面滚动）"}
                        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        {state.locked ? (
                            <Lock className="size-3.5" />
                        ) : (
                            <Unlock className="size-3.5" />
                        )}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
