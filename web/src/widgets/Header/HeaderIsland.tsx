import {
	describeActivity,
	deviceActivities,
	PresenceCard,
	PresenceTicker,
	useLivePresence,
} from "@features/presence";
import { ThemePicker } from "@features/theme-switcher";
import { getNavItems, resolveActiveNav } from "@shared/config/nav";
import { useRoutingProgress } from "@shared/hooks/use-routing-progress";
import { useScrollCompact } from "@shared/hooks/use-scroll-compact";
import { SiteIsland, type SiteIslandPresence } from "@shared/ui/site-island";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function useViewportWidth(): number {
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return width;
}

/**
 * HeaderIsland - 移动端底部灵动岛导航（接线层）。
 *
 * 把路由、滚动、在线状态喂给展示层 SiteIsland。
 * 导航独立于页面转场快照，不随正文淡入淡出。
 */
const HeaderIsland = ({ authenticated }: { authenticated: boolean }) => {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return createPortal(<Island authenticated={authenticated} />, document.body);
};

function Island({ authenticated }: { authenticated: boolean }) {
	const [open, setOpen] = useState(false);
	const [compact, setCompact] = useScrollCompact();
	/** 点击入口后立刻让药丸滑过去，不等路由加载完成 */
	const [optimisticTo, setOptimisticTo] = useState<string | null>(null);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const items = useMemo(() => getNavItems({ authenticated }), [authenticated]);
	const activeTo = optimisticTo ?? resolveActiveNav(pathname, items)?.link.to;
	const routing = useRoutingProgress(useRouterState({ select: (state) => state.isLoading }));
	const viewport = useViewportWidth();
	const live = useLivePresence();
	const [activity] = live.lead ? deviceActivities(live.lead) : [];
	const lead = live.lead;
	const presence: SiteIslandPresence | undefined =
		lead && activity
			? {
					activityText: describeActivity(activity),
					renderTicker: (onWidthChange) => (
						<PresenceTicker
							device={lead}
							clockOffset={live.clockOffset}
							showElapsed
							primaryClassName="max-w-32"
							onWidthChange={onWidthChange}
						/>
					),
					card: (
						<PresenceCard
							devices={live.devices}
							lead={lead}
							clockOffset={live.clockOffset}
						/>
					),
				}
			: undefined;
	/** 仅在路径真正变化时收起；挂载时的 effect 不能冲掉同步打开的面板（测试/极速点击） */
	const prevPathnameRef = useRef(pathname);

	useEffect(() => {
		if (prevPathnameRef.current === pathname) return;
		prevPathnameRef.current = pathname;
		setOpen(false);
		setOptimisticTo(null);
	}, [pathname]);

	// 聊天是全屏页，底部是输入栏，岛会盖住它
	if (pathname.startsWith("/chat")) return null;

	return (
		<SiteIsland
			items={items}
			activeTo={activeTo}
			open={open}
			onOpenChange={setOpen}
			compact={compact}
			onCompactChange={setCompact}
			onSelect={setOptimisticTo}
			viewportWidth={viewport}
			routing={routing}
			presence={presence}
			themePicker={<ThemePicker />}
		/>
	);
}

export default HeaderIsland;
