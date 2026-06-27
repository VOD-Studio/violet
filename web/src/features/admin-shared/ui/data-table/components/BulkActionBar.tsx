import type { ReactNode } from "react";

interface BulkActionBarProps {
    /** 当前选中行数 */
    selectedCount: number;
    /** 清空选择 */
    onClear: () => void;
    /** 批量操作按钮区，由调用方传入 */
    children?: ReactNode;
}

/**
 * BulkActionBar - 底部浮动批量操作条
 *
 * 选中行数 > 0 时从底部滑入，含选中数播报与清空按钮，
 * 中部由调用方填充具体操作（批量删除等）。
 */
export function BulkActionBar({ selectedCount, onClear, children }: BulkActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div
            className="bg-card animate-in fade-in-0 slide-in-from-bottom-4 fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-3xl items-center gap-3 rounded-lg border p-3 shadow-lg"
            aria-live="polite"
        >
            <span className="text-sm font-medium">
                已选 <span className="text-primary">{selectedCount}</span> 项
            </span>
            <div className="ml-auto flex items-center gap-2">
                {children}
                <button
                    type="button"
                    onClick={onClear}
                    className="text-muted-foreground hover:text-foreground text-sm"
                >
                    取消选择
                </button>
            </div>
        </div>
    );
}
