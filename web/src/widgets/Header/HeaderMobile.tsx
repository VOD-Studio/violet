import { NAV_ITEMS } from "@shared/config/nav";
import { Button } from "@shared/ui/base/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@shared/ui/base/sheet";
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
			<SheetContent side="right" className="flex w-72 flex-col p-0">
				<SheetHeader className="border-b px-5 py-4 text-left">
					<SheetTitle>浏览</SheetTitle>
				</SheetHeader>
				<nav
					aria-label="移动端主导航"
					className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
				>
					{NAV_ITEMS.map((item) => (
						<HeaderNavItem
							key={item.label}
							item={item}
							className="w-full px-3 py-2.5"
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
