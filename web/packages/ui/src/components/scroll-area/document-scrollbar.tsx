import { type RefObject, useEffect, useState } from "react";
import { Scrollbar } from "./scrollbar";
import { useScrollState } from "./use-scroll-state";

// 读取时才访问 document：模块在服务端导入不会出错，挂载后始终指向当前文档。
const documentViewport: RefObject<HTMLElement | null> = {
	get current() {
		return document.scrollingElement as HTMLElement | null;
	},
};

const documentContent: RefObject<HTMLElement | null> = {
	get current() {
		return document.body;
	},
};

function isOverflowLocked(element: HTMLElement): boolean {
	const overflow = getComputedStyle(element).overflowY;
	return overflow === "hidden" || overflow === "clip";
}

/** 弹层锁定页面滚动时（html 或 body 设为 overflow: hidden）返回 true。 */
function useDocumentScrollLocked(): boolean {
	const [locked, setLocked] = useState(false);

	useEffect(() => {
		const elements = [document.documentElement, document.body];
		const update = () => {
			setLocked(elements.some(isOverflowLocked));
		};

		// 锁定只改 style、class 或 data-scroll-locked，尺寸不变，ResizeObserver 发现不了。
		const observer = new MutationObserver(update);
		for (const element of elements) {
			observer.observe(element, {
				attributes: true,
				attributeFilter: ["style", "class", "data-scroll-locked"],
			});
		}

		update();
		return () => observer.disconnect();
	}, []);

	return locked;
}

/**
 * 用覆盖式滑块替换文档的原生滚动条，每个文档挂载一次。
 *
 * @remarks 页面仍由 window 滚动，锚点、页内查找与浏览器滚动恢复不受影响；
 * 弹层锁定滚动时同步隐藏，卸载后恢复宿主原来的 `data-scrollbar`。
 */
export function DocumentScrollbar() {
	const locked = useDocumentScrollLocked();
	const { metrics, scrolling } = useScrollState(documentViewport, documentContent);

	useEffect(() => {
		const root = document.documentElement;
		const original = root.getAttribute("data-scrollbar");
		root.setAttribute("data-scrollbar", "none");

		return () => {
			if (original === null) root.removeAttribute("data-scrollbar");
			else root.setAttribute("data-scrollbar", original);
		};
	}, []);

	if (locked) return null;

	return (
		<div className="v-document-scrollbar" data-scrolling={scrolling || undefined}>
			<Scrollbar axis="vertical" metrics={metrics} viewport={documentViewport} />
			<Scrollbar axis="horizontal" metrics={metrics} viewport={documentViewport} />
		</div>
	);
}
