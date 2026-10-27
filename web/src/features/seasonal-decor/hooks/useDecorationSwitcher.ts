import {
	type DecorationPreference,
	persistDecorationPreference,
	resolveDecoration,
} from "@shared/lib/decoration-preference";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * 读取并切换装饰偏好。
 *
 * 切换时先同步改写 `<html data-decoration>`（CSS 钩子立即生效），cookie 写入后
 * 刷新路由上下文，依赖装饰的组件随之更新。
 */
export function useDecorationSwitcher() {
	const router = useRouter();
	const { theme, decoration } = useRouteContext({ from: "__root__" });

	/** 选择跟随主题、关闭或某一季。 */
	const switchDecoration = useCallback(
		async (preference: DecorationPreference) => {
			if (preference === decoration) return;
			document.documentElement.dataset.decoration =
				resolveDecoration(preference, theme) ?? "none";
			await persistDecorationPreference(preference);
			await router.invalidate();
		},
		[decoration, theme, router],
	);

	return {
		preference: decoration,
		season: resolveDecoration(decoration, theme),
		switchDecoration,
	};
}
