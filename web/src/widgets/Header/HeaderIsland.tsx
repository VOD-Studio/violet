import { NAV_ITEMS, type NavItem, type NavLink, resolveActiveNav } from "@shared/config/nav";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import { LayoutGrid, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 收起时常驻的主要入口，其余收进「更多」展开的面板 */
const PRIMARY_TAB_COUNT = 4;
const COLLAPSED_HEIGHT = 56;
const COLLAPSED_MAX_WIDTH = 336;
const EXPANDED_MAX_WIDTH = 400;
const SIDE_GAP = 16;
/** 胶囊为全圆；展开成面板后收到功能性圆角上限 */
const COLLAPSED_RADIUS = COLLAPSED_HEIGHT / 2;
const EXPANDED_RADIUS = 16;

const SPRING = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;
const BLUR_OUT = { opacity: 0, filter: "blur(6px)" };
const BLUR_IN = { opacity: 1, filter: "blur(0px)" };

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

/**
 * HeaderIsland - 移动端底部灵动岛导航。
 *
 * 收起时是带主要入口的悬浮胶囊，当前页以带文字的实心药丸标出；点「更多」向上展开成
 * 完整导航面板。形变直接动画宽、高与圆角（不做缩放变换），内容以透明度加模糊淡入淡出。
 * 通过 portal 挂在 body 上，不受头部定位上下文影响；lg 以上由顶部胶囊导航承担，此处隐藏。
 */
const HeaderIsland = () => {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return createPortal(<Island />, document.body);
};

function Island() {
	const [open, setOpen] = useState(false);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const activeTo = resolveActiveNav(pathname)?.link.to;
	const reduced = useReducedMotion();
	const viewport = useViewportWidth();
	const collapsedWidth = Math.min(viewport - SIDE_GAP * 2, COLLAPSED_MAX_WIDTH);
	const expandedWidth = Math.min(viewport - SIDE_GAP * 1.5, EXPANDED_MAX_WIDTH);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 路径变化即视为导航完成，需要收起面板
	useEffect(() => setOpen(false), [pathname]);

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

	const spring = reduced ? { duration: 0 } : SPRING;
	const fade = (delay: number, duration: number) =>
		reduced ? { duration: 0 } : { delay, duration };

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
					width: open ? expandedWidth : collapsedWidth,
					height: open ? "auto" : COLLAPSED_HEIGHT,
					borderRadius: open ? EXPANDED_RADIUS : COLLAPSED_RADIUS,
				}}
				transition={spring}
				className="pointer-events-auto relative overflow-hidden bg-card/85 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-xl dark:ring-1 dark:ring-white/10"
			>
				<AnimatePresence initial={false} mode="popLayout">
					{open ? (
						<motion.div
							key="panel"
							initial={BLUR_OUT}
							animate={{ ...BLUR_IN, transition: fade(0.08, 0.22) }}
							exit={{ ...BLUR_OUT, transition: fade(0, 0.12) }}
						>
							<Panel
								activeTo={activeTo}
								onClose={() => setOpen(false)}
								reduced={!!reduced}
							/>
						</motion.div>
					) : (
						<motion.div
							key="tabs"
							initial={BLUR_OUT}
							animate={{ ...BLUR_IN, transition: fade(0.08, 0.22) }}
							exit={{ ...BLUR_OUT, transition: fade(0, 0.12) }}
							className="flex h-14 items-center justify-between gap-1 px-2"
						>
							{PRIMARY_TABS.map((item) => (
								<Tab
									key={item.to}
									item={item}
									active={activeTo === item.to}
									reduced={!!reduced}
								/>
							))}
							<button
								type="button"
								aria-label="展开全部导航"
								aria-expanded={open}
								onClick={() => setOpen(true)}
								className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<LayoutGrid className="size-5" />
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.nav>
		</div>
	);
}

/** 收起态的单个入口：当前页是带文字的药丸，其余只有图标；文字宽度随激活状态展开收起。 */
function Tab({
	item,
	active,
	reduced,
}: {
	item: RoutableNavItem;
	active: boolean;
	reduced: boolean;
}) {
	const Icon = item.icon;
	return (
		<Link
			to={item.to}
			aria-label={item.label}
			aria-current={active ? "page" : undefined}
			className={cn(
				"flex h-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				active
					? "bg-foreground px-3.5 text-background"
					: "w-10 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
			)}
		>
			<Icon className="size-5 shrink-0" />
			<motion.span
				initial={false}
				animate={{ width: active ? "auto" : 0, opacity: active ? 1 : 0 }}
				transition={reduced ? { duration: 0 } : SPRING}
				className="overflow-hidden whitespace-nowrap text-[13px] font-medium"
			>
				<span className="block pl-2">{item.label}</span>
			</motion.span>
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
