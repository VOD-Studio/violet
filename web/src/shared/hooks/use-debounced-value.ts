import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "./use-debounced-callback";

/**
 * 对高频变化的值进行防抖延迟返回。
 *
 * @typeParam T - 目标值类型
 *
 * @param value - 待防抖的目标值
 * @param delay - 防抖等待毫秒数，默认 300
 * @param equalityFn - 自定义新旧值相等比较函数，默认 `Object.is`
 *
 * @returns 经过防抖延迟后的最新值
 *
 * @example
 * ```tsx
 * // 基本输入防抖
 * const debouncedKeyword = useDebouncedValue(keyword, 300);
 *
 * // 对象浅对比防抖
 * const debouncedFilter = useDebouncedValue(filter, 300, (a, b) => a.id === b.id);
 * ```
 */
export function useDebouncedValue<T>(
	value: T,
	delay = 300,
	equalityFn: (prev: T, next: T) => boolean = Object.is,
): T {
	const [debounced, setDebounced] = useState(value);
	const lastEmitted = useRef(value);

	const debouncedCb = useDebouncedCallback(
		(next: T) => {
			lastEmitted.current = next;
			setDebounced(next);
		},
		{ delay },
	);

	useEffect(() => {
		if (equalityFn(lastEmitted.current, value)) return;
		debouncedCb.run(value);
	}, [value, equalityFn, debouncedCb]);

	return debounced;
}
