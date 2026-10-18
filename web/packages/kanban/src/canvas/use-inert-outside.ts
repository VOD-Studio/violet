import { type RefObject, useEffect } from "react";

/**
 * `active` 期间让 `root` 之外的页面内容不可聚焦、不被读屏读到。
 *
 * 全屏的画布只是盖在页面上的一层，页面本身仍在文档里；给 `root` 各级祖先的兄弟节点加上 `inert`，
 * Tab 就不会跑到被遮住的内容里。
 */
export function useInertOutside(root: RefObject<HTMLElement | null>, active: boolean) {
	useEffect(() => {
		const node = root.current;
		if (!active || !node) return;
		const marked: Element[] = [];
		for (
			let current: Element = node;
			current !== document.body && current.parentElement;
			current = current.parentElement
		) {
			for (const sibling of current.parentElement.children) {
				if (sibling === current || sibling.hasAttribute("inert")) continue;
				sibling.setAttribute("inert", "");
				marked.push(sibling);
			}
		}
		return () => {
			for (const element of marked) element.removeAttribute("inert");
		};
	}, [root, active]);
}
