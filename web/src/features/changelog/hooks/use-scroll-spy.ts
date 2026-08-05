import { useEffect, useState } from "react";

/**
 * useScrollSpy - 追踪当前阅读位置对应的锚点 id。
 *
 * 激活带取视口顶部 20%~30% 区间（rootMargin 上下裁切），滚动经过某锚点
 * 段落时该段算「在阅读」。滚动间隙无命中时保持上次值，避免导航高亮闪烁。
 * SSR 安全：observer 只在 effect 里建。
 */
export function useScrollSpy(ids: string[]): string | null {
	const [active, setActive] = useState<string | null>(ids[0] ?? null);

	useEffect(() => {
		if (ids.length === 0) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActive(entry.target.id);
				}
			},
			{ rootMargin: "-20% 0px -70% 0px" },
		);
		for (const id of ids) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, [ids]);

	return active;
}
