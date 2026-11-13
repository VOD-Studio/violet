import { CapsuleOrnament } from "@features/seasonal-decor/ui/ornaments";
import { useRoutingProgress } from "@shared/hooks/use-routing-progress";
import { useScrollCompact } from "@shared/hooks/use-scroll-compact";
import { useScrollProgress } from "@shared/hooks/use-scroll-progress";
import { SiteNavbar } from "@shared/ui/site-navbar";
import { useRouterState } from "@tanstack/react-router";
import { useCommandUIStore } from "@widgets/CommandPalette/command-ui-store";
import type { ReactNode } from "react";
import { useNavbarState } from "./use-navbar-state";

const ORNAMENTS = {
	left: <CapsuleOrnament variant={0} />,
	center: <CapsuleOrnament variant={1} />,
	right: <CapsuleOrnament variant={3} />,
};

interface HeaderNavbarProps {
	/** SSR 已知的登录态，决定需登录入口是否出现。 */
	authenticated: boolean;
	logo: ReactNode;
	actions: ReactNode;
}

/**
 * 顶栏接线：把路由位置、滚动、页面加载与搜索面板接给 {@link SiteNavbar}。
 *
 * @remarks 滚动与进度在本层更新；logo 与 actions 使用调用方创建的元素。
 */
const HeaderNavbar = ({ authenticated, logo, actions }: HeaderNavbarProps) => {
	const { items, active, title } = useNavbarState(authenticated);
	const [collapsed] = useScrollCompact();
	const loading = useRouterState({ select: (state) => state.isLoading });
	const routing = useRoutingProgress(loading);
	const readingProgress = useScrollProgress(undefined, title !== null);
	const openCommand = useCommandUIStore((state) => state.open);

	return (
		<SiteNavbar
			items={items}
			active={active}
			title={title}
			readingProgress={readingProgress}
			routing={routing}
			collapsed={collapsed}
			logo={logo}
			actions={actions}
			onSearch={openCommand}
			ornaments={ORNAMENTS}
		/>
	);
};

export default HeaderNavbar;
