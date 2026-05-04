/**
 * 表情面板组件
 * Bilibili 风格的表情选择面板
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Loader2, Smile, Image as ImageIcon, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiItem } from "./EmojiItem";
import { getUploadUrl } from "@/lib/api";
import type { EmojiGroup } from "@/types/emoji";
import type { EmojiItem as EmojiItemType } from "@/hooks/useEmojis";

interface EmojiPanelProps {
  /** 表情分组列表 */
  groups: EmojiGroup[];
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 搜索函数 */
  onSearch: (query: string) => EmojiItemType[];
  /** 选择表情回调 */
  onSelect: (emojiName: string, emojiDisplay: string) => void;
  /** 自定义样式 */
  className?: string;
}

const sourceIcons: Record<string, React.ReactNode> = {
  custom: <ImageIcon className="w-4 h-4" />,
  bilibili: <Smile className="w-4 h-4" />,
  system: <Type className="w-4 h-4" />,
};

/**
 * 表情面板
 * 固定宽度 360px，最大高度 420px
 */
export function EmojiPanel({
  groups,
  loading = false,
  error = null,
  onSearch,
  onSelect,
  className,
}: EmojiPanelProps) {
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmojiItemType[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // 初始化激活第一个分组
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const results = onSearch(searchQuery);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  // 当前显示的表情列表
  const currentItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return [];

    return (group.emojis || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((emoji) => ({
        id: emoji.id,
        name: emoji.name,
        display: emoji.url
          ? getUploadUrl(emoji.url)
          : emoji.text_content || emoji.name,
        syntax: `[${emoji.name}]`,
        source: group.source,
      }));
  }, [searchQuery, searchResults, groups, activeGroupId]);

  const handleSelect = (item: EmojiItemType) => {
    onSelect(item.name, item.display);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleGroupClick = (groupId: number) => {
    setActiveGroupId(groupId);
    setSearchQuery("");

    // 自动滚动到选中的分组
    if (categoryScrollRef.current) {
      const container = categoryScrollRef.current;
      const activeButton = container.querySelector(`button[data-group-id="${groupId}"]`) as HTMLElement;

      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        // 计算按钮相对于容器的位置
        const buttonLeft = buttonRect.left - containerRect.left + container.scrollLeft;
        const buttonRight = buttonLeft + buttonRect.width;

        // 如果按钮在可视区域外，滚动到合适位置
        if (buttonLeft < container.scrollLeft) {
          // 按钮在左侧外面，滚动到左边
          container.scrollTo({
            left: buttonLeft - 16, // 留 16px 边距
            behavior: 'smooth'
          });
        } else if (buttonRight > container.scrollLeft + container.clientWidth) {
          // 按钮在右侧外面，滚动到右边
          container.scrollTo({
            left: buttonRight - container.clientWidth + 16, // 留 16px 边距
            behavior: 'smooth'
          });
        }
      }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-background shadow-lg",
        "w-90 max-h-105",
        className
      )}
    >
      {/* 顶部：搜索框 */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索表情..."
            className={cn(
              "w-full h-9 pl-9 pr-8 rounded-lg",
              "border border-input bg-transparent",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
              "transition-colors"
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
              aria-label="清除搜索"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 中部：分组标签（横向滚动，带下划线指示器） */}
      <div className="border-b border-border bg-muted/30">
        <div
          ref={categoryScrollRef}
          className="flex gap-1 p-2 overflow-x-auto scrollbar-hide relative"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center w-full h-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            groups.map((group) => {
              const isActive = activeGroupId === group.id && !searchQuery;
              return (
                <button
                  key={group.id}
                  type="button"
                  data-group-id={group.id}
                  onClick={() => handleGroupClick(group.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 h-8 rounded-md",
                    "text-sm font-medium whitespace-nowrap",
                    "transition-all duration-200",
                    isActive
                      ? "text-foreground bg-accent/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  aria-label={`切换到 ${group.name} 分组`}
                >
                  {sourceIcons[group.source]}
                  <span>{group.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 主体：表情网格（8 列） */}
      <div className="flex-1 overflow-y-auto p-2 min-h-50">
        {error && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            未找到匹配的表情
          </div>
        )}

        {!loading && !error && currentItems.length > 0 && (
          <div className="grid grid-cols-8 gap-1">
            {currentItems.map((item) => {
              const isImage =
                item.source === "custom" ||
                item.display.startsWith("http") ||
                item.display.startsWith("/");

              return (
                <EmojiItem
                  key={`${item.source}-${item.id}`}
                  id={item.id}
                  name={item.name}
                  display={item.display}
                  isImage={isImage}
                  onClick={() => handleSelect(item)}
                />
              );
            })}
          </div>
        )}

        {!loading && !error && !searchQuery && currentItems.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            该分组暂无表情
          </div>
        )}
      </div>

      {/* 底部：提示文字 */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          点击表情插入到评论中
        </p>
      </div>
    </div>
  );
}
