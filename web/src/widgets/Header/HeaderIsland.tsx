import {
	describeActivity,
	deviceActivities,
	type LivePresence,
	PresenceCard,
	PresenceTicker,
	useLivePresence,
} from "@features/presence";
import { ThemePicker } from "@features/theme-switcher";
import {
	flattenNavLinks,
	getNavItems,
	type NavItem,
	type NavLink,
	resolveActiveNav,
} from "@shared/config/nav";
import { useScrollCompact } from "@shared/hooks/use-scroll-compact";
import { useReducedMotion } from "@shared/lib/motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import { LayoutGrid, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 收起时常驻的主要入口，其余收进「更多」展开的面板 */
const PRIMARY_TAB_COUNT = 4;
/** 槽位数：主要入口加「更多」 */
const SLOT_COUNT = PRIMARY_TAB_COUNT + 1;
const COLLAPSED_HEIGHT = 52;
const EXPANDED_MAX_WIDTH = 400;
const SIDE_GAP = 16;
const TRACK_PADDING = 4;
const COMPACT_SIZE = 44;
/** 活动胶囊左右内边距之和 */
const PILL_PADDING = 28;
/** 胶囊为全圆；展开成面板后收到功能性圆角上限 */
const EXPANDED_RADIUS = 16;

const SPRING = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;
const SLIDE_EASING = `linear(${Array.from({ length: 30 }, (_, index) =>
	springProgress((index / 29) * 0.48),
).join(",")})`;
const SLIDE_TRANSITION = `transform 480ms ${SLIDE_EASING}`;

function springProgress(seconds: number): number {
	if (seconds <= 0) return 0;
	if (seconds >= 0.48) return 1;
	const frequency = Math.sqrt(96);
	return (
		1 -
		Math.exp(-18 * seconds) *
			(Math.cos(frequency * seconds) + (18 / frequency) * Math.sin(frequency * seconds))
	);
}
const BLUR_OUT = { opacity: 0, filter: "blur(6px)" };
const BLUR_IN = { opacity: 1, filter: "blur(0px)" };

type IslandMode = "tabs" | "compact" | "panel";

type RoutableNavItem = NavItem & { to: string };

/** 岛上随登录态变化的导航数据。 */
interface IslandNav {
	/** 当前登录态下可见的顶层项。 */
	items: NavItem[];
	/** 全部可跳转目标（含二级项，按 `to` 去重）。 */
	links: NavLink[];
	/** 收起态常驻的主要入口。 */
	primaryTabs: RoutableNavItem[];
	/** 面板「全部」区：有目标的顶层项在前，不与父项重复的二级项（如「归档」）排在其后。 */
	panelLinks: NavLink[];
	/** 面板里按分组列出的纯分组项。 */
	panelGroups: NavItem[];
}

function buildIslandNav(items: NavItem[]): IslandNav {
	const routable = items.filter((item): item is RoutableNavItem => item.to !== undefined);
	return {
		items,
		links: flattenNavLinks(items),
		primaryTabs: routable.slice(0, PRIMARY_TAB_COUNT),
		panelLinks: [
			...routable,
			...routable.flatMap((item) =>
				(item.children ?? []).filter((child) => child.to !== item.to),
			),
		],
		panelGroups: items.filter((item) => item.to === undefined && item.children),
	};
}

function useViewportWidth(): number {
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return width;
}

/**
 * HeaderIsland - 移动端底部灵动岛导航。
 *
 * 展开时居中，向下滚动收成右侧圆钮；选中入口显示文字，透镜内显示实心图标。
 * 导航独立于页面转场快照，不随正文淡入淡出。
 */
const HeaderIsland = ({ authenticated }: { authenticated: boolean }) => {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return createPortal(<Island authenticated={authenticated} />, document.body);
};

