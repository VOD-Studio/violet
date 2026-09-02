import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_SECTION_IDS } from "./article";

/** 阅读基线：距视口顶部的偏移，与正文 section 的 scroll-margin-top 同源，
 *  标题贴住这条线即视为"正在读"。 */
export const READING_BASELINE_OFFSET = 96;

export function useActiveSection() {
	const [activeId, setActiveId] = useState(ALL_SECTION_IDS[0]);
	const programmaticScroll = useRef(false);
	const scrollTimer = useRef(0);

	useEffect(() => {
		const visible = new Map<string, number>();
		const observer = new IntersectionObserver(
			(entries) => {
				if (programmaticScroll.current) return;
				for (const entry of entries) {
					if (entry.isIntersecting)
						visible.set(entry.target.id, entry.boundingClientRect.top);
					else visible.delete(entry.target.id);
				}
				const next = [...visible].sort((a, b) => a[1] - b[1])[0]?.[0];
				if (next) setActiveId(next);
			},
			{
				rootMargin: `-${READING_BASELINE_OFFSET}px 0px -66% 0px`,
				threshold: [0, 1],
			},
		);

		for (const id of ALL_SECTION_IDS) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, []);

	const navigate = useCallback((id: string, reducedMotion: boolean) => {
		programmaticScroll.current = true;
		window.clearTimeout(scrollTimer.current);
		document.getElementById(id)?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start",
		});
		setActiveId(id);
		// 平滑滚动期间冻结观察器，落定后解冻，防止途经章节抢占高亮
		scrollTimer.current = window.setTimeout(
			() => {
				programmaticScroll.current = false;
			},
			reducedMotion ? 50 : 700,
		);
	}, []);

	return { activeId, navigate };
}
