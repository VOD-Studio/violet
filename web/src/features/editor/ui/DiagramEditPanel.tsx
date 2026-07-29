/**
 * DiagramEditPanel - 图块编辑弹层面板
 *
 * 弹层内容：上方等宽 textarea（多行，rows 随源码行数自适应）mermaid 源码输入 +
 * 下方实时预览区（renderMermaid 异步，loading/error 态内联）+ 底部删除入口。
 * 1:1 参照 MathEditPanel 的布局，但预览核心从同步 KaTeX 换成异步 mermaid：
 * - loading 时沿用上一帧 SVG（由 useMermaidSvg 保留），叠加半透明 spinner
 * - 失败时内联显示具体错误（便于作者修，与阅读端「图表渲染失败」降级区分）
 *
 * 首期不做 mermaid 语法补全（LatexSourceField 的补全链路不移植）。
 * textarea 直接绑定 source（受控，由调用方走同事务更新）。
 *
 * 定位与开闭由 DiagramPopoverView 的 Portal 承载，本组件只管面板本身。
 */
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import type { MermaidRenderState } from "../hooks/useMermaidSvg";

export interface DiagramEditPanelProps {
    /** 当前 mermaid 源码（受控，来自 node.attrs.source） */
    source: string;
    /** 渲染状态（svg / error / loading），由调用方经 useMermaidSvg 计算 */
    render: MermaidRenderState;
    /** 源码变更回调（updateDiagramSource 由调用方触发） */
    onChange: (source: string) => void;
    /** Esc 请求关闭弹层 */
    onClose: () => void;
    /** 删除当前图块节点 */
    onDelete: () => void;
}

export function DiagramEditPanel({
    source,
    render,
    onChange,
    onClose,
    onDelete,
}: DiagramEditPanelProps) {
    return (
        <div className="flex w-[28rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
            <textarea
                value={source}
                spellCheck={false}
                rows={Math.min(12, Math.max(3, source.split("\n").length))}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
                placeholder={"graph TD\n    A --> B"}
                className="w-full resize-y rounded-md border border-edge-hairline bg-transparent px-2 py-1.5 font-mono text-sm leading-6 outline-none focus:border-ring"
            />
            {/* 实时预览：mermaid 异步渲染，loading 沿用上一帧 SVG 不闪空白；
                失败内联显示错误（便于作者修） */}
            <div className="relative max-h-72 overflow-auto rounded-md bg-muted/50 px-3 py-2">
                {render.error && !render.svg ? (
                    <p className="whitespace-pre-wrap break-all text-xs text-destructive">
                        {render.error}
                    </p>
                ) : render.svg ? (
                    <div
                        className="diagram-preview flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: svg 经 renderMermaid 内 DOMPurify 双重清理（svg/svgFilters profile + FORBID script），PRD 决议 mermaid SVG 不走 hast 白名单
                        dangerouslySetInnerHTML={{ __html: render.svg }}
                    />
                ) : (
                    <p className="text-center text-xs text-muted-foreground">
                        {source.trim() ? "渲染中…" : "输入 mermaid 源码查看预览"}
                    </p>
                )}
                {render.loading && render.svg ? (
                    <span className="pointer-events-none absolute right-2 top-2 inline-flex size-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground/60" />
                ) : null}
            </div>
            {/* 删除入口：atom 节点选中态被弹层抢焦点，键盘 Backspace 无法删除，
                故提供显式删除按钮（与 MathEditPanel 同款）。 */}
            <div className="flex justify-end pt-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 className="size-3" />
                    删除
                </Button>
            </div>
        </div>
    );
}
