/**
 * 表情面板组件
 * Bilibili 风格的表情选择面板
 */

import { useState, useRef, useEffect } from "react";
import { Search, X, Loader2, Smile, Image as ImageIcon, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiItem } from "./EmojiItem";
import { getUploadUrl } from "@/lib/api";
import type { EmojiGroup, Emoji } from "@/types/emoji";

interface EmojiPanelProps {
  /** 表情分组列表 */
  groups: EmojiGroup[];
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 选择表情回调 */
  onSelect: (emoji: Emoji) => void;
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
 */
export function EmojiPanel({
  groups,
  loading = false,
  error = null,
  onSelect,
  className,
}: EmojiPanelProps) {
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollHint, setShowScrollHint] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // 初始化激活第一个分组
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  // 检测是否需要滚动指示器
  useEffect(() => {
    const checkScroll = () => {
      if (categoryScrollRef.current) {
        const el = categoryScrollRef.current;
        setShowScrollHint(el.scrollWidth > el.clientWidth + 10);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [groups]);

  // 当前分组
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  // 搜索过滤
  const filteredEmojis = searchQuery.trim()
    ? groups.flatMap(g => g.emojis || []).filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (activeGroup?.emojis || []).sort((a, b) => a.sort_order - b.sort_order);

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
        const buttonLeft = buttonRect.left - containerRect.left + container.scrollLeft;
        const buttonRight = buttonLeft + buttonRect.width;

        if (buttonLeft < container.scrollLeft) {
          container.scrollTo({ left: buttonLeft - 16, behavior: 'smooth' });
        } else if (buttonRight > container.scrollLeft + container.clientWidth) {
          container.scrollTo({ left: buttonRight - container.clientWidth + 16, behavior: 'smooth' });
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
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
              aria-label="清除搜索"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 中部：分组标签 */}
      <div className="border-b border-border bg-muted/30 relative">
        {showScrollHint && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/30 to-transparent z-10" />
        )}
        <div
          ref={categoryScrollRef}
          className="flex gap-1 p-2 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
                >
                  {sourceIcons[group.source]}
                  <span>{group.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 主体：表情网格 */}
      <div className="flex-1 overflow-y-auto p-2 min-h-50">
        {error && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {searchQuery && filteredEmojis.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            未找到匹配的表情
          </div>
        )}

        {!loading && !error && filteredEmojis.length > 0 && (
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((emoji) => (
              <EmojiItem
                key={emoji.id}
                emoji={emoji}
                onClick={() => onSelect(emoji)}
              />
            ))}
          </div>
        )}

        {!loading && !error && !searchQuery && filteredEmojis.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            该分组暂无表情
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          点击表情插入到评论中
        </p>
      </div>
    </div>
  );
}