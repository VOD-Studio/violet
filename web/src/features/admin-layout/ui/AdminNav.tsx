import { ADMIN_NAV_ITEMS } from "@features/admin-layout/config/nav";
import { cn } from "@shared/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
	FileText,
	LayoutDashboard,
	MessageSquare,
	ScrollText,
	Shield,
	Smile,
	Users,
} from "lucide-react";

const ICON_MAP = {
	LayoutDashboard,
	Users,
	FileText,
	MessageSquare,
	Smile,
	Shield,
	ScrollText,
};

interface AdminNavProps {
	className?: string;
	onNavigate?: () => void;
}

/**
 * AdminNav - 后台侧边栏导航
 *
 * 根据当前 pathname 高亮对应项。
 */
export function AdminNav({ className, onNavigate }: AdminNavProps) {
	const location = useLocation();
	const pathname = location.pathname;

	return (
		<nav className={cn("flex flex-col gap-1", className)}>
			{ADMIN_NAV_ITEMS.map((item) => {
				const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
				const active =
					pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
				return (
					<Link
						key={item.to}
						to={item.to}
						onClick={onNavigate}
						className={cn(
							"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
						)}
					>
						<Icon className="size-4" />
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
