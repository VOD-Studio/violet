import { NAV_ITEMS } from "@shared/config/nav";
import { Button } from "@shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@shared/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

import HeaderNavItem from "./HeaderNavItem";

/**
 * HeaderMobileProps - HeaderMobile 组件属性
 */
export interface HeaderMobileProps {
    /**
     * 点击 action 项时的回调
     */
    onAction?: (action: string) => void;
}

/**
 * HeaderMobile - 移动端汉堡菜单
 *
 * md 以下显示汉堡图标，点击展开 Sheet 抽屉显示 nav 列表。
 * action 项点击后自动关闭抽屉（改善移动端体验）。
 */
const HeaderMobile = ({ onAction }: HeaderMobileProps) => {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开菜单">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <nav className="mt-8 flex flex-col gap-2">
                    {NAV_ITEMS.map((item) => (
                        <HeaderNavItem
                            key={item.label}
                            item={item}
                            onAction={(a) => {
                                onAction?.(a);
                                setOpen(false);
                            }}
                        />
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    );
};

export default HeaderMobile;
