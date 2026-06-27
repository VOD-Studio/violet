import type { NavItem } from "@shared/config/nav";
import { NAV_ITEMS } from "@shared/config/nav";

import HeaderNavItem from "./HeaderNavItem";

/**
 * HeaderNavProps - HeaderNav 组件属性
 */
export interface HeaderNavProps {
    /**
     * 点击 action 项时的回调
     */
    onAction?: (action: string) => void;
}

/**
 * HeaderNav - 桌面端 nav 列表
 *
 * md 以上显示，遍历 NAV_ITEMS 渲染 HeaderNavItem。
 * 移动端用 HeaderMobile（Sheet 抽屉）。
 */
const HeaderNav = ({ onAction }: HeaderNavProps) => {
    const items: NavItem[] = NAV_ITEMS;
    return (
        <nav className="hidden md:flex items-center gap-1">
            {items.map((item) => (
                <HeaderNavItem key={item.label} item={item} onAction={onAction} />
            ))}
        </nav>
    );
};

export default HeaderNav;