function Island({ authenticated }: { authenticated: boolean }) {
	const [open, setOpen] = useState(false);
	const [compact, setCompact] = useScrollCompact();
	/** 点击入口后立刻让药丸滑过去，不等路由加载完成 */
	const [optimisticTo, setOptimisticTo] = useState<string | null>(null);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const nav = useMemo(() => buildIslandNav(getNavItems({ authenticated })), [authenticated]);
	const routedTo = resolveActiveNav(pathname, nav.items)?.link.to;
	const activeTo = optimisticTo ?? routedTo;
	const currentLink = nav.links.find((link) => link.to === activeTo);
	// 站点菜单均为全角中文：text-sm 字宽加图标与文字间的留白。
	const labelWidth = (currentLink?.label.length ?? 2) * 14 + 12;
	const reduced = useReducedMotion();
	const viewport = useViewportWidth();
	const collapsedWidth = Math.min(
		viewport - SIDE_GAP * 2,
		SLOT_COUNT * 44 + labelWidth + TRACK_PADDING * 2,
	);
	const expandedWidth = Math.min(viewport - SIDE_GAP * 1.5, EXPANDED_MAX_WIDTH);
	const presence = useLivePresence();
	const [activity] = presence.lead ? deviceActivities(presence.lead) : [];
	const [tickerWidth, setTickerWidth] = useState(0);
	// 滚动收起后有活动时，圆钮换成活动胶囊；点开直接展开面板查看详情
	const compactWidth = activity
		? Math.min(viewport - SIDE_GAP * 2, Math.max(COMPACT_SIZE, tickerWidth + PILL_PADDING))
		: COMPACT_SIZE;
	/** 仅在路径真正变化时收起；挂载时的 effect 不能冲掉同步打开的面板（测试/极速点击） */
	const prevPathnameRef = useRef(pathname);

	useEffect(() => {
		if (prevPathnameRef.current === pathname) return;
		prevPathnameRef.current = pathname;
		setOpen(false);
		setOptimisticTo(null);
	}, [pathname]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	// 聊天是全屏页，底部是输入栏，岛会盖住它
	if (pathname.startsWith("/chat")) return null;

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
		<div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
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
						onClick={() => setOpen(false)}
						className="pointer-events-auto fixed inset-0 -z-10 cursor-default bg-background/50 backdrop-blur-sm"
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
				style={{ viewTransitionName: "site-island" }}
				transition={spring}
				className={cn(
					"pointer-events-auto relative",
					mode === "tabs"
						? "overflow-visible bg-muted"
						: "overflow-hidden bg-card/85 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-xl dark:ring-1 dark:ring-white/10",
				)}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{mode === "panel" ? (
						<motion.div key="panel" {...content}>
							<Panel
								nav={nav}
								activeTo={activeTo}
								presence={presence}
								onClose={() => setOpen(false)}
								reduced={reduced}
							/>
						</motion.div>
					) : mode === "compact" && presence.lead && activity ? (
						<motion.button
							key="compact-presence"
							type="button"
							aria-label={`此刻${describeActivity(activity)}，展开详情与导航`}
							onClick={() => setOpen(true)}
							{...content}
							className="flex h-11 w-full items-center justify-center px-3.5 text-sm text-foreground"
						>
							<PresenceTicker
								device={presence.lead}
								clockOffset={presence.clockOffset}
								showElapsed
								primaryClassName="max-w-32"
								onWidthChange={setTickerWidth}
							/>
						</motion.button>
					) : mode === "compact" ? (
						<motion.button
							key="compact"
							type="button"
							aria-label="展开导航"
							onClick={() => setCompact(false)}
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
								onSelect={(to) => setOptimisticTo(to)}
								onMore={() => setOpen(true)}
							/>
						</motion.div>
					)}
				</AnimatePresence>
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

interface Slot {
	key: string;
	label: string;
	icon: NavLink["icon"];
	/** 路由入口；「更多」槽位无目标 */
	to?: string;
}

function buildSlots(primaryTabs: RoutableNavItem[]): Slot[] {
	return [
		...primaryTabs.map((item) => ({
			key: item.to,
			label: item.label,
			icon: item.icon,
			to: item.to,
		})),
		{ key: "more", label: "更多", icon: LayoutGrid },
	];
}

/** 透镜与反向平移的实心副本相互抵消位移，只在透镜经过处反色。 */
function Tabs({
	nav,
	activeTo,
	currentLink,
	labelWidth,
	width,
	reduced,
	onSelect,
	onMore,
}: {
	nav: IslandNav;
	activeTo: string | undefined;
	currentLink: NavLink | undefined;
	labelWidth: number;
	width: number;
	reduced: boolean;
	onSelect: (to: string) => void;
	onMore: () => void;
}) {
	const trackWidth = width - TRACK_PADDING * 2;
	const slotWidth = (trackWidth - labelWidth) / SLOT_COUNT;
	const primaryIndex = nav.primaryTabs.findIndex((item) => item.to === activeTo);
	// 当前页不在主要入口（如笔记）时药丸落在「更多」上，提示它在更多里；没有命中任何页面则隐藏
	const activeIndex =
		activeTo === undefined ? -1 : primaryIndex >= 0 ? primaryIndex : SLOT_COUNT - 1;
	const slots = buildSlots(nav.primaryTabs).map((slot) =>
		slot.key === "more" && activeIndex === SLOT_COUNT - 1 && currentLink
			? { ...slot, label: currentLink.label, icon: currentLink.icon }
			: slot,
	);

	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const left = Math.max(0, activeIndex) * slotWidth;
	const right = left + slotWidth + labelWidth;
	const clipPath = `inset(0px ${trackWidth - right}px 0px ${left}px round 22px)`;
	const lensRef = useRef<HTMLDivElement>(null);
	const previousClip = useRef(clipPath);
	const shapeAnimation = useRef<Animation | null>(null);
	useLayoutEffect(() => {
		const lens = lensRef.current;
		if (!lens) return;
		const fromClip =
			shapeAnimation.current?.playState === "running"
				? getComputedStyle(lens).clipPath
				: previousClip.current;
		previousClip.current = clipPath;
		shapeAnimation.current?.cancel();
		if (fromClip === clipPath || reduced || activeIndex < 0) return;
		const insets = fromClip
			.slice(6)
			.split("round")[0]
			.trim()
			.split(/\s+/)
			.map(Number.parseFloat);
		const fromLeft = insets[3] ?? insets[1] ?? insets[0];
		const fromRight = trackWidth - (insets[1] ?? insets[0]);
		const distance = left - fromLeft;
		const edgeDelay = Math.min(0.08, (labelWidth / Math.max(1, Math.abs(distance))) * 0.08);
		const keyframes = Array.from({ length: 35 }, (_, index) => {
			const seconds = (index / 34) * 0.56;
			const l =
				fromLeft +
				(left - fromLeft) * springProgress(seconds - (distance < 0 ? edgeDelay : 0));
			const r =
				fromRight +
				(right - fromRight) * springProgress(seconds - (distance > 0 ? edgeDelay : 0));
			return { clipPath: `inset(0px ${trackWidth - r}px 0px ${l}px round 22px)` };
		});
		shapeAnimation.current = lens.animate?.(keyframes, { duration: 560 }) ?? null;
	}, [activeIndex, clipPath, labelWidth, left, reduced, right, trackWidth]);
	useEffect(() => () => shapeAnimation.current?.cancel(), []);

	const lean =
		reduced || hoveredIndex === null
			? 0
			: Math.max(-4, Math.min(4, (hoveredIndex - activeIndex) * 4));
	const transition = reduced ? "none" : SLIDE_TRANSITION;

	return (
		<div
			className="p-1"
			style={{ width }}
			onPointerOver={(event) => {
				if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
				const slot = event.target.closest<HTMLElement>("[data-nav-index]");
				if (slot) setHoveredIndex(Number(slot.dataset.navIndex));
			}}
			onPointerLeave={() => setHoveredIndex(null)}
		>
			<div className="relative" style={{ height: ROW_HEIGHT }}>
				<div className="relative h-full">
					{slots.map((slot, index) => (
						<SlotButton
							key={slot.key}
							slot={slot}
							active={index === activeIndex}
							index={index}
							offset={
								index * slotWidth +
								(activeIndex >= 0 && index > activeIndex ? labelWidth : 0)
							}
							width={slotWidth}
							labelWidth={labelWidth}
							reduced={reduced}
							onSelect={onSelect}
							onMore={onMore}
						/>
					))}
				</div>
				<div className="pointer-events-none absolute inset-0 drop-shadow-[0_4px_24px_rgb(0_0_0/0.05)]">
					<div
						ref={lensRef}
						aria-hidden="true"
						className="pointer-events-none absolute top-0 left-0 h-full overflow-hidden rounded-full bg-white text-neutral-950"
						style={{
							width: trackWidth,
							transform: `translateX(${lean}px)`,
							transition,
							opacity: activeIndex < 0 ? 0 : 1,
							clipPath,
							willChange: "transform, clip-path",
						}}
					>
						<div
							className="relative h-full"
							style={{
								width: trackWidth,
								transform: `translateX(${-lean}px)`,
								transition,
							}}
						>
							{slots.map((slot, index) => (
								<span
									key={slot.key}
									className="absolute top-0 left-0 h-full"
									style={{
										transform: `translateX(${index * slotWidth + (activeIndex >= 0 && index > activeIndex ? labelWidth : 0)}px)`,
										transition,
									}}
								>
									<SlotFace
										slot={slot}
										active={index === activeIndex}
										width={slotWidth}
										labelWidth={labelWidth}
										reduced={reduced}
										filled
									/>
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const ROW_HEIGHT = COLLAPSED_HEIGHT - TRACK_PADDING * 2;

interface SlotFaceProps {
	slot: Slot;
	active: boolean;
	width: number;
	labelWidth: number;
	reduced: boolean;
	filled?: boolean;
}

function SlotFace({ slot, active, width, labelWidth, reduced, filled = false }: SlotFaceProps) {
	const Icon = slot.icon;
	return (
		<span
			className="pointer-events-none relative block h-full"
			style={{ width: width + labelWidth }}
		>
			<span
				className="absolute inset-y-0 left-0 flex items-center justify-center"
				style={{ width }}
			>
				<Icon className="size-5" fill={filled ? "currentColor" : "none"} />
			</span>
			<span
				className="absolute inset-y-0 flex items-center whitespace-nowrap text-sm leading-none font-medium"
				style={{
					left: width - 4,
					opacity: active ? 1 : 0,
					transition: reduced ? "none" : `opacity 100ms ${active ? "180ms" : "0ms"}`,
				}}
			>
				{slot.label}
			</span>
		</span>
	);
}

function SlotButton({
	slot,
	active,
	width,
	labelWidth,
	reduced,
	offset,
	index,
	onSelect,
	onMore,
}: SlotFaceProps & {
	offset: number;
	index: number;
	onSelect: (to: string) => void;
	onMore: () => void;
}) {
	const face = (
		<SlotFace
			slot={slot}
			active={active}
			width={width}
			labelWidth={labelWidth}
			reduced={reduced}
		/>
	);
	const className =
		"absolute top-0 left-0 block h-full rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
	const style = {
		width: width + (active ? labelWidth : 0),
		transform: `translateX(${offset}px)`,
		transition: reduced ? "none" : SLIDE_TRANSITION,
	};
	if (slot.to === undefined) {
		return (
			<button
				type="button"
				aria-label={active ? `${slot.label}，展开全部导航` : "展开全部导航"}
				aria-current={active ? "page" : undefined}
				onClick={onMore}
				className={className}
				style={style}
				data-nav-index={index}
			>
				{face}
			</button>
		);
	}
	return (
		<Link
			to={slot.to}
			viewTransition={false}
			aria-label={slot.label}
			aria-current={active ? "page" : undefined}
			data-nav-index={index}
			onClick={(event) => {
				if (
					event.button === 0 &&
					!event.metaKey &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey
				) {
					onSelect(slot.to as string);
				}
			}}
			className={className}
			style={style}
		>
			{face}
		</Link>
	);
}

/** 展开态面板：全部目的地的图标网格，逐项淡入。 */
function Panel({
	nav,
	activeTo,
	presence,
	onClose,
	reduced,
}: {
	nav: IslandNav;
	activeTo: string | undefined;
	presence: LivePresence;
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
				{presence.lead ? (
					<PresenceCard
						devices={presence.devices}
						lead={presence.lead}
						clockOffset={presence.clockOffset}
						className="mb-4 rounded-2xl bg-muted/50 p-4"
					/>
				) : null}
				<Grid links={nav.panelLinks} activeTo={activeTo} reduced={reduced} startIndex={0} />
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
						/>
					</div>
				))}
				<div className="mt-4">
					<ThemePicker />
				</div>
			</div>
		</div>
	);
}

function Grid({
	links,
	activeTo,
	reduced,
	startIndex,
}: {
	links: NavLink[];
	activeTo: string | undefined;
	reduced: boolean;
	startIndex: number;
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
						<Link
							to={link.to}
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
						</Link>
					</motion.div>
				);
			})}
		</div>
	);
}

export default HeaderIsland;
