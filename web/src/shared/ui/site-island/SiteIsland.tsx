import type { NavItem, NavLink } from "@shared/config/nav";
import { useReducedMotion } from "@shared/lib/motion";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { LayoutGrid, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ComponentProps, type ReactNode, useEffect, useMemo, useState } from "react";
import { type NavbarLinkComponent, RoutingLine } from "../site-navbar";
import {
	BLUR_IN,
	BLUR_OUT,
	COLLAPSED_HEIGHT,
	COMPACT_SIZE,
	EXPANDED_MAX_WIDTH,
	EXPANDED_RADIUS,
	PILL_PADDING,
	SIDE_GAP,
	SLOT_COUNT,
	SPRING,
	TRACK_PADDING,
} from "./metrics";
import { buildIslandNav, type IslandNav } from "./nav";
import { Tabs } from "./Tabs";

type IslandMode = "tabs" | "compact" | "panel";

/** 默认链接：客户端路由跳转，且不参与页面转场快照。 */
function IslandRouterLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
	return <Link to={href} viewTransition={false} {...props} />;
}

export interface SiteIslandPresence {
	/** 收起圆钮的读屏名称里的活动描述，如「正在播放 晴天」；compact 按钮 aria-label 为 `此刻${activityText}，展开详情与导航` */
	activityText: string;
	/** 收起态的活动胶囊内容；onWidthChange 报告内容宽度，岛按它撑开圆钮（原 PresenceTicker 的 onWidthChange） */
	renderTicker: (onWidthChange: (width: number) => void) => ReactNode;
	/** 展开面板顶部的「此刻」卡片（className 由展示层在外层容器上控制） */
	card: ReactNode;
}

export interface SiteIslandProps {
	/** 当前登录态下可见的一级入口（getNavItems 的结果） */
	items: NavItem[];
	/** 当前命中的目标 `to`（受控；含「点击后先滑过去」的乐观值由接线层算好再传入） */
	activeTo: string | undefined;
	/** 展开的面板（受控） */
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 滚动收起成圆钮（受控） */
	compact: boolean;
	onCompactChange: (compact: boolean) => void;
	/** 点击入口链接（左键且无修饰键）时回调，接线层据此设乐观值 */
	onSelect?: (to: string) => void;
	/** 视口或挂载容器宽度，岛的各态宽度都由它推出 */
	viewportWidth: number;
	/** 页面加载进度 0–100；null 不显示 */
	routing: number | null;
	/** 此刻状态；省略则没有活动胶囊与面板卡片 */
	presence?: SiteIslandPresence;
	/** 面板底部的主题选择插槽 */
	themePicker?: ReactNode;
	/** viewport：fixed 贴视口底部并在 lg 以上隐藏；container：absolute 贴最近定位祖先底部、不随断点隐藏，面板背板也限制在该祖先内 */
	placement?: "viewport" | "container";
	/** 链接渲染组件，默认交给站点路由跳转；自定义实现必须透传属性与 ref */
	LinkComponent?: NavbarLinkComponent;
}

/**
 * SiteIsland - 移动端底部灵动岛导航（纯展示层）。
 *
 * 展开时居中，向下滚动收成右侧圆钮；选中入口显示文字，透镜内显示实心图标。
 * 路由、在线状态与主题选择都由调用方通过 props 与插槽提供。
 */
