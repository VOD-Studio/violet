import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_SECTION_IDS } from "./article";

/** 阅读基线：距视口顶部的偏移，与正文 section 的 scroll-margin-top 同源，
 *  标题贴住这条线即视为"正在读"。 */
export const READING_BASELINE_OFFSET = 96;

/**
 * 激活判定：最近越过阅读基线的标题。
 *
 * 逐帧取各 section 文档坐标，activeId = offsetTop ≤ 基线文档位置中最大者。
 * 嵌套结构下父级恒先于子级越过基线，此模型自然选中当前所在的最深小节——
 * IntersectionObserver"可见集中取 top 最小"在嵌套 DOM 里会永远偏向外层父级。
 */
export function useActiveSection() {
	const [activeId, setActiveId] = useState(ALL_SECTION_IDS[0]);
	const programmaticScroll = useRef(false);
	const scrollTimer = useRef(0);

	useEffect(() => {
		const compute = () => {
			const baseline = window.scrollY + READING_BASELINE_OFFSET;
			let current = ALL_SECTION_IDS[0];
			for (const id of ALL_SECTION_IDS) {
				const el = document.getElementById(id);
				if (!el) continue;
				if (el.getBoundingClientRect().top + window.scrollY <= baseline) current = id;
			}
			// 页底兜底：末节太短推不过基线时，滚到底强制激活
			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			if (atBottom) current = ALL_SECTION_IDS[ALL_SECTION_IDS.length - 1];
			setActiveId(current);
		};
		// scroll 自身即为节流信号，直接计算（rAF 在无绘制帧环境不回调）
		const onScroll = () => {
			if (programmaticScroll.current) return;
			compute();
		};
		compute();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const navigate = useCallback((id: string, reducedMotion: boolean) => {
		programmaticScroll.current = true;
		window.clearTimeout(scrollTimer.current);
		document.getElementById(id)?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start",
		});
		setActiveId(id);
		// 平滑滚动期间冻结基线计算，落定后解冻，防止途经章节抢占高亮
		scrollTimer.current = window.setTimeout(
			() => {
				programmaticScroll.current = false;
			},
			reducedMotion ? 50 : 700,
		);
	}, []);

	return { activeId, navigate };
}
