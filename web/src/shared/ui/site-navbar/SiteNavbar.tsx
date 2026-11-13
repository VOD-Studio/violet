import type { ActiveNav, NavItem } from "@shared/config/nav";
import { DropdownGroup, iconProps, Kbd, Segmented, type SegmentedItem } from "@violet/ui";
import { cn } from "cn";
import { ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { type NavbarLinkComponent, RouterLink } from "./link";
import { NavCell } from "./NavCell";

/** 常规态每项的宽度；带箭头的分组项按权重略宽。 */
const REST_ITEM_SIZE = "4.75rem";
/** 只剩图标的项宽：图标加左右各 12px。 */
const ICON_SIZE = "2.5rem";
/** 收起态里当前项显示标题时占的宽：图标、间距、190px 标题与内边距。 */
const TITLE_SLOT = "14.875rem";

const PILL =
	"pointer-events-auto relative flex h-10 items-center rounded-full border border-sheet-border shadow-soft backdrop-blur-md";

/**
 * 左药丸外壳：底色、边、软影与模糊。左容器本身只负责定位，外壳由 logo 触发器自己套用，
 * 因为变形弹出层从触发器长成面板，触发器必须是有底色的药丸，不能是外面再套一层药丸的透明按钮。
 */
export const NAVBAR_PILL_CLASS = `${PILL} bg-sheet-translucent`;

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
	/** 右药丸内容；药丸外壳由本组件提供。 */
	actions: ReactNode;
	/**
	 * actions 自带药丸外壳时仅保留定位容器，供组合锚点接管整个外形。
	 *
	 * @default false
	 */
	actionsHaveShell?: boolean;
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
 * 站点顶栏：左 logo 药丸、中间导航药丸（一级入口加末尾搜索）、右工具药丸。
 *
 * 纯展示：不取数据、不读路由；登录态、当前位置、标题、进度与收起态都由调用方给出。
 * 常规、详情（当前项展开成「栏目 / 标题」）、子页（「更多」换成子页名）、
 * 收起（导航只剩图标）四种形态由 props 组合出来。
 *
 * @param props - 见 {@link SiteNavbarProps}
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
	actionsHaveShell = false,
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
		: REST_ITEM_SIZE;

	const segments: SegmentedItem[] = items.map((item) => {
		const current = active?.item === item;
		const Icon = item.icon;
		let label: string | undefined = item.label;
		if (current && activeText) {
			label = reading && !collapsed ? `${item.label} / ${activeText}` : activeText;
		} else if (current && collapsed) {
			label = undefined;
		}
		return {
			value: item.label,
			// 带尾部箭头的分组项有两枚图标，常规态加宽后内边距与其余项一致
			weight: item.to === undefined && !collapsed ? 1.25 : 1,
			icon: <Icon className="size-4 shrink-0" />,
			label,
			trailing:
				item.to === undefined && !collapsed ? (
					<ChevronDown
						aria-hidden="true"
						{...iconProps(
							12,
							"transition-transform duration-300 group-data-[state=open]/item:rotate-180",
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
					label={label === undefined ? item.label : undefined}
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
					<DropdownGroup>
						<Segmented
							value={active?.item.label ?? ""}
							segments={segments}
							rounded="full"
							itemSize={itemSize}
							collapsedSize={ICON_SIZE}
							expandSelected={expanded}
							className="[--v-segmented-font-size:0.875rem] [--v-segmented-pad:0px] [--v-segmented-track:transparent]"
							itemClassName="group/item font-medium data-[state=open]:text-foreground"
						/>
					</DropdownGroup>
					<span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-rule2" />
					<SearchEntry compact={expanded} onClick={onSearch} />
					{routing === null ? null : <RoutingLine value={routing} />}
				</nav>
			</div>

			<div
				data-slot="navbar-right"
				inert={collapsed}
				className={cn(
					actionsHaveShell
						? "pointer-events-auto relative"
						: `${PILL} gap-0.5 bg-sheet-translucent p-1`,
					"transition-opacity duration-200 has-[[data-slot=morphing-popover-trigger][aria-expanded=true]]:z-20 group-data-[collapsed=true]/navbar:opacity-0 motion-reduce:transition-none",
				)}
			>
				{actionsHaveShell ? (
					<span className="pointer-events-none absolute inset-0 in-[[data-slot=navbar-right]:has([data-slot=morphing-popover-anchor][data-hidden])]:invisible">
						{ornaments?.right}
					</span>
				) : (
					ornaments?.right
				)}
				{actions}
			</div>
		</div>
	);
}
