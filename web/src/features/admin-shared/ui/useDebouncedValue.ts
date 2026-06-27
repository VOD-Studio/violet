import { useEffect, useState } from "react";

/**
 * useDebouncedValue - 延迟返回最新值
 *
 * 输入变化后在 delay ms 内无新变化才更新返回值，
 * 用于搜索框等高频输入避免每次击键触发重渲染或请求。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}
