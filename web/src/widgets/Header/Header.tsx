import { useMusicUIStore } from "@features/music/model/ui-store";
import { useSessionStore } from "@shared/api/session";
import { motion } from "framer-motion";
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
 * sticky + backdrop-blur + 1px 极细边框（dark 霓虹 / light 灰）。
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

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        handleScroll();
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className={`sticky top-0 z-50 w-full transition-all duration-300 ${
                scrolled
                    ? "border-b border-edge-hairline bg-background/70 backdrop-blur-md"
                    : "bg-transparent"
            }`}
        >
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <HeaderLogo />
                <HeaderNav onAction={handleAction} />
                <div className="flex items-center gap-2">
                    <HeaderActions user={user} />
                    <HeaderMobile onAction={handleAction} />
                </div>
            </div>
        </motion.header>
    );
};

export default Header;
