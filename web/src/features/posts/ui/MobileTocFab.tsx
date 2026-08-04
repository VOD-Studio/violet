/**
 * MobileTocFab - 小屏目录浮动按钮 + 底部 Sheet
 *
 * 仅在 2xl 以下屏幕显示（大屏已有左侧固定 TOC）。点击弹出底部 Sheet 展示
 * 图标节点树目录；选中条目后平滑滚动到对应 heading 并自动关闭 Sheet。
 *
 * 与 BackToTop 在详情页共享同一个 fixed 容器（flex-col 竖列），避免右下角重叠。
 */
import ArticleToc, { type ArticleTocProps } from "@features/posts/ui/ArticleToc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/base/sheet";
import { ListTree } from "lucide-react";
import { useState } from "react";

interface MobileTocFabProps {
    items: ArticleTocProps["items"];
    contentRef: ArticleTocProps["contentRef"];
}

const MobileTocFab = ({ items, contentRef }: MobileTocFabProps) => {
    const [open, setOpen] = useState(false);

    if (!items.length) return null;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="打开目录"
                className="group flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/80 shadow-lg backdrop-blur transition-all duration-300 hover:border-primary/50 hover:bg-accent active:scale-90"
            >
                <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                <ListTree className="relative size-5 transition-transform duration-300 group-hover:scale-110" />
            </button>
            <SheetContent side="bottom" className="max-h-[70vh] p-0">
                <SheetHeader className="border-b border-edge-hairline">
                    <SheetTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        目录
                    </SheetTitle>
                </SheetHeader>
                <div className="max-h-[60vh] overflow-hidden px-4 py-4">
                    <ArticleToc
                        items={items}
                        contentRef={contentRef}
                        hideTitle
                        forceFocus={open}
                        onNavigate={() => setOpen(false)}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default MobileTocFab;
