import { cn } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { HomeContentLink } from "./HomeContentLink";
import type { AccumulationPoint } from "./home-accumulation-model";
import { formatHomeDate, HOME_KIND_LABEL } from "./home-content";

interface HomeAccumulationPointProps {
	point: AccumulationPoint;
	reduceMotion: boolean | null;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 提供鼠标、键盘与触屏均可访问的发布节点浮层。 */
export function HomeAccumulationPoint({ point, reduceMotion }: HomeAccumulationPointProps) {
	const [open, setOpen] = useState(false);
	const closeTimer = useRef<number | null>(null);
	const periodLabel = formatPointPeriod(point.startsAt, point.endsAt);

	const cancelClose = () => {
		if (closeTimer.current === null) return;
		window.clearTimeout(closeTimer.current);
		closeTimer.current = null;
	};
	const showPoint = () => {
		cancelClose();
		setOpen(true);
	};
	const scheduleClose = () => {
		cancelClose();
		closeTimer.current = window.setTimeout(() => {
			closeTimer.current = null;
			setOpen(false);
		}, 120);
	};

	useEffect(
		() => () => {
			if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
		},
		[],
	);

	const label =
		point.items.length === 1
			? `查看发布：${point.items[0]?.title}`
			: `查看 ${periodLabel} 的 ${point.items.length} 项发布`;

	return (
		<div
			className={cn(
				"absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
				open ? "z-20" : "z-10",
			)}
			style={{ left: `${point.position}%` }}
		>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<motion.button
						type="button"
						aria-label={label}
						initial={reduceMotion ? false : { opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true, amount: 0.5 }}
						transition={{
							duration: reduceMotion ? 0 : 0.24,
							ease: EASE_OUT,
							delay: reduceMotion ? 0 : 0.16 + Math.min(point.order * 0.006, 0.3),
						}}
						onPointerEnter={(event) => {
							if (event.pointerType === "mouse") showPoint();
						}}
						onPointerLeave={(event) => {
							if (event.pointerType === "mouse") scheduleClose();
						}}
						onFocus={showPoint}
						onBlur={scheduleClose}
						className="relative flex size-6 touch-manipulation items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						<motion.span
							aria-hidden
							animate={{ scale: reduceMotion ? 1 : open ? 1.3 : 1 }}
							transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
							style={{ width: point.markerSize, height: point.markerSize }}
							className={cn(
								"block rounded-full bg-muted-foreground ring-1 ring-background transition-colors duration-150",
								point.isLatest && "bg-primary",
								open && "bg-primary ring-4 ring-primary/10",
							)}
						/>
					</motion.button>
				</PopoverTrigger>
				<PopoverContent
					asChild
					side="top"
					sideOffset={8}
					collisionPadding={12}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
					onPointerEnter={showPoint}
					onPointerLeave={scheduleClose}
					onFocusCapture={showPoint}
					onBlurCapture={scheduleClose}
					className="w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-border/60 bg-popover p-3.5 shadow-[0_12px_32px_-18px_rgb(15_23_42/0.3)] data-[state=closed]:duration-150! data-[state=closed]:zoom-out-[0.99]! data-[state=open]:animate-none!"
				>
					<motion.div
						initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.985 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE_OUT }}
						style={{ transformOrigin: "50% 100%" }}
					>
						<div className="flex items-center justify-between gap-4 text-[10px] text-muted-foreground">
							<span className="tabular-nums">{periodLabel}</span>
							<span>{point.items.length} 项</span>
						</div>
						<div className="mt-2 max-h-40 overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-1 pr-1 [scrollbar-gutter:stable]">
							{point.items.map((item) => (
								<HomeContentLink
									key={item.key}
									item={item}
									className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border-b border-border/50 px-2 py-2 transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-2 focus-visible:outline-primary"
								>
									<span className="min-w-0">
										<span className="block truncate text-xs font-medium text-popover-foreground">
											{item.title}
										</span>
										<span className="mt-0.5 block text-[10px] text-muted-foreground">
											{HOME_KIND_LABEL[item.kind]}
										</span>
									</span>
									<time
										dateTime={item.publishedAt}
										className="text-[10px] text-muted-foreground tabular-nums"
									>
										{formatHomeDate(item.publishedAt)}
									</time>
								</HomeContentLink>
							))}
						</div>
					</motion.div>
				</PopoverContent>
			</Popover>
		</div>
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