export function SiteIsland({
	items,
	activeTo,
	open,
	onOpenChange,
	compact,
	onCompactChange,
	onSelect,
	viewportWidth: viewport,
	routing,
	presence,
	themePicker,
	placement = "viewport",
	LinkComponent = IslandRouterLink,
}: SiteIslandProps) {
	const nav = useMemo(() => buildIslandNav(items), [items]);
	const currentLink = nav.links.find((link) => link.to === activeTo);
	// 站点菜单均为全角中文：text-sm 字宽加图标与文字间的留白。
	const labelWidth = (currentLink?.label.length ?? 2) * 14 + 12;
	const reduced = useReducedMotion();
	const collapsedWidth = Math.min(
		viewport - SIDE_GAP * 2,
		SLOT_COUNT * 44 + labelWidth + TRACK_PADDING * 2,
	);
	const expandedWidth = Math.min(viewport - SIDE_GAP * 1.5, EXPANDED_MAX_WIDTH);
	const [tickerWidth, setTickerWidth] = useState(0);
	// 滚动收起后有活动时，圆钮换成活动胶囊；点开直接展开面板查看详情
	const compactWidth = presence
		? Math.min(viewport - SIDE_GAP * 2, Math.max(COMPACT_SIZE, tickerWidth + PILL_PADDING))
		: COMPACT_SIZE;
	const container = placement === "container";

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onOpenChange(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onOpenChange]);

	const mode: IslandMode = open ? "panel" : compact ? "compact" : "tabs";
	const spring = reduced ? { duration: 0 } : SPRING;
	const fade = (delay: number, duration: number) =>
		reduced ? { duration: 0 } : { delay, duration };
	const size =
		mode === "panel"
			? { width: expandedWidth, height: "auto" as const, borderRadius: EXPANDED_RADIUS }
			: mode === "compact"
				? { width: compactWidth, height: COMPACT_SIZE, borderRadius: COMPACT_SIZE / 2 }
				: {
						width: collapsedWidth,
						height: COLLAPSED_HEIGHT,
						borderRadius: COLLAPSED_HEIGHT / 2,
					};
	const content = {
		initial: BLUR_OUT,
		animate: { ...BLUR_IN, transition: fade(0.08, 0.22) },
		exit: { ...BLUR_OUT, transition: fade(0, 0.12) },
	};

	return (
		<div
			className={cn(
				"pointer-events-none inset-x-0 bottom-0 z-50 flex justify-center",
				container
					? "absolute pb-3"
					: "fixed pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden",
			)}
		>
			<AnimatePresence>
				{open && (
					<motion.button
						type="button"
						aria-label="收起导航"
						tabIndex={-1}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={fade(0, 0.2)}
						onClick={() => onOpenChange(false)}
						className={cn(
							"pointer-events-auto -z-10 cursor-default bg-background/50 backdrop-blur-sm",
							container ? "absolute inset-0" : "fixed inset-0",
						)}
					/>
				)}
			</AnimatePresence>

			<motion.nav
				aria-label="移动端导航"
				initial={false}
				animate={{
					...size,
					x: mode === "compact" ? (viewport - SIDE_GAP * 2 - compactWidth) / 2 : 0,
				}}
				style={container ? undefined : { viewTransitionName: "site-island" }}
				transition={spring}
				className={cn(
					"pointer-events-auto relative shadow-soft ring-1 ring-sheet-border",
					mode === "tabs"
						? "overflow-visible bg-muted/78 backdrop-blur-md"
						: "overflow-hidden bg-sheet-translucent backdrop-blur-xl",
				)}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{mode === "panel" ? (
						<motion.div key="panel" {...content}>
							<Panel
								nav={nav}
								activeTo={activeTo}
								presence={presence}
								themePicker={themePicker}
								LinkComponent={LinkComponent}
								onClose={() => onOpenChange(false)}
								reduced={reduced}
							/>
						</motion.div>
					) : mode === "compact" && presence ? (
						<motion.button
							key="compact-presence"
							type="button"
							aria-label={`此刻${presence.activityText}，展开详情与导航`}
							onClick={() => onOpenChange(true)}
							{...content}
							className="flex h-11 w-full items-center justify-center px-3.5 text-sm text-foreground"
						>
							{presence.renderTicker(setTickerWidth)}
						</motion.button>
					) : mode === "compact" ? (
						<motion.button
							key="compact"
							type="button"
							aria-label="展开导航"
							onClick={() => onCompactChange(false)}
							{...content}
							className="flex size-12 items-center justify-center text-foreground"
							style={{ width: COMPACT_SIZE, height: COMPACT_SIZE }}
						>
							<ActiveGlyph links={nav.links} activeTo={activeTo} />
						</motion.button>
					) : (
						<motion.div key="tabs" {...content}>
							<Tabs
								nav={nav}
								activeTo={activeTo}
								currentLink={currentLink}
								labelWidth={labelWidth}
								width={collapsedWidth}
								reduced={!!reduced}
								LinkComponent={LinkComponent}
								onSelect={onSelect}
								onMore={() => onOpenChange(true)}
							/>
						</motion.div>
					)}
				</AnimatePresence>
				{routing === null ? null : <RoutingLine value={routing} />}
			</motion.nav>
		</div>
	);
}

