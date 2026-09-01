import { NAV_ITEMS } from "@shared/config/nav";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { ChevronDown } from "lucide-react";

import HeaderNavItem from "./HeaderNavItem";

export interface HeaderNavProps {
	onAction?: (action: string) => void;
}
const HeaderNav = ({ onAction }: HeaderNavProps) => {
	const primaryItems = NAV_ITEMS.filter((item) => item.type === "route" && item.primary);
	const secondaryItems = NAV_ITEMS.filter((item) => item.type !== "route" || !item.primary);

	return (
		<nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">
			{primaryItems.map((item) => (
				<HeaderNavItem key={item.label} item={item} onAction={onAction} />
			))}
			{secondaryItems.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="group flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
						>
							更多
							<ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" sideOffset={8} className="w-40">
						{secondaryItems.map((item) => (
							<DropdownMenuItem key={item.label} asChild>
								<HeaderNavItem
									item={item}
									onAction={onAction}
									className="w-full cursor-pointer justify-start rounded-sm px-2 py-1.5"
								/>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</nav>
	);
};

export default HeaderNav;
