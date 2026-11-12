"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { addMonths, startOfMonth } from "./date-utils";
import { MonthView, type MonthViewProps } from "./month-view";

const SLIDE_MS = 320;
const SLIDE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

interface CalendarStripProps extends Omit<MonthViewProps, "month"> {
	/** 并排的月数：单日期 1，范围 2。 */
	count: 1 | 2;
	/** 条带第一个月。 */
	month: Date;
}

const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const shift = (months: number) => `translateX(calc(var(--v-date-picker-pitch) * ${-months}))`;

/**
 * 并排的月历，月份整体在窗口里横向平移：翻一个月时旧月滑出、新月滑入，标题跟着月份走，
 * 箭头固定在窗口两侧。一次跳过多个月、年份视图与减弱动态下不平移。
 */
export function CalendarStrip({ count, month, ...view }: CalendarStripProps) {
	const { months: yearView, onMonthChange } = view;
	const first = startOfMonth(month);
	const index = monthIndex(first);
	const [motion, setMotion] = useState({ index, from: index });
	if (motion.index !== index) setMotion({ index, from: motion.index });
	const sliding = !yearView && Math.abs(index - motion.from) === 1;
	const lowest = sliding ? Math.min(motion.from, index) : index;
	const highest = sliding ? Math.max(motion.from, index) : index;
	const track = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (!sliding) return;
		const node = track.current;
		const settle = () =>
			setMotion((current) => (current.index === index ? { index, from: index } : current));
		const reduced =
			!node ||
			node.closest('[data-motion="reduce"]') !== null ||
			window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
		if (!node || reduced || typeof node.animate !== "function") {
			settle();
			return;
		}
		const animation = node.animate(
			[{ transform: shift(motion.from - lowest) }, { transform: shift(index - lowest) }],
			{ duration: SLIDE_MS, easing: SLIDE_EASING },
		);
		animation.onfinish = settle;
		return () => animation.cancel();
	}, [index, sliding, motion.from, lowest]);

	const shown = Array.from({ length: highest - lowest + count }, (_, position) =>
		addMonths(first, lowest - index + position),
	);
	const last = addMonths(first, count - 1);
	return (
		<div className="v-date-picker__strip" data-count={count}>
			<button
				type="button"
				tabIndex={-1}
				className="v-date-picker__nav v-date-picker__nav--prev"
				aria-label={yearView ? "上一年" : "上个月"}
				disabled={first.getFullYear() <= 1 && (yearView || first.getMonth() === 0)}
				onClick={() => onMonthChange(addMonths(first, yearView ? -12 : -1))}
			>
				<ChevronLeft aria-hidden />
			</button>
			<button
				type="button"
				tabIndex={-1}
				className="v-date-picker__nav v-date-picker__nav--next"
				aria-label={yearView ? "下一年" : "下个月"}
				disabled={last.getFullYear() >= 9999 && (yearView || last.getMonth() === 11)}
				onClick={() => onMonthChange(addMonths(first, yearView ? 12 : 1))}
			>
				<ChevronRight aria-hidden />
			</button>
			<div
				ref={track}
				className="v-date-picker__track"
				style={sliding ? { transform: shift(index - lowest) } : undefined}
			>
				{shown.map((shownMonth, position) => {
					const offset = monthIndex(shownMonth) - index;
					return (
						<MonthView
							{...view}
							key={monthIndex(shownMonth)}
							id={yearView && position ? `${view.id}-second` : view.id}
							month={shownMonth}
							onMonthChange={(next) => onMonthChange(addMonths(next, -offset))}
						/>
					);
				})}
			</div>
		</div>
	);
}
