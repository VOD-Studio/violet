import { useState, useRef, useEffect, useMemo } from 'react';
import { useStickers, type StickerItem } from '@/hooks/useStickers';
import { cn } from '@/lib/utils';
import { Search, X, Loader2, Smile, Image, PenTool } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (syntax: string) => void;
  onClose?: () => void;
  className?: string;
}

// 类型图标映射
const typeIcons: Record<string, React.ReactNode> = {
  custom: <Image className="size-4" />,
  emoji: <Smile className="size-4" />,
  kaomoji: <PenTool className="size-4" />,
};

export function StickerPicker({ onSelect, onClose, className }: StickerPickerProps) {
  const { categories, loading, error, search } = useStickers();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StickerItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 热门分类和官方分类优先排序
  const sortedCategories = useMemo(() => {
    const hot = categories.filter(c => c.isHot);
    const official = categories.filter(c => c.isOfficial && !c.isHot);
    const others = categories.filter(c => !c.isHot && !c.isOfficial);
    return [...hot, ...official, ...others];
  }, [categories]);

  // 初始化时选择第一个分类
  useEffect(() => {
    if (sortedCategories.length > 0 && !activeCategory) {
      setActiveCategory(sortedCategories[0].id);
    }
  }, [sortedCategories, activeCategory]);

  // 搜索处理
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = search(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, search]);

  // 当前显示的表情列表
  const currentItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    const category = categories.find(c => c.id === activeCategory);
    return category?.items || [];
  }, [searchQuery, searchResults, categories, activeCategory]);

  // 处理选择
  const handleSelect = (item: StickerItem) => {
    onSelect(item.syntax);
    onClose?.();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (searchQuery) {
        setSearchQuery('');
      } else {
        onClose?.();
      }
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-background shadow-lg',
        'w-[320px] max-h-[400px]',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {/* 搜索框 */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索表情..."
            className={cn(
              'w-full h-8 pl-9 pr-8 rounded-lg',
              'border border-input bg-transparent',
              'text-sm placeholder:text-muted-foreground',
              'focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30',
              'transition-colors'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex border-b border-border bg-muted/30">
        <div className="flex gap-1 p-2 overflow-x-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center w-full h-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            sortedCategories.map(category => (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                  setSearchQuery('');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-md',
                  'text-sm font-medium whitespace-nowrap',
                  'transition-colors',
                  activeCategory === category.id && !searchQuery
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {typeIcons[category.type]}
                <span>{category.name}</span>
                {category.isHot && (
                  <span className="text-xs text-orange-500">HOT</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 表情网格 */}
      <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
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
            {currentItems.map(item => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item)}
                className={cn(
                  'flex items-center justify-center',
                  'w-10 h-10 rounded-lg',
                  'bg-muted/50 hover:bg-muted',
                  'transition-colors cursor-pointer',
                  'focus:outline-none focus:ring-2 focus:ring-ring/50'
                )}
                title={item.name}
              >
                {item.type === 'custom' ? (
                  <img
                    src={item.display}
                    alt={item.name}
                    className="w-8 h-8 rounded object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className={cn(
                      'text-center',
                      item.type === 'emoji' ? 'text-xl' : 'text-xs leading-tight'
                    )}
                  >
                    {item.display}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && !error && !searchQuery && currentItems.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            该分类暂无表情
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          点击表情插入到评论中
        </p>
      </div>
    </div>
  );
}

// 带 Popover 的表情选择器按钮
import { useState as useStatePopover } from 'react';
import { createPortal } from 'react-dom';

interface StickerPickerButtonProps {
  onSelect: (syntax: string) => void;
  className?: string;
}

export function StickerPickerButton({ onSelect, className }: StickerPickerButtonProps) {
  const [isOpen, setIsOpen] = useStatePopover(false);
  const [position, setPosition] = useStatePopover({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const pickerWidth = 320;
      const pickerHeight = 400;

      // 计算位置：优先显示在按钮上方
      let top = rect.top - pickerHeight - 8;
      let left = rect.left;

      // 如果上方空间不足，显示在下方
      if (top < 0) {
        top = rect.bottom + 8;
      }

      // 确保不超出右边界
      if (left + pickerWidth > window.innerWidth) {
        left = window.innerWidth - pickerWidth - 16;
      }

      // 确保不超出左边界
      if (left < 16) {
        left = 16;
      }

      setPosition({ top, left });
    }
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={cn(
          'flex items-center justify-center size-8 rounded-lg',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'transition-colors',
          isOpen && 'text-foreground bg-muted',
          className
        )}
        title="选择表情"
      >
        <Smile className="size-5" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-50"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            <StickerPicker onSelect={onSelect} onClose={handleClose} />
          </div>,
          document.body
        )}
    </>
  );
}

export default StickerPicker;