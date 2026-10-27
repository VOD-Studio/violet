import { animateAppearanceRipple, applyAppearanceClass } from "@shared/ui/appearance-transition";
import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";
import type { TargetAppearance } from "@/shared/lib/appearance-rerender";
import type { AppearanceOption } from "../ui/types";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

/**
 * 触发切换时的指针坐标。
 */
interface AppearancePointer {
	clientX?: number;
	clientY?: number;
}

/**
 * 支持 light / dark / system 三态的圆形扩散外观切换。
 *
 * 封装 next-themes.setTheme，并在支持的浏览器里用 View Transitions
 * 从点击位置圆形揭开新外观。仅在目标与当前显式设置不同时才执行动画。
 * 扩散动画编排统一复用 animateAppearanceRipple。
 */
export function useAppearanceSwitcher() {
	const { theme: appearance, setTheme: setAppearance } = useTheme();
	const hydrated = useSyncExternalStore(
		subscribeToHydration,
		getClientHydrationSnapshot,
		getServerHydrationSnapshot,
	);

	const switchAppearance = useCallback(
		(target: AppearanceOption, pointer?: AppearancePointer) => {
			if (appearance === target) {
				return;
			}
			const px = pointer?.clientX ?? window.innerWidth / 2;
			const py = pointer?.clientY ?? window.innerHeight / 2;
			// target 为 system 时解析出实际外观：图块重渲与 class 切换只要 dark/light 二态
			const resolvedTarget: TargetAppearance =
				target === "system"
					? window.matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: target;
			// next-themes setTheme 放 VT update 里会卡死（见 appearance-transition 注释）：
			// update 里手动切 class，finished 后再同步 next-themes 状态与存储
			const tr = animateAppearanceRipple(
				{ px, py },
				() => applyAppearanceClass(resolvedTarget),
				resolvedTarget,
			);
			if (tr) {
				tr.finished.finally(() => setAppearance(target));
			} else {
				setAppearance(target);
			}
		},
		[appearance, setAppearance],
	);

	// 用判空收窄替代 as 断言：next-themes 的 theme 是 string | undefined，
	// 收窄到三态之一或 undefined。显式注解避免 TS 把字面量联合拓宽成 string。
	const resolved: AppearanceOption | undefined =
		hydrated && (appearance === "light" || appearance === "dark" || appearance === "system")
			? appearance
			: undefined;

	return { appearance: resolved, switchAppearance };
}
