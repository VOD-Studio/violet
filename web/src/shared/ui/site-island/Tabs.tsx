import type { NavLink } from "@shared/config/nav";
import { LayoutGrid } from "lucide-react";
import { type ComponentProps, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NavbarLinkComponent } from "../site-navbar";
import { ROW_HEIGHT, SLIDE_TRANSITION, SLOT_COUNT, springProgress, TRACK_PADDING } from "./metrics";
import type { IslandNav, RoutableNavItem } from "./nav";

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
export function Tabs({
	nav,
	activeTo,
	currentLink,
	labelWidth,
	width,
	reduced,
	LinkComponent,
	onSelect,
	onMore,
}: {
	nav: IslandNav;
	activeTo: string | undefined;
	currentLink: NavLink | undefined;
	labelWidth: number;
	width: number;
	reduced: boolean;
	LinkComponent: NavbarLinkComponent;
	onSelect?: (to: string) => void;
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
							LinkComponent={LinkComponent}
							onSelect={onSelect}
							onMore={onMore}
						/>
					))}
				</div>
				<div className="pointer-events-none absolute inset-0 drop-shadow-[0_4px_24px_rgb(0_0_0/0.05)]">
					<div
						ref={lensRef}
						aria-hidden="true"
						className="pointer-events-none absolute top-0 left-0 h-full overflow-hidden rounded-full bg-card text-foreground"
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
	LinkComponent,
	onSelect,
	onMore,
}: SlotFaceProps & {
	offset: number;
	index: number;
	LinkComponent: NavbarLinkComponent;
	onSelect?: (to: string) => void;
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
	const to = slot.to;
	const onClick: ComponentProps<"a">["onClick"] = (event) => {
		if (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		) {
			onSelect?.(to);
		}
	};
	return (
		<LinkComponent
			href={to}
			aria-label={slot.label}
			aria-current={active ? "page" : undefined}
			data-nav-index={index}
			onClick={onClick}
			className={className}
			style={style}
		>
			{face}
		</LinkComponent>
	);
}
