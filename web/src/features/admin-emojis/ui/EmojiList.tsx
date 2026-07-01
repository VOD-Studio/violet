import type { Emoji } from "@entities/emoji/model/types";
import { Pagination } from "@features/admin-shared/ui/data-table/components/Pagination";
import { Button } from "@shared/ui/button";
import { CheckSquare, Images, Search, Square } from "lucide-react";
import { useMemo } from "react";
import { EmojiCard } from "./EmojiCard";

const PAGE_SIZE = 40;

interface EmojiListProps {
    emojis: Emoji[];
    searchQuery: string;
    currentPage: number;
    onPageChange: (page: number) => void;
    isSelectMode: boolean;
    selectedIds: Set<number>;
    onToggleSelect: (id: number) => void;
    onToggleSelectAll: () => void;
    onEdit: (emoji: Emoji) => void;
    onDelete: (id: number) => void;
}

/**
 * EmojiList - 表情列表
 *
 * 按搜索词过滤后分页，每页 PAGE_SIZE 项。
 * 批量模式下提供当前页全选，空态区分无数据与无搜索结果。
 */
export function EmojiList({
    emojis,
    searchQuery,
    currentPage,
    onPageChange,
    isSelectMode,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onEdit,
    onDelete,
}: EmojiListProps) {
    const filteredEmojis = useMemo(() => {
        if (!searchQuery.trim()) return emojis;
        const query = searchQuery.toLowerCase();
        return emojis.filter(
            (emoji) =>
                emoji.name.toLowerCase().includes(query) ||
                emoji.text_content?.toLowerCase().includes(query),
        );
    }, [emojis, searchQuery]);

    const totalPages = Math.ceil(filteredEmojis.length / PAGE_SIZE);
    const paginatedEmojis = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEmojis.slice(start, start + PAGE_SIZE);
    }, [filteredEmojis, currentPage]);

    if (paginatedEmojis.length === 0) {
        if (searchQuery) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="mb-2 size-8" />
                    <p>未找到匹配的表情</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Images className="mb-2 size-8" />
                <p>暂无表情</p>
                <p className="mt-1 text-sm">切换到上传标签页添加表情</p>
            </div>
        );
    }

    const allSelected = paginatedEmojis.every((e) => selectedIds.has(e.id));

    return (
        <>
            {isSelectMode && (
                <div className="mb-3 flex items-center gap-2 px-1">
                    <Button variant="ghost" size="sm" onClick={onToggleSelectAll}>
                        {allSelected ? (
                            <>
                                <CheckSquare className="mr-1 size-4" />
                                取消全选当前页
                            </>
                        ) : (
                            <>
                                <Square className="mr-1 size-4" />
                                全选当前页
                            </>
                        )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        已选择 {selectedIds.size} 个
                    </span>
                </div>
            )}

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                {paginatedEmojis.map((emoji) => (
                    <EmojiCard
                        key={emoji.id}
                        emoji={emoji}
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.has(emoji.id)}
                        onToggleSelect={() => onToggleSelect(emoji.id)}
                        onEdit={() => onEdit(emoji)}
                        onDelete={() => onDelete(emoji.id)}
                    />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-4">
                    <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </>
    );
}
