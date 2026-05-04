import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { EmojiCard } from "./EmojiCard";
import { Search, Images, CheckSquare, Square } from "lucide-react";
import type { EmojiAdmin } from "../types";

const PAGE_SIZE = 40;

interface EmojiListProps {
  emojis: EmojiAdmin[];
  searchQuery: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  isSelectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onEdit: (emoji: EmojiAdmin) => void;
  onDelete: (id: number) => void;
}

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
        emoji.textContent?.toLowerCase().includes(query)
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
          <Search className="size-8 mb-2" />
          <p>未找到匹配的表情</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Images className="size-8 mb-2" />
        <p>暂无表情</p>
        <p className="text-sm mt-1">切换到"上传"标签页添加表情</p>
      </div>
    );
  }

  return (
    <>
      {isSelectMode && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Button variant="ghost" size="sm" onClick={onToggleSelectAll}>
            {paginatedEmojis.every((e) => selectedIds.has(e.id)) ? (
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}
