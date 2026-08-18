import { useEffect, useState } from "react";

/**
 * 追踪阅读位置对应的锚点 id:视口顶部 180px 为阅读线(与锚点 scroll-mt
 * 联动的安全值),最后一个顶距越过阅读线的段落为激活项;滚到顶回退首个、
 * 滚到底选中末个。
 *
 * @param ids - 锚点 id 列表(文档顺序)
 * @returns 当前激活锚点 id;ids 为空时为 null
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
