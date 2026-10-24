import { useEffect, useState } from "react";

/** 通过 html class 观察站点明暗，供编辑器 NodeView 使用。 */
export function useIsDarkAppearance(): boolean {
	const [isDark, setIsDark] = useState<boolean>(() =>
		typeof document !== "undefined"
			? document.documentElement.classList.contains("dark")
			: false,
	);

	useEffect(() => {
		const root = document.documentElement;
		const sync = () => setIsDark(root.classList.contains("dark"));
		// 挂载可能晚于明暗 class 注入，先同步一次。
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	return isDark;
}
