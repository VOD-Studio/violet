import { NAV_ITEMS } from "@shared/config/nav";
import { Button } from "@shared/ui/base/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@shared/ui/base/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

import HeaderNavItem from "./HeaderNavItem";

export interface HeaderMobileProps {
	onAction?: (action: string) => void;
}
const HeaderMobile = ({ onAction }: HeaderMobileProps) => {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开菜单">
					<Menu className="size-5" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="flex w-96 max-w-full flex-col overflow-hidden p-0"
			>
				<SheetHeader className="border-b bg-muted/30 px-6 py-5 text-left">
					<p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
						Navigation
					</p>
					<SheetTitle className="text-xl">浏览本站</SheetTitle>
					<SheetDescription>文章、作品与社区内容都在这里。</SheetDescription>
				</SheetHeader>
				<nav
					aria-label="移动端主导航"
					className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
				>
					{NAV_ITEMS.map((item) => (
						<HeaderNavItem
							key={item.label}
							item={item}
							detailed
							className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5"
							onNavigate={() => setOpen(false)}
							onAction={(action) => {
								onAction?.(action);
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
