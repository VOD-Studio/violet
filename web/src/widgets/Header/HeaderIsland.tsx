import { NAV_ITEMS, type NavItem, type NavLink, resolveActiveNav } from "@shared/config/nav";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import { LayoutGrid, X } from "lucide-react";
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 收起时常驻的主要入口，其余收进「更多」展开的面板 */
const PRIMARY_TAB_COUNT = 4;
/** 槽位数：主要入口加「更多」 */
const SLOT_COUNT = PRIMARY_TAB_COUNT + 1;
const COLLAPSED_HEIGHT = 56;
const COLLAPSED_MAX_WIDTH = 336;
const EXPANDED_MAX_WIDTH = 400;
const SIDE_GAP = 16;
const TRACK_PADDING = 8;
/** 向下滚动超过此距离才会收成小圆标 */
const COMPACT_AFTER_PX = 80;
/** 单次滚动方向判定的最小位移，过滤抖动 */
const SCROLL_DELTA_PX = 6;
const COMPACT_SIZE = 44;
/** 胶囊为全圆；展开成面板后收到功能性圆角上限 */
const EXPANDED_RADIUS = 16;

const SPRING = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;
/** 药丸在槽位间滑动用的弹簧，略带回弹 */
const SLIDE_SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const;
const BLUR_OUT = { opacity: 0, filter: "blur(6px)" };
const BLUR_IN = { opacity: 1, filter: "blur(0px)" };

type IslandMode = "tabs" | "compact" | "panel";

type RoutableNavItem = NavItem & { to: string };

const ROUTABLE_ITEMS = NAV_ITEMS.filter((item): item is RoutableNavItem => item.to !== undefined);
const PRIMARY_TABS = ROUTABLE_ITEMS.slice(0, PRIMARY_TAB_COUNT);
/** 面板「全部」区：有目标的顶层项在前，不与父项重复的二级项（如「归档」）排在其后 */
const PANEL_LINKS: NavLink[] = [
	...ROUTABLE_ITEMS.map((item) => ({ ...item, to: item.to })),
	...ROUTABLE_ITEMS.flatMap((item) =>
		(item.children ?? []).filter((child) => child.to !== item.to),
	),
];
const PANEL_GROUPS = NAV_ITEMS.filter((item) => item.to === undefined && item.children);

function useViewportWidth(): number {
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return width;
}

/** 向下滚动收成小圆标，向上滚动或回到顶部恢复 */
function useScrollCompact(): [boolean, (value: boolean) => void] {
	const [compact, setCompact] = useState(false);
	useEffect(() => {
		let last = window.scrollY;
		let frame = 0;
		const update = () => {
			frame = 0;
			const y = window.scrollY;
			const delta = y - last;
			if (y <= COMPACT_AFTER_PX) setCompact(false);
			else if (delta > SCROLL_DELTA_PX) setCompact(true);
			else if (delta < -SCROLL_DELTA_PX) setCompact(false);
			if (Math.abs(delta) > SCROLL_DELTA_PX) last = y;
		};
		const onScroll = () => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
		};
	}, []);
	return [compact, setCompact];
}

/**
 * HeaderIsland - 移动端底部灵动岛导航。
 *
 * 三种形态：平时是带主要入口的悬浮胶囊；向下滚动收成只显示当前页图标的小圆标，向上滚动或点击恢复；
 * 点「更多」向上展开成完整导航面板。形变直接动画宽、高与圆角（不做缩放变换），内容以透明度加模糊
 * 淡入淡出。通过 portal 挂在 body 上，不受头部定位上下文影响；lg 以上由顶部胶囊导航承担，此处隐藏。
 */
const HeaderIsland = () => {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return createPortal(<Island />, document.body);
};

