import { useState, useRef, useEffect, useMemo } from "react";
import { useEmojis, type EmojiItem } from "@/hooks/useEmojis";
import { cn } from "@/lib/utils";
import { Search, X, Loader2, Smile, Image, Type } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (syntax: string) => void;
  onClose?: () => void;
  className?: string;
}

const sourceIcons: Record<string, React.ReactNode> = {
  custom: <Image className="size-4" />,
  bilibili: <Smile className="size-4" />,
  system: <Type className="size-4" />,
};

export function EmojiPicker({
  onSelect,
  onClose,
  className,
}: EmojiPickerProps) {
  const { categories, loading, error, search } = useEmojis();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmojiItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = search(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, search]);

  const currentItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    const category = categories.find((c) => c.id === activeCategory);
    return category?.items || [];
  }, [searchQuery, searchResults, categories, activeCategory]);

  const handleSelect = (item: EmojiItem) => {
    onSelect(item.syntax);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (searchQuery) {
        setSearchQuery("");
      } else {
        onClose?.();
      }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-background shadow-lg",
        "w-[320px] max-h-100",
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索表情..."
            className={cn(
              "w-full h-8 pl-9 pr-8 rounded-lg",
              "border border-input bg-transparent",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
              "transition-colors"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border bg-muted/30">
        <div className="flex gap-1 p-2 overflow-x-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center w-full h-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-7 rounded-md",
                  "text-sm font-medium whitespace-nowrap",
                  "transition-colors",
                  activeCategory === category.id && !searchQuery
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {sourceIcons[category.source]}
                <span>{category.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-50">
        {error && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            未找到匹配的表情
          </div>
        )}

        {!loading && !error && currentItems.length > 0 && (
          <div className="grid grid-cols-6 gap-2">
            {currentItems.map((item) => (
              <button
                key={`${item.source}-${item.id}`}
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex items-center justify-center",
                  "w-10 h-10 rounded-lg",
                  "bg-muted/50 hover:bg-muted",
                  "transition-colors cursor-pointer",
                  "focus:outline-none focus:ring-2 focus:ring-ring/50"
                )}
                title={item.name}
              >
                {item.source === "custom" ||
                item.display.startsWith("http") ||
                item.display.startsWith("/") ? (
                  <img
                    src={item.display}
                    alt={item.name}
                    className="w-8 h-8 rounded object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xl text-center leading-tight">
                    {item.display}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && !error && !searchQuery && currentItems.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            该分组暂无表情
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">点击表情插入到评论中</p>
      </div>
    </div>
  );
}

export default EmojiPicker;
