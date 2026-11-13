import type { NavItem } from "@shared/config/nav";
import {
	Dropdown,
	DropdownContent,
	DropdownItem,
	DropdownTrigger,
	type SegmentedItemRenderProps,
} from "@violet/ui";
import { type NavbarLinkComponent, RouterLink } from "./link";
import { NavRow } from "./NavRow";

/**
 * 顶层链接或分组触发器的导航状态。
 *
 * @remarks segment 的样式、事件及数据属性直接传给入口；二级链接保持独立的当前页标记。
 */
export interface NavCellProps {
	item: NavItem;
	/** Segmented 交给自定义元素的属性，必须展开到入口元素上。 */
	segment: SegmentedItemRenderProps;
	/** 当前页面落在该项上。 */
	current: boolean;
	/** 当前页面命中的目标，用于标记二级菜单里的当前行。 */
	activeTo: string | undefined;
	/** 入口没有可见文字时的名称（只剩图标的收起态）。 */
	label?: string;
	/** 文章阅读进度 0–100；给出时画在入口底部，仅作视觉提示。 */
	readingProgress?: number;
	LinkComponent?: NavbarLinkComponent;
}

/** 文章阅读进度线：当前项内部，轨道在下、进度在上；只作视觉提示，不进入无障碍树。 */
function ReadingProgress({ value }: { value: number }) {
	return (
		<span
			aria-hidden="true"
			data-slot="reading-progress"
			className="pointer-events-none absolute inset-x-3.5 bottom-0.75 h-0.5 overflow-hidden rounded-xs bg-border"
		>
			<span
				className="block h-full rounded-xs bg-decoration transition-[width] duration-200 ease-out motion-reduce:transition-none"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</span>
	);
}

/** Segmented 里的一项：链接或分组按钮，带二级时悬停展开 Dropdown。 */
export function NavCell({
	item,
	segment,
	current,
	activeTo,
	label,
	readingProgress,
	LinkComponent = RouterLink,
}: NavCellProps) {
	const props = {
		...segment,
		"aria-current": current ? ("page" as const) : undefined,
		"aria-label": label,
		children: (
			<>
				{segment.children}
				{readingProgress === undefined ? null : <ReadingProgress value={readingProgress} />}
			</>
		),
	};
	if (!item.children) {
		return item.to === undefined ? null : <LinkComponent href={item.to} {...props} />;
	}

	return (
		<Dropdown>
			{item.to === undefined ? (
				<DropdownTrigger {...props} />
			) : (
				<DropdownTrigger asChild>
					<LinkComponent href={item.to} {...props} />
				</DropdownTrigger>
			)}
			<DropdownContent role="group" aria-label={`${item.label}二级菜单`} className="w-74">
				{item.children.map((child) => (
					<DropdownItem asChild key={child.to}>
						<NavRow
							link={child}
							current={activeTo === child.to}
							LinkComponent={LinkComponent}
						/>
					</DropdownItem>
				))}
			</DropdownContent>
		</Dropdown>
	);
}
