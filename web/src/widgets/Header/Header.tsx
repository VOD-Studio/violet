import { usePresenceStream } from "@features/presence";
import { useSessionStore } from "@shared/api/session";
import { useAuthenticated } from "@shared/api/use-authenticated";
import { useMe } from "@/features/auth/api/queries";

import HeaderActions from "./HeaderActions";
import HeaderIsland from "./HeaderIsland";
import HeaderLogo from "./HeaderLogo";
import HeaderNavbar from "./HeaderNavbar";

interface HeaderProps {
	isAuthenticated: boolean;
}

/**
 * Header - 页面顶部容器：左 Logo、中导航、右工具三枚悬浮药丸，移动端另有底部灵动岛。
 *
 * 外层 pointer-events-none 避免阻挡页面内容，各药丸 pointer-events-auto。
 * 药丸外壳与导航形态在 {@link SiteNavbar}，这里只取登录态与用户并装配内容。
 */
const Header = ({ isAuthenticated }: HeaderProps) => {
	// useMe 的开关：SSR 静态快照（首屏）OR 客户端响应式 sessionActive（登录瞬间）。
	// 单用 isAuthenticated 会导致登录成功后 useMe 仍 enabled:false，读不到新写入的 me，
	// Header 不刷新成"个人中心"。
	const sessionActive = useSessionStore((s) => s.sessionActive);
	const { data: user } = useMe({ enabled: isAuthenticated || sessionActive });
	// 导航结构随登录态变化：首帧取 SSR 登录态，登出后立即回到游客入口（路由上下文不会随登出刷新）
	const authenticated = useAuthenticated(isAuthenticated);
	usePresenceStream();

	return (
		<header
			style={{ viewTransitionName: "site-header" }}
			className="pointer-events-none sticky top-0 z-40 w-full pt-2.5 pb-1"
		>
			<div className="container relative mx-auto max-w-6xl px-3 sm:px-4">
				<HeaderNavbar
					authenticated={authenticated}
					logo={<HeaderLogo />}
					actions={<HeaderActions user={user} />}
				/>
			</div>

			{/* 移动端底部灵动岛导航（portal 到 body，lg 以上隐藏） */}
			<HeaderIsland authenticated={authenticated} />
		</header>
	);
};

export default Header;
