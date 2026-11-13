import type { ActiveNav, NavItem } from "@shared/config/nav";
import {
	DropdownGroup,
	iconProps,
	Kbd,
	Segmented,
	type SegmentedItem,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@violet/ui";
import { cn } from "cn";
import { ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { type NavbarLinkComponent, RouterLink } from "./link";
import { NavCell } from "./NavCell";

/** 普通态基础项宽（rem）；额外图标与省略号按占位追加。 */
const REST_ITEM_SIZE = 4.75;
/** 只剩图标的项宽：图标加左右各 12px。 */
const ICON_SIZE = "2.5rem";
/** 收起态里当前项显示标题时占的宽：图标、间距、190px 标题与内边距。 */
const TITLE_SLOT = "14.875rem";

const PILL =
	"pointer-events-auto relative flex h-10 items-center rounded-full border border-sheet-border shadow-soft backdrop-blur-md";

/**
 * 药丸的底色、描边、软影与模糊外壳。
 *
 * @remarks 套在品牌触发器或操作组锚点上；外容器仅提供定位参照。
 */
export const NAVBAR_PILL_CLASS = `${PILL} bg-sheet-translucent`;

/**
 * 三枚顶栏药丸的内容与导航状态。
 *
 * @remarks items 与 active 必须来自同一组导航对象；收起态仍保留详情标题与完整入口名称。
 */
export interface SiteNavbarProps {
	/** 当前登录态下可见的一级入口。 */
	items: NavItem[];
	/** 当前页面命中的导航位置；没有命中任何入口时为 null。 */
	active: ActiveNav | null;
	/** 详情页标题；有值时当前项展开成「栏目 / 标题」，其余项收为图标。 */
	title?: string | null;
	/** 文章阅读进度 0–100；仅详情态画在当前项底部，省略则不画。 */
	readingProgress?: number;
	/** 页面加载进度 0–100，画在导航药丸下沿；null 或省略表示没有加载。 */
	routing?: number | null;
	/** 向下滚动后的收起态：导航只剩图标，右药丸淡出且不可交互。 */
	collapsed?: boolean;
	/** 左药丸内容；药丸外壳不由本组件提供，logo 自己套用 {@link NAVBAR_PILL_CLASS}。 */
	logo: ReactNode;
	/** 右药丸内容；宿主以 {@link NAVBAR_PILL_CLASS} 提供可形变的外壳。 */
	actions: ReactNode;
	/** 点击搜索入口。 */
	onSearch: () => void;
	/** 季节挂件插槽；展示层不依赖 features，由接线层注入。 */
	ornaments?: { left?: ReactNode; center?: ReactNode; right?: ReactNode };
	/** 中药丸的显隐类名，默认窄屏隐藏（窄屏由底部岛接管）。 */
	centerClassName?: string;
	/** 链接渲染组件，默认走路由跳转。 */
	LinkComponent?: NavbarLinkComponent;
	className?: string;
}

/** 搜索入口：药丸末尾的图标、文字与快捷键；详情与收起态收成纯图标。 */
function SearchEntry({ compact, onClick }: { compact: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			data-compact={compact}
			aria-keyshortcuts="Meta+K Control+K"
			onClick={onClick}
			className="group/search flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[compact=true]:px-2.75 motion-reduce:transition-none"
		>
			<Search aria-hidden="true" className="size-4 shrink-0" />
			<span className="flex max-w-40 items-center gap-2 overflow-hidden pl-2 whitespace-nowrap transition-[max-width,padding,opacity] duration-300 ease-out group-data-[compact=true]/search:max-w-0 group-data-[compact=true]/search:pl-0 group-data-[compact=true]/search:opacity-0 motion-reduce:transition-none">
				搜索
				<Kbd keys={["mod", "K"]} />
			</span>
		</button>
	);
}

/** 页面加载进度线：药丸下沿，季节色。导航药丸与移动岛共用。 */
export function RoutingLine({ value }: { value: number }) {
	return (
		<span
			role="progressbar"
			aria-label="页面加载"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(value)}
			className="pointer-events-none absolute right-5.5 bottom-0.5 left-5.5 h-0.5 overflow-hidden rounded-xs"
		>
			<span
				className="block h-full rounded-xs bg-decoration transition-[width] duration-200 ease-out motion-reduce:transition-none"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</span>
	);
}

/**
 * 站点顶栏的品牌、导航与工具三枚药丸。
 *
 * @remarks 展示层不读取数据和路由；当前入口、详情标题、进度与收起状态由 props 提供。
 */
export function SiteNavbar({
	items,
	active,
	title = null,
	readingProgress,
	routing = null,
	collapsed = false,
	logo,
	actions,
	onSearch,
	ornaments,
	centerClassName = "hidden lg:block",
	LinkComponent = RouterLink,
	className,
}: SiteNavbarProps) {
	const reading = title !== null && active !== null;
	const childName = active && active.item.to === undefined ? active.link.label : null;
	/** 当前项显示的文字：详情标题；子页名只在未收起时显示，收起后导航只留图标。 */
	const activeText = reading ? title : collapsed ? null : childName;
	const expanded = reading || collapsed;
	const count = items.length;

	const itemSize = collapsed
		? activeText
			? `calc((${TITLE_SLOT} + ${count - 1} * ${ICON_SIZE}) / ${count})`
			: ICON_SIZE
		: `${REST_ITEM_SIZE}rem`;

	const segments: SegmentedItem[] = items.map((item) => {
		const current = active?.item === item;
		const Icon = item.icon;
		let label: string | undefined = item.label;
		if (current && activeText) {
			label = reading && !collapsed ? `${item.label} / ${activeText}` : activeText;
		} else if (current && collapsed) {
			label = undefined;
		}
		const characters = !expanded && label ? Array.from(label) : null;
		const shortened = characters !== null && characters.length > 2;
		const displayLabel = shortened ? `${characters[0]}${characters[1]}…` : label;
		const hasTrailing = item.to === undefined && !collapsed;
		// 箭头连间距占 1.125rem，省略号占一个 0.875rem 字宽。
		const extraSize = (hasTrailing ? 1.125 : 0) + (shortened ? 0.875 : 0);
		return {
			value: item.label,
			weight: expanded ? 1 : (REST_ITEM_SIZE + extraSize) / REST_ITEM_SIZE,
			icon: <Icon className="size-4 shrink-0" />,
			label: label ? (
				<Tooltip truncatedOnly={!shortened}>
					<TooltipTrigger asChild>
						<span data-slot="navbar-label" className="block truncate">
							{displayLabel}
						</span>
					</TooltipTrigger>
					<TooltipContent>{label}</TooltipContent>
				</Tooltip>
			) : undefined,
			trailing: hasTrailing ? (
				<ChevronDown
					aria-hidden="true"
					{...iconProps(
						12,
						"shrink-0 transition-transform duration-300 group-data-[state=open]/item:rotate-180",
					)}
				/>
			) : undefined,
			title: expanded && !current ? item.label : undefined,
			render: (segment) => (
				<NavCell
					item={item}
					segment={segment}
					current={current}
					activeTo={active?.link.to}
					label={label ?? item.label}
					readingProgress={reading && current ? readingProgress : undefined}
					LinkComponent={LinkComponent}
				/>
			),
		};
	});

	return (
		<div
			data-slot="site-navbar"
			data-collapsed={collapsed}
			className={cn(
				"group/navbar relative flex h-10 items-center justify-between",
				className,
			)}
		>
			<div
				data-slot="navbar-left"
				className="pointer-events-auto relative flex h-10 items-center has-[[data-slot=morphing-popover-trigger][aria-expanded=true]]:z-20"
			>
				{ornaments?.left}
				{logo}
			</div>

			<div
				className={cn(
					"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
					centerClassName,
				)}
			>
				<nav aria-label="主导航" className={cn(PILL, "gap-0.5 bg-muted/78 p-1")}>
					{ornaments?.center}
					<TooltipProvider>
						<DropdownGroup>
							<Segmented
								value={active?.item.label ?? ""}
								segments={segments}
								rounded="full"
								itemSize={itemSize}
								collapsedSize={ICON_SIZE}
								expandSelected={expanded}
								className="[--v-segmented-font-size:0.875rem] [--v-segmented-pad:0px] [--v-segmented-track:transparent]"
								itemClassName={cn(
									"group/item font-medium data-[state=open]:text-foreground",
									!expanded && "px-3",
								)}
							/>
						</DropdownGroup>
					</TooltipProvider>
					<span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-rule2" />
					<SearchEntry compact={expanded} onClick={onSearch} />
					{routing === null ? null : <RoutingLine value={routing} />}
				</nav>
			</div>

			<div
				data-slot="navbar-right"
				inert={collapsed}
				className={cn(
					"pointer-events-auto relative transition-opacity duration-200 has-[[data-slot=morphing-popover-trigger][aria-expanded=true]]:z-20 group-data-[collapsed=true]/navbar:opacity-0 motion-reduce:transition-none",
				)}
			>
				<span className="pointer-events-none absolute inset-0 in-[[data-slot=navbar-right]:has([data-slot=morphing-popover-anchor][data-hidden])]:invisible">
					{ornaments?.right}
				</span>
				{actions}
			</div>
		</div>
	);
}
