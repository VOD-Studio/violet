import { useLayoutEffect, useRef } from "react";

/** 返回始终指向最新值的引用，供稳定的事件处理函数读取。 */
export function useLatest<T>(value: T) {
	const ref = useRef(value);
	useLayoutEffect(() => {
		ref.current = value;
	});
	return ref;
}