/** 收起圆钮沿用当前菜单图标，未命中导航时显示全部菜单入口。 */
function ActiveGlyph({ links, activeTo }: { links: NavLink[]; activeTo: string | undefined }) {
	const current = links.find((item) => item.to === activeTo);
	const Icon = current?.icon ?? LayoutGrid;
	return <Icon className="size-5" />;
}

/** 展开态面板：全部目的地的图标网格，逐项淡入。 */
function Panel({
	nav,
	activeTo,
	presence,
	themePicker,
	LinkComponent,
	onClose,
	reduced,
}: {
	nav: IslandNav;
	activeTo: string | undefined;
	presence: SiteIslandPresence | undefined;
	themePicker: ReactNode;
	LinkComponent: NavbarLinkComponent;
	onClose: () => void;
	reduced: boolean;
}) {
	return (
		<div className="p-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
					Violet · 浏览本站
				</span>
				<button
					type="button"
					aria-label="收起导航"
					onClick={onClose}
					className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<X className="size-4" />
				</button>
			</div>

			<div className="-m-1 max-h-[min(60vh,28rem)] overflow-y-auto p-1">
				{presence ? (
					<div className="mb-4 rounded-2xl bg-muted/50 p-4">{presence.card}</div>
				) : null}
				<Grid
					links={nav.panelLinks}
					activeTo={activeTo}
					reduced={reduced}
					startIndex={0}
					LinkComponent={LinkComponent}
				/>
				{nav.panelGroups.map((group) => (
					<div key={group.label} className="mt-4">
						<p className="mb-2 px-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
							{group.label}
						</p>
						<Grid
							links={group.children ?? []}
							activeTo={activeTo}
							reduced={reduced}
							startIndex={nav.panelLinks.length}
							LinkComponent={LinkComponent}
						/>
					</div>
				))}
				{themePicker ? <div className="mt-4">{themePicker}</div> : null}
			</div>
		</div>
	);
}

function Grid({
	links,
	activeTo,
	reduced,
	startIndex,
	LinkComponent,
}: {
	links: NavLink[];
	activeTo: string | undefined;
	reduced: boolean;
	startIndex: number;
	LinkComponent: NavbarLinkComponent;
}) {
	return (
		<div className="grid grid-cols-4 gap-1">
			{links.map((link, i) => {
				const Icon = link.icon;
				const current = activeTo === link.to;
				return (
					<motion.div
						key={link.to}
						initial={BLUR_OUT}
						animate={{
							...BLUR_IN,
							transition: reduced
								? { duration: 0 }
								: { delay: 0.12 + (startIndex + i) * 0.018, duration: 0.2 },
						}}
					>
						<LinkComponent
							href={link.to}
							aria-current={current ? "page" : undefined}
							className="group/tile flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<span
								aria-hidden="true"
								className={cn(
									"flex size-11 items-center justify-center rounded-2xl transition-colors duration-200",
									current
										? "bg-foreground text-background"
										: "bg-muted/70 text-muted-foreground group-hover/tile:text-foreground",
								)}
							>
								<Icon className="size-5" />
							</span>
							<span className="text-[11px] leading-none font-medium text-foreground">
								{link.label}
							</span>
						</LinkComponent>
					</motion.div>
				);
			})}
		</div>
	);
}
