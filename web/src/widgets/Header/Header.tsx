import { useMusicUIStore } from "@features/music/model/ui-store";
import { useSessionStore } from "@shared/api/session";
import { cn } from "@shared/lib/utils";
import { useEffect, useState } from "react";
import { useMe } from "@/features/auth/api/queries";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

interface HeaderProps {
	isAuthenticated: boolean;
}

/**
 * Header - 页面顶部容器（非首页通用栏）
 *
 * 首页有自己的 20% 底座（routes/index.tsx），
 * 其他页（blog/about/...）仍用此 sticky header。
 *
 * sticky + backdrop-blur + 1px 极细边框（dark 发光 / light 灰）。
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

	// scrolled 只控制底边框显隐；背景常驻（bg-background/70 + backdrop-blur），
	// 不随滚动切换，从而避开 scroll restoration 与 hydrate 的时序竞态。
	// mounted 让首帧底边框不经过 transition（与首屏静默对齐），之后滚动切换才过渡。
	const [scrolled, setScrolled] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const handleScroll = () => setScrolled(window.scrollY > 50);
		handleScroll();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<header
			style={{ viewTransitionName: "site-header" }}
			className={cn(
				"sticky top-0 z-50 w-full border-b border-edge-hairline bg-background/70 backdrop-blur-md",
				scrolled ? "border-b" : "border-transparent",
				mounted && "transition-colors duration-300",
			)}
		>
			<div className="container relative mx-auto grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
				<div className="min-w-0">
					<HeaderLogo />
				</div>
				<HeaderNav onAction={handleAction} />
				<div className="flex items-center justify-end gap-2">
					<HeaderActions user={user} />
					<HeaderMobile onAction={handleAction} />
				</div>
			</div>
		</header>
	);
};

export default Header;
