import { cn } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { ArrowUpRight } from "lucide-react";
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
		}, 180);
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
					sideOffset={10}
					collisionPadding={12}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
					onPointerEnter={showPoint}
					onPointerLeave={scheduleClose}
					onFocusCapture={showPoint}
					onBlurCapture={scheduleClose}
					className="w-[320px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border/70 bg-popover/95 p-3.5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-border/50 dark:shadow-[0_24px_50px_-16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] data-[state=closed]:duration-150! data-[state=closed]:zoom-out-95! data-[state=open]:animate-none!"
				>
					<motion.div
						initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={{
							duration: reduceMotion ? 0 : 0.22,
							ease: [0.16, 1, 0.3, 1],
						}}
						style={{
							transformOrigin:
								"var(--radix-popover-content-transform-origin, 50% 100%)",
						}}
					>
						<div className="flex items-center justify-between pb-2.5">
							<span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tracking-tight text-foreground/85">
								<span className="size-1 rounded-full bg-primary/75" />
								<span className="tabular-nums">{periodLabel}</span>
							</span>
							<span className="text-[11px] font-medium text-muted-foreground tabular-nums">
								{point.items.length} 篇内容
							</span>
						</div>
						<div className="max-h-48 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]">
							{point.items.map((item) => (
								<HomeContentLink
									key={item.key}
									item={item}
									className="group flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-all duration-150 hover:bg-muted/70 active:scale-[0.985] focus-visible:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-medium text-foreground transition-colors group-hover:text-primary">
											{item.title}
										</p>
										<div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
											<span className="font-normal text-muted-foreground/90">
												{HOME_KIND_LABEL[item.kind]}
											</span>
											<span
												aria-hidden
												className="size-0.5 rounded-full bg-border"
											/>
											<time
												dateTime={item.publishedAt}
												className="tabular-nums"
											>
												{formatHomeDate(item.publishedAt)}
											</time>
										</div>
									</div>
									<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
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
