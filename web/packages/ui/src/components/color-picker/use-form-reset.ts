import { type RefObject, useEffect, useRef } from "react";

/**
 * 原生 input 所属 form（含 `form` 属性指向的外部表单）发生未取消的 reset 时执行 `reset`。
 * 监听挂在捕获阶段，等 reset 事件派发完再判断 `defaultPrevented`，所以宿主 `onReset` 里的 preventDefault 生效。
 */
export function useFormReset(input: RefObject<HTMLInputElement | null>, reset: () => void) {
	const latest = useRef(reset);
	latest.current = reset;
	useEffect(() => {
		const node = input.current;
		if (!node) return;
		let live = true;
		const pending = new WeakSet<Event>();
		const listener = (event: Event) => {
			if (!node.form || event.target !== node.form || pending.has(event)) return;
			pending.add(event);
			const finish = () => {
				if (!live) return;
				if (event.eventPhase !== Event.NONE) {
					setTimeout(finish, 0);
					return;
				}
				if (!event.defaultPrevented) latest.current();
			};
			queueMicrotask(finish);
		};
		const scopes = new Set([node.ownerDocument, node.getRootNode()]);
		for (const scope of scopes) scope.addEventListener("reset", listener, true);
		return () => {
			live = false;
			for (const scope of scopes) scope.removeEventListener("reset", listener, true);
		};
	}, [input]);
}
