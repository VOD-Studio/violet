import { NAV_ITEMS, resolveActiveNav } from "@shared/config/nav";
import { useRouterState } from "@tanstack/react-router";
import { DropdownGroup, Segmented, type SegmentedItem } from "@violet/ui";
import { ChevronDown } from "lucide-react";

import HeaderNavCell from "./HeaderNavCell";
import { useNavTitle } from "./use-nav-title";

/**
 * 渲染主导航岛：悬停展开二级菜单，详情页在选中项上显示标题。
 *
 * 阅读态下整岛宽度不变，其余项收为图标，避免标题把导航撑宽造成抖动。
 */
const HeaderNav = () => {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const navTitle = useNavTitle();

	const active = resolveActiveNav(pathname);
	// location 先于 matches 更新：标题只在它所属页面仍是当前导航位置时生效
	const title =
		active && navTitle && resolveActiveNav(navTitle.path)?.item === active.item
			? navTitle.title
			: null;
	const reading = title !== null;

	const segments: SegmentedItem[] = NAV_ITEMS.map((item) => {
		const current = active?.item === item;
		const expanded = reading && current;
		const Icon = expanded && active ? active.link.icon : item.icon;
		return {
			value: item.label,
			// 带尾部箭头的分组项有两枚图标，加宽后内边距与其余项一致
			weight: item.to === undefined ? 1.25 : 1,
			icon: <Icon className="size-4 shrink-0" />,
			label: expanded ? title : item.label,
			trailing:
				item.to === undefined ? (
					<ChevronDown
						aria-hidden="true"
						className="size-3 transition-transform duration-300 group-data-[state=open]/item:rotate-180"
					/>
				) : undefined,
			title: reading && !current ? item.label : undefined,
			render: (segment) => (
				<HeaderNavCell
					item={item}
					segment={segment}
					current={current}
					activeTo={active?.link.to}
				/>
			),
		};
	});

	return (
		<nav aria-label="主导航" className="pointer-events-auto hidden lg:block">
			<DropdownGroup>
				<Segmented
					value={active?.item.label ?? ""}
					segments={segments}
					size="lg"
					rounded="full"
					itemSize="4.75rem"
					expandSelected={reading}
					itemClassName="group/item data-[state=open]:text-foreground"
				/>
			</DropdownGroup>
		</nav>
	);
};

export default HeaderNav;
