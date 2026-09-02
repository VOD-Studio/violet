import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_SECTION_IDS } from "./article";

/** 阅读基线：距视口顶部的偏移，与正文 section 的 scroll-margin-top 同源，
 *  标题贴住这条线即视为"正在读"。 */
export const READING_BASELINE_OFFSET = 96;

/** 滚动事件静默多久视为落定（平滑滚动结束的判定窗口） */
const SCROLL_SETTLE_MS = 150;

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
	const settleTimer = useRef(0);

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
			if (!programmaticScroll.current) {
				compute();
				return;
			}
			// 冻结期：滚动仍在进行，重置落定计时——途经章节永不抢高亮，
			// 无论平滑滚动持续多久（固定超时会在长距离滚动中途解冻被途经章抢占）
			window.clearTimeout(settleTimer.current);
			settleTimer.current = window.setTimeout(() => {
				programmaticScroll.current = false;
				compute();
			}, SCROLL_SETTLE_MS);
		};
		compute();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.clearTimeout(settleTimer.current);
		};
	}, []);

	const navigate = useCallback((id: string, reducedMotion: boolean) => {
		programmaticScroll.current = true;
		window.clearTimeout(settleTimer.current);
		document.getElementById(id)?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start",
		});
		setActiveId(id);
		// 静默解冻：滚动事件停止 SCROLL_SETTLE_MS 后解冻并按落定点校正，
		// 平滑滚动无论多长都在途中保持冻结
		settleTimer.current = window.setTimeout(() => {
			programmaticScroll.current = false;
		}, SCROLL_SETTLE_MS);
	}, []);

	return { activeId, navigate };
}
