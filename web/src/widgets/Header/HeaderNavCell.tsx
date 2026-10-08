import type { NavItem } from "@shared/config/nav";
import { Link } from "@tanstack/react-router";
import {
	Dropdown,
	DropdownContent,
	DropdownTrigger,
	type SegmentedItemRenderProps,
} from "@violet/ui";

import HeaderNavRow from "./HeaderNavRow";

export interface HeaderNavCellProps {
	item: NavItem;
	/** Segmented 交给自定义元素的属性，必须展开到入口元素上。 */
	segment: SegmentedItemRenderProps;
	/** 当前页面落在该项上。 */
	current: boolean;
	/** 当前页面命中的目标，用于标记二级菜单里的当前行。 */
	activeTo: string | undefined;
}

/** Segmented 里的一项：链接或分组按钮，带二级时悬停展开 Dropdown。 */
const HeaderNavCell = ({ item, segment, current, activeTo }: HeaderNavCellProps) => {
	const ariaCurrent = current ? "page" : undefined;
	if (!item.children) {
		return item.to === undefined ? null : (
			<Link to={item.to} aria-current={ariaCurrent} {...segment} />
		);
	}

	return (
		<Dropdown>
			{item.to === undefined ? (
				<DropdownTrigger {...segment} />
			) : (
				<DropdownTrigger asChild>
					<Link to={item.to} aria-current={ariaCurrent} {...segment} />
				</DropdownTrigger>
			)}
			<DropdownContent
				role="group"
				aria-label={`${item.label}二级菜单`}
				className="w-74"
				sideOffset={10}
			>
				{item.children.map((child) => (
					<HeaderNavRow key={child.to} link={child} current={activeTo === child.to} />
				))}
			</DropdownContent>
		</Dropdown>
	);
};

export default HeaderNavCell;
