import { useMusicUIStore } from "@features/music/model/ui-store";
import { useSessionStore } from "@shared/api/session";
import { useMe } from "@/features/auth/api/queries";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

interface HeaderProps {
	isAuthenticated: boolean;
}

/**
 * Header - 页面顶部容器（三段式悬浮胶囊设计）
 *
 * 参考现代顶级个人博客（如 tblog.mmzhiku.xyz），采用左(Logo)、中(Nav)、右(Actions)
 * 三段独立悬浮胶囊岛。外层 pointer-events-none 避免阻挡页面内容，各胶囊 pointer-events-auto。
 * 严禁 scale 变形，纯色/磨砂玻璃过渡。
 */
const Header = ({ isAuthenticated }: HeaderProps) => {
	// 登录态来源合并：SSR 静态快照（首屏）OR 客户端响应式 sessionActive（登录/登出瞬间）。
	// 单用 isAuthenticated 会导致登录成功后 useMe 仍 enabled:false，读不到新写入的 me，
	// Header 不刷新成"个人中心"。sessionActive 是 Zustand 响应式，登录/登出立即触发 re-render。
	const sessionActive = useSessionStore((s) => s.sessionActive);
	const enabled = isAuthenticated || sessionActive;
	const { data: user } = useMe({ enabled });
	const openMusic = useMusicUIStore((s) => s.open);
	const handleAction = (action: string) => {
		if (action === "open-music") openMusic();
	};

	return (
		<header
			style={{ viewTransitionName: "site-header" }}
			className="pointer-events-none sticky top-0 z-40 w-full pt-2.5 pb-1"
		>
			<div className="container mx-auto flex h-10 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
				{/* 左段：Logo 胶囊 */}
				<div className="flex shrink-0 items-center">
					<HeaderLogo />
				</div>

				{/* 中段：主导航船坞胶囊（桌面端居中，移动端自动隐藏） */}
				<div className="hidden items-center justify-center lg:flex">
					<HeaderNav onAction={handleAction} />
				</div>

				{/* 右段：工具与鉴权操作胶囊（内嵌移动端抽屉触发器） */}
				<div className="flex shrink-0 items-center justify-end">
					<HeaderActions user={user} onAction={handleAction}>
						<HeaderMobile onAction={handleAction} />
					</HeaderActions>
				</div>
			</div>
		</header>
	);
};

export default Header;
