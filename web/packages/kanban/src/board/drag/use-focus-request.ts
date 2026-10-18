import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";
import { findCard } from "./dom.ts";

/**
 * 把焦点还给某张卡片：卡片跨列移动或回滚会重新挂载，焦点随旧节点丢失，要在重新挂载后补回。
 *
 * @returns `request(cardId)` 无条件补回焦点；`restore(cardId)` 仅在焦点已经丢失或仍在看板内时补回
 */
export function useFocusRequest(rootRef: RefObject<HTMLElement | null>) {
	const [tick, setTick] = useState(0);
	const pending = useRef<string | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: tick 仅作触发时机，副作用读取的是 DOM
	useLayoutEffect(() => {
		const root = rootRef.current;
		const cardId = pending.current;
		pending.current = null;
		if (!root || !cardId) return;
		const element = findCard(root, cardId);
		if (element && document.activeElement !== element) element.focus();
	}, [tick, rootRef]);
	const request = useCallback((cardId: string) => {
		pending.current = cardId;
		setTick((value) => value + 1);
	}, []);
	const restore = useCallback(
		(cardId: string) => {
			const active = document.activeElement;
			if (!active || active === document.body || rootRef.current?.contains(active))
				request(cardId);
		},
		[request, rootRef],
	);
	return { request, restore };
}
