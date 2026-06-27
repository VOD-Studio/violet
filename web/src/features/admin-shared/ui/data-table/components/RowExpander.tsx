import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface RowExpanderProps {
    /** 该行是否已展开 */
    expanded: boolean;
    /** 切换展开态 */
    onToggle: () => void;
}

/**
 * RowExpander - 行展开切换按钮
 *
 * chevron 图标，展开时旋转 90°。
 */
export function RowExpander({ expanded, onToggle }: RowExpanderProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="hover:bg-accent flex size-6 items-center justify-center rounded transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? "收起" : "展开"}
        >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </button>
    );
}
