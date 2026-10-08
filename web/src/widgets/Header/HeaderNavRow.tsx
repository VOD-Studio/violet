import type { NavLink } from "@shared/config/nav";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { ComponentProps } from "react";

export interface HeaderNavRowProps extends Omit<ComponentProps<typeof Link>, "to" | "children"> {
	link: NavLink;
	/** 当前页面是否落在该目标上。 */
	current: boolean;
}

/** 带图标与说明的导航行，桌面悬停菜单与移动抽屉共用。 */
const HeaderNavRow = ({ link, current, className, ...props }: HeaderNavRowProps) => {
	const Icon = link.icon;
	return (
		<Link
			to={link.to}
			aria-current={current ? "page" : undefined}
			className={cn(
				"group/row flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors duration-200 hover:bg-foreground/5 focus-visible:bg-foreground/5",
				className,
			)}
			{...props}
		>
			<span
				aria-hidden="true"
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
					current
						? "bg-foreground text-background"
						: "bg-muted/70 text-muted-foreground group-hover/row:text-foreground",
				)}
			>
				<Icon className="size-4" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-[13px] leading-none font-medium text-foreground">
					{link.label}
				</span>
				<span className="mt-1.5 block truncate text-xs leading-none text-muted-foreground">
					{link.description}
				</span>
			</span>
		</Link>
	);
};

export default HeaderNavRow;
