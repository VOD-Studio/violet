import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_SECTION_IDS } from "./article";

/** 阅读基线：距视口顶部的偏移，与正文 section 的 scroll-margin-top 同源，
 *  标题贴住这条线即视为"正在读"。 */
export const READING_BASELINE_OFFSET = 96;

/** 滚动事件静默多久复查一次落定 */
const SETTLE_POLL_MS = 150;

/** 冻结最长等待（防页底受限等极端情况死锁） */
const SETTLE_MAX_MS = 3000;

/** 目标节顶与阅读基线的接近容差（双向） */
const SETTLE_TOLERANCE = 8;

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
		// scroll 自身即为节流信号，直接计算（rAF 在无绘制帧环境不回调）。
		// 冻结期直接忽略：落定判定由 navigate 启动的目标位置轮询链独立完成，
		// 此处再做静默解冻会顶掉轮询链，短距离滚动事件稀疏时误判解冻被途经章抢占
		const onScroll = () => {
			if (programmaticScroll.current) return;
			compute();
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
		window.dispatchEvent(new CustomEvent("toc-programmatic-scroll", { detail: true }));
		setActiveId(id);

		const scrollToTarget = () => {
			const el = document.getElementById(id);
			if (!el) {
				programmaticScroll.current = false;
				window.dispatchEvent(new CustomEvent("toc-programmatic-scroll", { detail: false }));
				return;
			}
			window.scrollTo({
				top: el.getBoundingClientRect().top + window.scrollY - READING_BASELINE_OFFSET,
				behavior: reducedMotion ? "auto" : "smooth",
			});
		};

		// activeId 会同步重排手风琴；等两次布局完成后再取正文坐标并发起滚动，
		// 避免目录展开/收起与浏览器滚动锚定共同改写 scrollIntoView 的终点。
		if (reducedMotion) {
			scrollToTarget();
		} else {
			requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
		}

		const startedAt = Date.now();
		const checkSettled = () => {
			const el = document.getElementById(id);
			if (!el) {
				programmaticScroll.current = false;
				window.dispatchEvent(new CustomEvent("toc-programmatic-scroll", { detail: false }));
				return;
			}
			const atTarget =
				Math.abs(el.getBoundingClientRect().top - READING_BASELINE_OFFSET) <=
				SETTLE_TOLERANCE;
			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			const timedOut = Date.now() - startedAt > SETTLE_MAX_MS;
			if (atTarget || atBottom || timedOut) {
				programmaticScroll.current = false;
				window.dispatchEvent(new CustomEvent("toc-programmatic-scroll", { detail: false }));
				setActiveId(id);
				return;
			}
			settleTimer.current = window.setTimeout(checkSettled, SETTLE_POLL_MS);
		};
		settleTimer.current = window.setTimeout(checkSettled, SETTLE_POLL_MS);
	}, []);

	return { activeId, navigate };
}
