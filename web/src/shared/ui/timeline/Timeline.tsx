import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

import styles from "./Timeline.module.css";

export interface TimelineProps {
	children: ReactNode;
	ariaLabel: string;
	className?: string;
}

/** 适合发布记录与个人历程的纵向时间线。 */
export function Timeline({ children, ariaLabel, className }: TimelineProps) {
	return (
		<ol className={cn(styles.timeline, className)} aria-label={ariaLabel}>
			{children}
		</ol>
	);
}

export interface TimelineItemProps {
	date: string;
	dateTime?: string;
	children: ReactNode;
	className?: string;
}

/** 时间线单项；日期留在轨道侧，主体由调用方自由组合。 */
export function TimelineItem({ date, dateTime, children, className }: TimelineItemProps) {
	return (
		<li className={cn(styles.item, className)}>
			<div className={styles.markerColumn}>
				<time className={styles.date} dateTime={dateTime}>
					{date}
				</time>
				<span className={styles.marker} aria-hidden />
			</div>
			<div className={styles.content}>{children}</div>
		</li>
	);
}
