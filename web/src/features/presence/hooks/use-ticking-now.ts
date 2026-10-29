import { useEffect, useState } from "react";

/**
 * 返回每秒刷新的 Date.now()；inactive 时停表，避免暂停或未知进度时空转渲染。
 */
export function useTickingNow(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [active]);
	return now;
}
