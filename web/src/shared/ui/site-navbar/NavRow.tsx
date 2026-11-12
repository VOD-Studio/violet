import type { NavLink } from "@shared/config/nav";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { type NavbarLinkComponent, RouterLink } from "./link";

export interface NavRowProps extends Omit<ComponentProps<"a">, "href" | "children"> {
	link: NavLink;
	/** 当前页面是否落在该目标上。 */
	current: boolean;
	/** 链接渲染组件，默认走路由跳转。 */
	LinkComponent?: NavbarLinkComponent;
}

/** 二级菜单里带图标与说明的一行；外层若是 DropdownItem，高亮底色由它负责。 */
export function NavRow({
	link,
	current,
	LinkComponent = RouterLink,
	className,
	...props
}: NavRowProps) {
	const Icon = link.icon;
	return (
		<LinkComponent
			href={link.to}
			aria-current={current ? "page" : undefined}
			className={cn("group/row flex w-full items-center gap-3 text-left", className)}
			{...props}
		>
			<span
				aria-hidden="true"
				className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-200 group-data-[highlighted]/row:bg-card group-data-[highlighted]/row:text-selected-foreground group-aria-[current=page]/row:bg-card group-aria-[current=page]/row:text-selected-foreground motion-reduce:transition-none"
			>
				<Icon className="size-4.5" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm/[1.35] font-semibold text-foreground">
					{link.label}
				</span>
				<span className="block truncate text-[12.5px]/[1.4] text-muted-foreground">
					{link.description}
				</span>
			</span>
		</LinkComponent>
	);
}
