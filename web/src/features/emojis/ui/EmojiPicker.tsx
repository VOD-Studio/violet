/**
 * EmojiPicker - 表情选择器
 *
 * 基于后端 GET /emojis 返回的分组数据，按分组标签页展示可点击表情网格。
 * 图片表情用 img 渲染，纯文字表情用 text_content 兜底。
 */
import type { Emoji } from "@entities/emoji/model/types";
import { useAllEmojis } from "@features/emojis/api/queries";
import { isImageURL } from "@shared/lib/url";
import { Button } from "@shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { ScrollArea } from "@shared/ui/scroll-area";
import { Loader2, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface EmojiPickerProps {
    /** 触发器按钮，未传时使用默认笑脸图标 */
    trigger?: React.ReactNode;
    /** 选中表情回调 */
    onSelect: (emoji: Emoji) => void;
    /** 弹窗对齐方式 */
    align?: "start" | "center" | "end";
    /** 已选中的表情 ID 集合，用于禁用/标识已选项 */
    selectedIds?: Set<number>;
}

/**
 * EmojiPicker - 表情选择浮层
 *
 * 首次打开时拉取全部启用分组，按分组标签展示。选择后自动关闭浮层。
 */
export function EmojiPicker({
    trigger,
    onSelect,
    align = "start",
    selectedIds = new Set(),
}: EmojiPickerProps) {
    const [open, setOpen] = useState(false);
    const { data: groups = [], isLoading } = useAllEmojis();

    const firstGroup = groups[0]?.name ?? "";
    const [activeGroup, setActiveGroup] = useState(firstGroup);
    const tabsListRef = useRef<HTMLDivElement>(null);
    const activeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setActiveGroup(firstGroup);
    }, [firstGroup]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: 需要监听 activeGroup 变化以滚动当前标签到可视区
    useEffect(() => {
        activeButtonRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
        });
    }, [activeGroup]);

    const handleSelect = (emoji: Emoji) => {
        onSelect(emoji);
        setOpen(false);
    };

    const activeIndex = groups.findIndex((g) => g.name === activeGroup);
    const activeGroupData = groups[activeIndex] ?? groups[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {trigger ?? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="添加表情"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Smile className="size-3.5" />
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                align={align}
                sideOffset={4}
                className="w-85 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            加载中…
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            暂无可用表情
                        </div>
                    ) : (
                        <div className="w-full">
                            <div
                                ref={tabsListRef}
                                className="relative mx-3 mt-3 flex flex-nowrap gap-1 overflow-x-auto bg-muted [&::-webkit-scrollbar]:hidden"
                                style={{ scrollbarWidth: "none" }}
                            >
                                <div
                                    className="absolute size-7 bg-popover transition-transform duration-200 ease-out"
                                    style={{
                                        transform: `translateX(calc(${Math.max(activeIndex, 0)} * (1.75rem + 0.25rem)))`,
                                    }}
                                />
                                {groups.map((group) => {
                                    const isActive = group.name === activeGroup;
                                    return (
                                        <button
                                            key={group.name}
                                            ref={isActive ? activeButtonRef : undefined}
                                            type="button"
                                            onClick={() => setActiveGroup(group.name)}
                                            title={group.name}
                                            className={`relative z-10 flex size-7 shrink-0 items-center justify-center text-xs transition-colors ${
                                                isActive
                                                    ? "font-medium text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {group.cover_url && isImageURL(group.cover_url) ? (
                                                <img
                                                    src={group.cover_url}
                                                    alt={group.name}
                                                    className="size-5 shrink-0 object-contain"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="truncate">{group.name}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <ScrollArea className="h-48 px-3 pb-3">
                                {activeGroupData && (
                                    <EmojiGrid
                                        emojis={activeGroupData.emojis}
                                        selectedIds={selectedIds}
                                        onSelect={handleSelect}
                                    />
                                )}
                            </ScrollArea>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// 根据颜文字长度决定占用网格列数：较短的占 2 列，较长的占 3 列。
function getTextEmojiSpan(text: string): 2 | 3 {
    return Array.from(text).length <= 5 ? 2 : 3;
}

/** EmojiGrid - 单分组内的表情网格 */
function EmojiGrid({
    emojis,
    selectedIds,
    onSelect,
}: {
    emojis: Emoji[];
    selectedIds: Set<number>;
    onSelect: (emoji: Emoji) => void;
}) {
    if (emojis.length === 0) {
        return <div className="py-6 text-center text-sm text-muted-foreground">该分组暂无表情</div>;
    }

    return (
        <div className="grid grid-cols-8 gap-1 pt-2">
            {emojis.map((emoji) => {
                const isSelected = selectedIds.has(emoji.id);
                const text = emoji.text_content ?? emoji.name;
                const imageUrl = emoji.gif_url || emoji.url;
                const isText = !imageUrl || !isImageURL(imageUrl);
                const textSpan = isText ? getTextEmojiSpan(text) : undefined;
                return (
                    <button
                        key={emoji.id}
                        type="button"
                        onClick={() => onSelect(emoji)}
                        title={isSelected ? `${emoji.name}（已选择）` : emoji.name}
                        disabled={isSelected}
                        className={`flex items-center justify-center overflow-hidden rounded-md p-1 transition-colors ${
                            isText
                                ? `${textSpan === 3 ? "col-span-3" : "col-span-2"} h-9 w-full`
                                : "size-9"
                        } ${isSelected ? "cursor-not-allowed opacity-40" : "hover:bg-accent"}`}
                    >
                        {imageUrl && isImageURL(imageUrl) ? (
                            <img
                                src={imageUrl}
                                alt={emoji.name}
                                className="h-full w-full object-contain"
                                loading="lazy"
                            />
                        ) : (
                            <span className="max-w-full truncate px-0.5 text-sm leading-none">
                                {text}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
