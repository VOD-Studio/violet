import { formatDate } from "@shared/lib/date";
import { Popover, PopoverContent, PopoverTrigger } from "@violet/ui";

import { cn } from "cn";
import { motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import type { AccumulationPoint } from "./home-accumulation-model";
import { revealDelay, revealVariants } from "./home-accumulation-motion";
import { HOME_KIND_LABEL } from "./home-content";

interface HomeAccumulationPointProps {
	point: AccumulationPoint;
	reduceMotion: boolean | null;
	/** 轴线终点位置，用于换算随线条显现的延迟。 */
	todayPosition: number;
	/** 当前节点的浮层是否展开；由时间线统一保证同一时间只展开一个。 */
	open: boolean;
	/** 悬停、聚焦或点击时请求展开本节点，并取消待执行的关闭。 */
	onActivate: () => void;
	/** 指针或焦点离开后请求延迟关闭。 */
	onRelease: () => void;
	/** 立即关闭，用于 Esc 与点击外部。 */
	onDismiss: () => void;
}

/** 提供鼠标、键盘与触屏均可访问的发布节点浮层。 */
export function HomeAccumulationPoint({
	point,
	reduceMotion,
	todayPosition,
	open,
	onActivate,
	onRelease,
	onDismiss,
}: HomeAccumulationPointProps) {
	const periodLabel = formatPointPeriod(point.startsAt, point.endsAt);
	const label =
		point.items.length === 1
			? `查看发布：${point.items[0]?.title}`
			: `查看 ${periodLabel} 的 ${point.items.length} 项发布`;

	return (
		<motion.div
			variants={revealVariants}
			custom={reduceMotion ? 0 : revealDelay(point.position, todayPosition)}
			className={cn(
				"absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
				open ? "z-20" : "z-10",
			)}
			style={{ left: `${point.position}%` }}
		>
			<Popover open={open} onOpenChange={(next) => (next ? onActivate() : onDismiss())}>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label={label}
						onPointerEnter={(event) => {
							if (event.pointerType === "mouse") onActivate();
						}}
						onPointerLeave={(event) => {
							if (event.pointerType === "mouse") onRelease();
						}}
						onFocus={onActivate}
						onBlur={onRelease}
						className="relative flex size-6 touch-manipulation items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						<span
							aria-hidden
							style={{ width: point.markerSize, height: point.markerSize }}
							className={cn(
								"block rounded-full bg-muted-foreground ring-1 ring-background transition-[background-color,box-shadow] duration-150",
								point.isLatest && "bg-primary",
								(point.includesToday || open) &&
									"bg-primary ring-primary/50 ring-offset-[3px] ring-offset-background",
							)}
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					sideOffset={12}
					collisionPadding={12}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
					onPointerEnter={onActivate}
					onPointerLeave={onRelease}
					onFocusCapture={onActivate}
					onBlurCapture={onRelease}
					className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border-0 bg-popover p-1.5 shadow-[0_4px_24px_rgb(0_0_0/0.05)] ring-1 ring-border data-[side=top]:slide-in-from-bottom-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:duration-100 data-[state=open]:duration-150"
				>
					<div className="flex items-baseline justify-between px-2.5 pt-1.5 pb-1 text-[11px] text-muted-foreground tabular-nums">
						<span className="font-medium text-foreground/80">{periodLabel}</span>
						<span>{point.items.length} 篇</span>
					</div>
					<ul className="max-h-60 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
						{point.items.map((item) => (
							<li key={item.id}>
								<HomeContentLink
									item={item}
									className="group block rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary"
								>
									<p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
										{item.title}
									</p>
									<p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
										<span>{HOME_KIND_LABEL[item.kind]}</span>
										<span aria-hidden>·</span>
										<time dateTime={item.published_at} className="tabular-nums">
											{formatDate(item.published_at, "dotted-date")}
										</time>
									</p>
								</HomeContentLink>
							</li>
						))}
					</ul>
				</PopoverContent>
			</Popover>
		</motion.div>
	);
}

function formatPointPeriod(startsAt: number, endsAt: number): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	const startLabel = `${start.getUTCMonth() + 1}.${String(start.getUTCDate()).padStart(2, "0")}`;
	if (startsAt === endsAt) return startLabel;
	const endLabel =
		start.getUTCMonth() === end.getUTCMonth()
			? String(end.getUTCDate()).padStart(2, "0")
			: `${end.getUTCMonth() + 1}.${String(end.getUTCDate()).padStart(2, "0")}`;
	return `${startLabel}—${endLabel}`;
}
