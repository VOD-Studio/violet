import { useCallback, useLayoutEffect, useState } from "react";

/**
 * 测量非 sticky 锚点列（与吸附列同排的正文列）的文档顶位，
 * 作为同排 sticky 元素的吸附位——初始即贴住，消除滚动初期跟随位移。
 *
 * 不在 sticky 元素自身测量：Chromium 会把 sticky 的压底位移计入 offsetTop，
 * 布局变化（如展开折叠内容）时会形成"测得越大→压得越低→测得更大"的正反馈。
 * 锚点列不参与 sticky，其文档顶（rect.top + scrollY）在任何布局态下稳定；
 * 列可能随目录注册延迟挂载，故以 callback ref 驱动测量绑定。
 *
 * @returns 挂到同排非 sticky 列上的 ref 与文档顶位（挂载完成前为 null）
 */
export function useNaturalAnchorTop<T extends HTMLElement>() {
	const [element, setElement] = useState<T | null>(null);
	const [top, setTop] = useState<number | null>(null);
	const ref = useCallback((node: T | null) => setElement(node), []);

	useLayoutEffect(() => {
		if (!element) return;

		const measure = () => {
			const next = Math.round(element.getBoundingClientRect().top + window.scrollY);
			setTop((prev) => (prev === next ? prev : next));
		};

		measure();

		// 头部/边距随视口或正文内容变化时重测；字体就绪后首帧布局可能再变，补测一次
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		window.addEventListener("resize", measure);
		document.fonts?.ready.then(measure).catch(() => {});
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [element]);

	return { ref, top };
}