function Island() {
	const [open, setOpen] = useState(false);
	const [compact, setCompact] = useScrollCompact();
	/** 点击入口后立刻让药丸滑过去，不等路由加载完成 */
	const [optimisticTo, setOptimisticTo] = useState<string | null>(null);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const routedTo = resolveActiveNav(pathname)?.link.to;
	const activeTo = optimisticTo ?? routedTo;
	const reduced = useReducedMotion();
	const viewport = useViewportWidth();
	const collapsedWidth = Math.min(viewport - SIDE_GAP * 2, COLLAPSED_MAX_WIDTH);
	const expandedWidth = Math.min(viewport - SIDE_GAP * 1.5, EXPANDED_MAX_WIDTH);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 路径变化即视为导航完成，需要收起面板并清掉乐观高亮
	useEffect(() => {
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
				? { width: COMPACT_SIZE, height: COMPACT_SIZE, borderRadius: COMPACT_SIZE / 2 }
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
				animate={size}
				transition={spring}
				className="pointer-events-auto relative overflow-hidden bg-card/85 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-xl dark:ring-1 dark:ring-white/10"
			>
				<AnimatePresence initial={false} mode="popLayout">
					{mode === "panel" ? (
						<motion.div key="panel" {...content}>
							<Panel
								activeTo={activeTo}
								onClose={() => setOpen(false)}
								reduced={!!reduced}
							/>
						</motion.div>
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
							<ActiveGlyph activeTo={activeTo} />
						</motion.button>
					) : (
						<motion.div key="tabs" {...content}>
							<Tabs
								activeTo={activeTo}
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

/** 小圆标里显示当前页图标；当前页不在主要入口时用「更多」图标 */
function ActiveGlyph({ activeTo }: { activeTo: string | undefined }) {
	const current = ROUTABLE_ITEMS.find((item) => item.to === activeTo);
	const Icon = current && PRIMARY_TABS.includes(current) ? current.icon : LayoutGrid;
	return <Icon className="size-5" />;
}

interface Slot {
	key: string;
	label: string;
	icon: NavLink["icon"];
	/** 路由入口；「更多」槽位无目标 */
	to?: string;
}

const SLOTS: Slot[] = [
	...PRIMARY_TABS.map((item) => ({
		key: item.to,
		label: item.label,
		icon: item.icon,
		to: item.to,
	})),
	{ key: "more", label: "更多", icon: LayoutGrid },
];

/**
 * 收起态入口条：药丸是叠在上面的一层反色副本，用 clip-path 裁成药丸形状，位置由弹簧驱动。
 * 药丸经过哪个入口，那里的图标与文字就在药丸范围内即时反色；整个过程只改 clip-path，不触发布局。
 */
function Tabs({
	activeTo,
	width,
	reduced,
	onSelect,
	onMore,
}: {
	activeTo: string | undefined;
	width: number;
	reduced: boolean;
	onSelect: (to: string) => void;
	onMore: () => void;
}) {
	const trackWidth = width - TRACK_PADDING * 2;
	const slotWidth = trackWidth / SLOT_COUNT;
	const primaryIndex = PRIMARY_TABS.findIndex((item) => item.to === activeTo);
	// 当前页不在主要入口（如笔记）时药丸落在「更多」上，提示它在更多里；没有命中任何页面则隐藏
	const activeIndex =
		activeTo === undefined ? -1 : primaryIndex >= 0 ? primaryIndex : SLOT_COUNT - 1;

	const left = useMotionValue(Math.max(0, activeIndex) * slotWidth);
	const visible = useMotionValue(activeIndex < 0 ? 0 : 1);
	useEffect(() => {
		const target = Math.max(0, activeIndex) * slotWidth;
		const config = reduced ? { duration: 0 } : SLIDE_SPRING;
		const controls = [
			animate(left, target, config),
			animate(visible, activeIndex < 0 ? 0 : 1, { duration: 0.15 }),
		];
		return () => {
			for (const control of controls) control.stop();
		};
	}, [activeIndex, slotWidth, reduced, left, visible]);

	const clipPath = useTransform([left, visible], ([x, v]: number[]) => {
		const lens = slotWidth * v;
		const inset = (slotWidth - lens) / 2;
		const l = x + inset;
		const r = trackWidth - x - slotWidth + inset;
		return `inset(0px ${r}px 0px ${l}px round ${ROW_HEIGHT / 2}px)`;
	});

	return (
		<div className="p-2" style={{ width }}>
			<div className="relative" style={{ height: ROW_HEIGHT }}>
				<div
					className="grid h-full"
					style={{ gridTemplateColumns: `repeat(${SLOT_COUNT}, 1fr)` }}
				>
					{SLOTS.map((slot) => (
						<SlotButton
							key={slot.key}
							slot={slot}
							active={slot.to === activeTo}
							onSelect={onSelect}
							onMore={onMore}
						/>
					))}
				</div>
				<motion.div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-foreground text-background"
					style={{ clipPath }}
				>
					<div
						className="grid h-full"
						style={{ gridTemplateColumns: `repeat(${SLOT_COUNT}, 1fr)` }}
					>
						{SLOTS.map((slot) => (
							<SlotFace key={slot.key} slot={slot} />
						))}
					</div>
				</motion.div>
			</div>
		</div>
	);
}

const ROW_HEIGHT = COLLAPSED_HEIGHT - TRACK_PADDING * 2;

function SlotFace({ slot }: { slot: Slot }) {
	const Icon = slot.icon;
	return (
		<span className="flex h-full flex-col items-center justify-center gap-0.5">
			<Icon className="size-[18px]" />
			<span className="text-[10px] leading-none font-medium">{slot.label}</span>
		</span>
	);
}

function SlotButton({
	slot,
	active,
	onSelect,
	onMore,
}: {
	slot: Slot;
	active: boolean;
	onSelect: (to: string) => void;
	onMore: () => void;
}) {
	const face = (
		<span className="flex h-full flex-col items-center justify-center gap-0.5 text-muted-foreground">
			<slot.icon className="size-[18px]" />
			<span className="text-[10px] leading-none font-medium">{slot.label}</span>
		</span>
	);
	const className =
		"block h-full rounded-full transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
	if (slot.to === undefined) {
		return (
			<button type="button" aria-label="展开全部导航" onClick={onMore} className={className}>
				{face}
			</button>
		);
	}
	return (
		<Link
			to={slot.to}
			aria-label={slot.label}
			aria-current={active ? "page" : undefined}
			onClick={() => onSelect(slot.to as string)}
			className={className}
		>
			{face}
		</Link>
	);
}

/** 展开态面板：全部目的地的图标网格，逐项淡入。 */
function Panel({
	activeTo,
	onClose,
	reduced,
}: {
	activeTo: string | undefined;
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
				<Grid links={PANEL_LINKS} activeTo={activeTo} reduced={reduced} startIndex={0} />
				{PANEL_GROUPS.map((group) => (
					<div key={group.label} className="mt-4">
						<p className="mb-2 px-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
							{group.label}
						</p>
						<Grid
							links={group.children ?? []}
							activeTo={activeTo}
							reduced={reduced}
							startIndex={PANEL_LINKS.length}
						/>
					</div>
				))}
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
