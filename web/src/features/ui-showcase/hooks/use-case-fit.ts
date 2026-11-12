import { useEffect, useRef, useState } from "react";

/** 裁切检查结果：完整、需横向滑动，或溢出占地（声明偏小）。 */
export type CaseFit = "ok" | "scroll" | "overflow";

/**
 * 测量展柜：舞台固定为占地尺寸，内容在任一方向超出舞台即为溢出；
 * 舞台完整而展柜比占地窄时为需横向滑动。
 *
 * @remarks 直接量舞台而不是展柜：小于柜内边距的溢出会落进内边距，展柜自身量不出来。
 * @returns 绑定到展柜滚动容器的 ref 与当前结果
 */
export function useCaseFit<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [fit, setFit] = useState<CaseFit>("ok");

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const measure = () => {
			const stage = element.querySelector<HTMLElement>("[data-stage]");
			const overflow =
				stage !== null &&
				(stage.scrollWidth > stage.clientWidth + 1 ||
					stage.scrollHeight > stage.clientHeight + 1);
			if (overflow) setFit("overflow");
			else setFit(element.scrollWidth > element.clientWidth + 1 ? "scroll" : "ok");
		};
		measure();
		const resize = new ResizeObserver(measure);
		resize.observe(element);
		// 舞台尺寸固定，内容变化只能从子树变动得知
		const mutation = new MutationObserver(measure);
		mutation.observe(element, { subtree: true, childList: true, attributes: true });
		return () => {
			resize.disconnect();
			mutation.disconnect();
		};
	}, []);

	return [ref, fit] as const;
}
