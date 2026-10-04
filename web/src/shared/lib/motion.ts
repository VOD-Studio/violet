import { useEffect, useState } from "react";

/**
 * 监听用户系统是否启用了 prefers-reduced-motion。
 * 纯原生实现，不引入任何三方动画库运行时。
 */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(() => {
		if (typeof window === "undefined" || !window.matchMedia) return false;
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	});

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return undefined;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handler = () => setReduced(media.matches);
		media.addEventListener("change", handler);
		return () => media.removeEventListener("change", handler);
	}, []);

	return reduced;
}
