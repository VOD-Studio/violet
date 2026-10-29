import { useReducedMotion } from "@shared/lib/motion";
import { cn } from "cn";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTickingNow } from "../hooks/use-ticking-now";
import {
	deviceActivities,
	formatClock,
	mediaPosition,
	type PresenceActivity,
} from "../lib/presence";
import type { PresenceDevice } from "../model/types";
import { PresenceGlyph } from "./PresenceGlyph";

/** 同时有播放与应用时轮流展示的间隔 */
const ROTATE_MS = 7000;
const SPRING = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;
const BLUR_OUT = { opacity: 0, filter: "blur(6px)" };
const BLUR_IN = { opacity: 1, filter: "blur(0px)" };

/**
 * 折叠态活动标签 props。
 */
export interface PresenceTickerProps {
	device: PresenceDevice;
	/** 服务端时钟减本机时钟（毫秒） */
	clockOffset: number;
	/** 播放中时在曲名后显示已播放时长 */
	showElapsed?: boolean;
	/** 是否显示艺人等次要文字；用响应式类控制时传 class */
	secondaryClassName?: string;
	/** 曲名、应用名的最大宽度类 */
	primaryClassName?: string;
	/** 内容宽度变化时回调（px），供外层容器同步尺寸 */
	onWidthChange?: (width: number) => void;
	className?: string;
}

function activityKey(activity: PresenceActivity): string {
	switch (activity.kind) {
		case "media":
			return `media:${activity.media.session_id}:${activity.media.state}`;
		case "application":
			return `app:${activity.application.display_name}`;
		case "window":
			return `window:${activity.window.title}`;
	}
}

/**
 * 顶栏与底部岛的折叠态活动标签：图标 + 文字直接说明在做什么。
 *
 * 播放与应用同时存在时每 7 秒淡入淡出轮换（减弱动态时只显示第一项）；
 * 宽度按内容以弹簧过渡，不用缩放。
 */
export function PresenceTicker({
	device,
	clockOffset,
	showElapsed = false,
	secondaryClassName,
	primaryClassName = "max-w-28",
	onWidthChange,
	className,
}: PresenceTickerProps) {
	const reduced = useReducedMotion();
	const activities = deviceActivities(device).slice(0, 2);
	const [index, setIndex] = useState(0);
	const [width, setWidth] = useState<number | null>(null);
	const measureRef = useRef<HTMLSpanElement>(null);
	const keys = activities.map(activityKey).join("|");
	const rotating = activities.length > 1 && !reduced;

	// biome-ignore lint/correctness/useExhaustiveDependencies: 活动集合变化时回到第一项
	useEffect(() => setIndex(0), [keys]);

	useEffect(() => {
		if (!rotating) return;
		const timer = window.setInterval(() => setIndex((i) => (i + 1) % 2), ROTATE_MS);
		return () => window.clearInterval(timer);
	}, [rotating]);

	useLayoutEffect(() => {
		const el = measureRef.current;
		if (!el) return;
		const update = () => {
			setWidth(el.offsetWidth);
			onWidthChange?.(el.offsetWidth);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [onWidthChange]);

	const activity = activities[Math.min(index, activities.length - 1)];
	if (!activity) return null;

	return (
		<motion.span
			initial={{ width: 0 }}
			animate={{ width: width ?? "auto" }}
			transition={reduced ? { duration: 0 } : SPRING}
			className={cn("relative inline-flex items-center overflow-hidden", className)}
		>
			<span ref={measureRef} className="inline-flex shrink-0 items-center whitespace-nowrap">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={activityKey(activity)}
						initial={BLUR_OUT}
						animate={{
							...BLUR_IN,
							transition: reduced ? { duration: 0 } : { delay: 0.06, duration: 0.24 },
						}}
						exit={{
							...BLUR_OUT,
							transition: reduced ? { duration: 0 } : { duration: 0.14 },
						}}
						className="inline-flex items-center gap-1.5"
					>
						<ActivityLabel
							activity={activity}
							device={device}
							clockOffset={clockOffset}
							showElapsed={showElapsed}
							primaryClassName={primaryClassName}
							secondaryClassName={secondaryClassName}
						/>
					</motion.span>
				</AnimatePresence>
			</span>
		</motion.span>
	);
}

function ActivityLabel({
	activity,
	device,
	clockOffset,
	showElapsed,
	primaryClassName,
	secondaryClassName,
}: {
	activity: PresenceActivity;
	device: PresenceDevice;
	clockOffset: number;
	showElapsed: boolean;
	primaryClassName: string;
	secondaryClassName?: string;
}) {
	const secondary = cn("truncate opacity-60", secondaryClassName);
	switch (activity.kind) {
		case "media": {
			const { media } = activity;
			return (
				<>
					<PresenceGlyph activity={activity} />
					<span className={cn("truncate", primaryClassName)}>{media.title}</span>
					{media.state === "paused" ? (
						<span className={secondary}>已暂停</span>
					) : showElapsed ? (
						<Elapsed media={media} device={device} clockOffset={clockOffset} />
					) : media.artist ? (
						<span className={cn("max-w-24", secondary)}>{media.artist}</span>
					) : null}
				</>
			);
		}
		case "application":
			return (
				<>
					<PresenceGlyph activity={activity} />
					<span className={secondary}>正在使用</span>
					<span className={cn("truncate", primaryClassName)}>
						{activity.application.display_name}
					</span>
				</>
			);
		case "window":
			return (
				<>
					<PresenceGlyph activity={activity} />
					<span className={cn("truncate", primaryClassName)}>
						{activity.window.title}
					</span>
				</>
			);
	}
}

function Elapsed({
	media,
	device,
	clockOffset,
}: {
	media: Extract<PresenceActivity, { kind: "media" }>["media"];
	device: PresenceDevice;
	clockOffset: number;
}) {
	const now = useTickingNow(media.rate !== null);
	const position = mediaPosition(media, device, now + clockOffset);
	if (position === null) return null;
	return <span className="opacity-60 tabular-nums">{formatClock(position)}</span>;
}
