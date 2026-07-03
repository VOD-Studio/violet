import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/base/select";
import { Pagination } from "./Pagination";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

interface DataTableFooterProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    /** 可选每页条数；提供 onPageSizeChange 时才显示切换器 */
    pageSizeOptions?: number[];
    onPageSizeChange?: (size: number) => void;
}

/**
 * DataTableFooter - 底部分页栏
 *
 * 左侧总数信息与每页条数切换（可选），右侧数字分页。
 */
export function DataTableFooter({
    page,
    pageSize,
    total,
    onPageChange,
    pageSizeOptions,
    onPageSizeChange,
}: DataTableFooterProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const sizeOptions = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
    const showSizeSelect = onPageSizeChange != null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span>
                    共 <span className="text-foreground font-medium">{total}</span> 条 · 第 {page}/
                    {totalPages} 页
                </span>
                {showSizeSelect && (
                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) => onPageSizeChange?.(Number(v))}
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-7 w-[112px] text-xs"
                            aria-label="每页条数"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {sizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size} 条/页
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
    );
}
