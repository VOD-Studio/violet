import { SEASONS, type Season } from "@shared/lib/theme-preference";
import { useEffect, useState } from "react";

/** 展柜外观作用域里的季节；检视台切换季节时跟着变，自定义主题按秋处理。 */
export function useScopeSeason(host: HTMLElement | null): Season {
	const [season, setSeason] = useState<Season>("autumn");
	useEffect(() => {
		if (!host) return;
		const read = () => {
			const theme = host.dataset.theme;
			setSeason(SEASONS.find((item) => item === theme) ?? "autumn");
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(host, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	}, [host]);
	return season;
}
