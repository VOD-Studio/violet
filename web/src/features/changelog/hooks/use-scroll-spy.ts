import { useEffect, useState } from "react";

/**
 * useScrollSpy - 追踪当前阅读位置对应的锚点 id。
 *
 * 算法：视口顶部 180px 处为「阅读线」，最后一个顶距越过阅读线的段落算
 * 当前阅读版本。线高与锚点跳转落点（scroll-mt 96~128px）和下一段落顶部
 * （≥96+段落高）之间取中值，保证点击跳转后目标段落必然越线被选中；
 * 页面滚到顶回退首个、滚到底选中末个（IntersectionObserver 窄激活带
 * 方案在首/末段落短小时会丢选中）。scroll 事件经 rAF 节流，SSR 安全。
 */
export function useScrollSpy(ids: string[]): string | null {
	const [active, setActive] = useState<string | null>(ids[0] ?? null);

	useEffect(() => {
		if (ids.length === 0) return;
		let raf = 0;
		const update = () => {
			// 滚到底：最后一个版本段落再矮也必须可选中
			if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) {
				setActive(ids[ids.length - 1]);
				return;
			}
			let current: string | null = null;
			for (const id of ids) {
				const el = document.getElementById(id);
				if (el && el.getBoundingClientRect().top <= 180) current = id;
			}
			setActive(current ?? ids[0]);
		};
		const onScroll = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [ids]);

	return active;
}
