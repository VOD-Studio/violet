import type { UserDTO } from "@entities/user/model/types";
import { useMusicUIStore } from "@features/music/model/ui-store";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

interface HeaderProps {
	user?: UserDTO | null;
}

/**
 * Header - 页面顶部容器（非首页通用栏）
 *
 * 首页有自己的 20% 底座（routes/index.tsx），
 * 其他页（blog/about/...）仍用此 sticky header。
 *
 * sticky + backdrop-blur + 1px 极细边框（dark 霓虹 / light 灰）。
 */
const Header = ({ user }: HeaderProps) => {
	const openMusic = useMusicUIStore((s) => s.open);
	const handleAction = (action: string) => {
		if (action === "open-music") openMusic();
	};

	return (
		<header className="sticky top-0 z-40 w-full border-b border-edge-hairline bg-background/70 backdrop-blur-xl">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<HeaderLogo />
				<HeaderNav onAction={handleAction} />
				<div className="flex items-center gap-2">
					<HeaderActions user={user} />
					<HeaderMobile onAction={handleAction} user={user} />
				</div>
			</div>
		</header>
	);
};

export default Header;
