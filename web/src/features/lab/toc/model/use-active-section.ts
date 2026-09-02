import { useCallback, useEffect, useState } from "react";
import { ALL_SECTION_IDS } from "./article";

export function useActiveSection() {
	const [activeId, setActiveId] = useState(ALL_SECTION_IDS[0]);

	useEffect(() => {
		const visible = new Map<string, number>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting)
						visible.set(entry.target.id, entry.boundingClientRect.top);
					else visible.delete(entry.target.id);
				}
				const next = [...visible].sort((a, b) => a[1] - b[1])[0]?.[0];
				if (next) setActiveId(next);
			},
			{ rootMargin: "-18% 0px -68% 0px", threshold: [0, 1] },
		);

		for (const id of ALL_SECTION_IDS) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, []);

	const navigate = useCallback((id: string, reducedMotion: boolean) => {
		document.getElementById(id)?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start",
		});
		setActiveId(id);
	}, []);

	return { activeId, navigate };
}
