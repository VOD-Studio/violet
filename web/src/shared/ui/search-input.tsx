"use client";

import { Loader2, Search, X } from "lucide-react";
import { type ComponentProps, useCallback, useId, useRef, useState } from "react";
import { useDebouncedCallback } from "@/shared/lib/hooks/use-debounced-callback";
import { cn } from "@/shared/lib/utils";

export interface SearchInputProps
    extends Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size"> {
    /** 受控值；传则受控，须配 onValueChange 回写 */
    value?: string;
    /** 非受控初值 */
    defaultValue?: string;
    /** 实时值回调（每次击键，未经防抖） */
    onValueChange?: (value: string) => void;
    /** 防抖后值回调（默认 300ms 静默期后触发，回车立即触发） */
    onSearch?: (value: string) => void;
    /** 防抖延迟，默认 300ms */
    delay?: number;
    /** 是否显示加载中 spinner（覆盖清除按钮） */
    loading?: boolean;
    /** 尺寸，default 对应 h-9，sm 对应 h-8 */
    size?: "default" | "sm";
    /** 清除回调（点击 × 时额外触发，onSearch("") 仍会调用） */
    onClear?: () => void;
}

const sizeMap = {
    default: "h-9 text-sm pl-9 pr-9",
    sm: "h-8 text-xs pl-7 pr-8",
};

const iconSizeMap = {
    default: "size-4",
    sm: "size-3.5",
};

/**
 * SearchInput - 带防抖的搜索输入框
 *
 * 内置防抖能力，使用方无法漏接：传 onSearch 即自动防抖（默认 300ms）。
 * 双回调设计兼顾灵活性：
 * - onValueChange：实时值，每次击键触发（供 live UI 如空态文案）
 * - onSearch：防抖值，静默期后或回车时触发（供查询请求）
 *
 * 交互：
 * - 回车：flush 立即触发挂起的 onSearch
 * - 清除（×）：cancel 丢弃挂起，立即触发 onSearch("") + onClear
 * - loading：显示 spinner 覆盖 ×
 *
 * 受控/非受控：
 * - 传 value 受控，必须配 onValueChange 回写
 * - 不传 value 用 defaultValue 非受控，仅需 onSearch 拿防抖结果
 *
 * @example
 * // 非受控（最常见）
 * <SearchInput defaultValue="" onSearch={setKeyword} />
 *
 * // 受控（需 live 值）
 * <SearchInput value={q} onValueChange={setQ} onSearch={setFilteredQ} />
 */
export function SearchInput({
    value,
    defaultValue = "",
    onValueChange,
    onSearch,
    delay = 300,
    loading = false,
    size = "default",
    onClear,
    className,
    placeholder,
    ...rest
}: SearchInputProps) {
    const reactId = useId();
    // 非受控内部值
    const [inner, setInner] = useState(defaultValue);
    const isControlled = value !== undefined;
    const currentValue = isControlled ? (value as string) : inner;

    // 防抖：trailing-only，挂载时不触发（trailing 天然跳过初值）
    const debounced = useDebouncedCallback(
        (v: string) => {
            onSearch?.(v);
        },
        { delay },
    );

    const update = useCallback(
        (next: string) => {
            if (!isControlled) setInner(next);
            onValueChange?.(next);
            onSearch ? debounced.run(next) : undefined;
        },
        [isControlled, onValueChange, onSearch, debounced],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        update(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // 回车立即触发挂起的防抖调用
            if (onSearch) debounced.flush();
        }
    };

    const handleClear = () => {
        debounced.cancel();
        if (!isControlled) setInner("");
        onValueChange?.("");
        onSearch?.("");
        onClear?.();
    };

    const showClear = !loading && currentValue.length > 0;
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            role="search"
            className={cn(
                "relative flex items-center",
                size === "sm" ? "text-xs" : "text-sm",
                className,
            )}
        >
            <Search
                className={cn(
                    "pointer-events-none absolute left-2.5 text-muted-foreground",
                    iconSizeMap[size],
                )}
                aria-hidden="true"
            />
            <input
                ref={inputRef}
                id={rest.id ?? `search-${reactId}`}
                type="text"
                value={currentValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder ?? "搜索…"}
                className={cn(
                    "w-full rounded-md border border-input bg-background text-foreground",
                    "ring-offset-background placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    sizeMap[size],
                )}
                {...rest}
            />
            {loading ? (
                <Loader2
                    className={cn(
                        "absolute right-2.5 animate-spin text-muted-foreground",
                        iconSizeMap[size],
                    )}
                    aria-hidden="true"
                />
            ) : showClear ? (
                <button
                    type="button"
                    onClick={handleClear}
                    className={cn(
                        "absolute right-2 flex items-center justify-center rounded-full",
                        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        size === "sm" ? "size-5" : "size-6",
                    )}
                    aria-label="清除搜索"
                    tabIndex={-1}
                >
                    <X className={size === "sm" ? "size-3" : "size-3.5"} />
                </button>
            ) : null}
        </div>
    );
}
