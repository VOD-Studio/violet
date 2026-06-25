import { Button } from "@shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@shared/ui/sheet";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { AdminNav } from "./AdminNav";

/**
 * AdminHeader - 后台顶部条
 *
 * 左侧显示标题，右侧显示返回前台链接；移动端提供侧边栏菜单按钮。
 */
export function AdminHeader() {
	return (
		<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-edge-hairline bg-background/80 px-4 backdrop-blur-xl">
			<div className="flex items-center gap-3">
				<Sheet>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" className="md:hidden">
							<Menu className="size-4" />
							<span className="sr-only">打开菜单</span>
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-64 p-4">
						<div className="mb-6 font-mono text-lg font-bold">Admin</div>
						<AdminNav />
					</SheetContent>
				</Sheet>
				<h1 className="font-mono text-base font-bold tracking-tight">后台管理</h1>
			</div>
			<Button variant="ghost" size="sm" asChild>
				<Link to="/">返回前台</Link>
			</Button>
		</header>
	);
}
