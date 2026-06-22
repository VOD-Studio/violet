import { useMusicUIStore } from "@features/music/model/ui-store";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

/**
 * Header - 页面顶部容器
 *
 * 装配 Logo + 桌面 Nav + 移动菜单 + 操作区。
 * action 项（音乐）派发到 MusicUIStore 打开播放器。
 * sticky + backdrop-blur 提升滚动时的视觉层级。
 */
const Header = () => {
	const openMusic = useMusicUIStore((s) => s.open);

	const handleAction = (action: string) => {
		if (action === "open-music") openMusic();
	};

	return (
		<header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<HeaderLogo />
				<HeaderNav onAction={handleAction} />
				<div className="flex items-center gap-2">
					<HeaderActions />
					<HeaderMobile onAction={handleAction} />
				</div>
			</div>
		</header>
	);
};

export default Header;
