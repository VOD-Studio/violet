import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "./use-debounced-callback";

/**
 * useDebouncedValue - 延迟返回最新值（值防抖）
 *
 * 基于 useDebouncedCallback 实现，trailing 触发后更新内部 state。
 * 支持自定义 equalityFn：对对象/数组值，同结构不重发（默认 Object.is），
 * 修复「每次渲染新建对象导致定时器不断重置、永不发射」的陷阱。
 *
 * @param value 待防抖的值
 * @param delay 延迟毫秒，默认 300
 * @param equalityFn 相等判断，默认 Object.is
 *
 * @example
 * // 基本值防抖
 * const debounced = useDebouncedValue(keyword, 300);
 *
 * // 对象值防抖（同结构不重发）
 * const debounced = useDebouncedValue(filter, 300, (a, b) => a.q === b.q);
 */
export function useDebouncedValue<T>(
    value: T,
    delay = 300,
    equalityFn: (prev: T, next: T) => boolean = Object.is,
): T {
    const [debounced, setDebounced] = useState(value);
    // 记录上一次防抖发射的值，用 equalityFn 判断是否需要重新挂起
    const lastEmitted = useRef(value);

    const debouncedCb = useDebouncedCallback(
        (next: T) => {
            lastEmitted.current = next;
            setDebounced(next);
        },
        { delay },
    );

    useEffect(() => {
        // 相等则不挂起，避免无谓的定时器与渲染
        if (equalityFn(lastEmitted.current, value)) return;
        debouncedCb.run(value);
    }, [value, equalityFn, debouncedCb]);

    return debounced;
}
