import {
	subscribeAppearanceRerender,
	type TargetAppearance,
} from "@shared/lib/appearance-rerender";
import { useEffect, useState } from "react";

/**
 * 读取站点明暗；切换动画结束后再换色，与阅读端图块保持一致。
 */
export function useSiteAppearance(): TargetAppearance {
	const [appearance, setAppearance] = useState<TargetAppearance>("light");
	useEffect(() => {
		setAppearance(document.documentElement.classList.contains("dark") ? "dark" : "light");
		return subscribeAppearanceRerender(setAppearance);
	}, []);
	return appearance;
}
