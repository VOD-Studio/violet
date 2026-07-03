import { Button } from "@shared/ui/base/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@shared/ui/base/sheet";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Menu } from "lucide-react";
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
                <div className="flex h-[calc(100%-3.5rem)] flex-col p-3">
                    <div className="flex-1 overflow-y-auto">
                        <SheetClose asChild>
                            <div>
                                <AdminSidebarBody onNavigate={() => setOpen(false)} />
                            </div>
                        </SheetClose>
                    </div>
                    <SheetClose asChild>
                        <Link
                            to="/"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <ArrowLeft className="size-4 shrink-0" />
                            返回前台
                        </Link>
                    </SheetClose>
                </div>
            </SheetContent>
        </Sheet>
    );
}
