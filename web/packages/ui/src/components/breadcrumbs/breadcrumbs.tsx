import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import type { ComponentProps } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../dropdown-menu";

/** 一级位置；最后一项是当前页，不参与链接。 */
export interface BreadcrumbItem {
	/** 层级名称；当前页过长时由组件截断并保留完整名称供悬停查看 */
	label: string;
	/** 链接目标；最后一项与没有目标的中间层不渲染为链接 */
	href?: string;
}

export interface BreadcrumbsProps extends Omit<ComponentProps<"div">, "children"> {
	items: readonly BreadcrumbItem[];
	/** 折叠菜单挂载位置；陈列室用它把菜单收进展品舞台 */
	menuContainer?: ComponentProps<typeof DropdownMenuContent>["container"];
}

const SEPARATOR = (
	<span className="v-breadcrumbs__separator" aria-hidden="true">
		/
	</span>
);

function Crumb({ item, current }: { item: BreadcrumbItem; current: boolean }) {
	if (current) {
		return (
			<span className="v-breadcrumbs__current" aria-current="page" title={item.label}>
				{item.label}
			</span>
		);
	}
	if (item.href === undefined) {
		return <span className="v-breadcrumbs__text">{item.label}</span>;
	}
	return (
		<a className="v-breadcrumbs__link" href={item.href}>
			{item.label}
		</a>
	);
}

/**
 * 后台与文档里的层级位置：最后一级是当前页，超过四级时中间折进「…」菜单。
 *
 * @remarks
 * 第一级与最后两级始终显示；窄屏（容器小于 23rem）只留一个返回上一级的链接。
 * 每一级必须是纯文本名称，折叠菜单的读屏名称依赖它。
 */
export function Breadcrumbs({ items, menuContainer, className, ...props }: BreadcrumbsProps) {
	const parent = items.at(-2);
	const collapsed = items.length > 4 ? items.slice(1, -2) : [];
	const visible: Array<{ item: BreadcrumbItem; index: number }> = [];

	if (collapsed.length === 0) {
		for (const [index, item] of items.entries()) visible.push({ item, index });
	} else {
		visible.push({ item: items[0] as BreadcrumbItem, index: 0 });
		visible.push(
			...items.slice(-2).map((item, offset) => ({ item, index: items.length - 2 + offset })),
		);
	}

	return (
		<div data-slot="breadcrumbs" className={cn("v-breadcrumbs", className)} {...props}>
			<nav className="v-breadcrumbs__nav" aria-label="当前位置">
				<ol className="v-breadcrumbs__list">
					{visible.map(({ item, index }, position) => (
						<li className="v-breadcrumbs__item" key={`${index}-${item.label}`}>
							{position > 0 ? SEPARATOR : null}
							{position === 1 && collapsed.length > 0 ? (
								<>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="v-breadcrumbs__more"
												aria-label={`展开中间的 ${collapsed.length} 级`}
											>
												…
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="start"
											container={menuContainer}
											className="v-breadcrumbs__menu"
										>
											{collapsed.map((hidden) => (
												<DropdownMenuItem
													key={hidden.label}
													asChild={hidden.href !== undefined}
												>
													{hidden.href !== undefined ? (
														<a href={hidden.href}>{hidden.label}</a>
													) : (
														<span>{hidden.label}</span>
													)}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
									{SEPARATOR}
								</>
							) : null}
							<Crumb item={item} current={index === items.length - 1} />
						</li>
					))}
				</ol>
			</nav>
			{parent?.href !== undefined ? (
				<a className="v-breadcrumbs__back" href={parent.href}>
					<ChevronLeft aria-hidden="true" />
					{parent.label}
				</a>
			) : null}
		</div>
	);
}
