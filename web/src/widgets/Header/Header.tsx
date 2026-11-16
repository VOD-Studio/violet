import { usePresenceStream } from "@features/presence";
import { useSessionStore } from "@shared/api/session";
import { useAuthenticated } from "@shared/api/use-authenticated";
import { useMe } from "@/features/auth/api/queries";

import HeaderActions from "./HeaderActions";
import HeaderChatToast from "./HeaderChatToast";
import HeaderIsland from "./HeaderIsland";
import HeaderLogo from "./HeaderLogo";
import HeaderNavbar from "./HeaderNavbar";

interface HeaderProps {
	isAuthenticated: boolean;
}

/**
 * 公共页头，装配站长入口、导航、工具与移动端导航岛。
 *
 * @remarks 外层不拦截指针，交互由各药丸接收。
 */
const Header = ({ isAuthenticated }: HeaderProps) => {
	// SSR 登录态与客户端会话分别覆盖水合首帧和登录后的用户查询。
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
				{user && <HeaderChatToast user={user} />}
			</div>

			{/* 移动端底部灵动岛导航（portal 到 body，lg 以上隐藏） */}
			<HeaderIsland authenticated={authenticated} />
		</header>
	);
};

export default Header;
