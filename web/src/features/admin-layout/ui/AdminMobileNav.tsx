import { Button } from "@shared/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@shared/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";
import { AdminSidebarBody } from "./AdminSidebarBody";

/**
 * AdminMobileNav - 移动端抽屉导航
 *
 * md:hidden，桌面侧隐藏。复用 Sheet（side="left"）与 HeaderMobile 同款模式，
 * 点击导航项后通过 onNavigate 关闭抽屉。
 */
export function AdminMobileNav() {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label="打开导航菜单"
                >
                    <Menu className="size-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="h-14 justify-center border-b">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <span className="bg-primary size-6 rounded-md" />
                        Mimo Admin
                    </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                    <SheetClose asChild>
                        <div>
                            <AdminSidebarBody onNavigate={() => setOpen(false)} />
                        </div>
                    </SheetClose>
                </div>
            </SheetContent>
        </Sheet>
    );
}
