import { Link, useHydrated } from "@tanstack/react-router";
import { Button, Stat, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@violet/ui";
import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";
import {
	type GrowthPeriod,
	type GrowthRelease,
	growthDay,
	growthDayLabel,
	growthNumber,
	growthWeekLabel,
} from "../model/growth";
import styles from "./GardenGrowth.module.css";
import { GrowthPlot } from "./GrowthPlot";

/** 一次浏览一个时段；图形与无需脚本的逐周记录共享日期边界。 */
export function GrowthTimeline({ period }: { period: GrowthPeriod }) {
	const { weeks, previous, next, start, end, today, oldestDay } = period;
	const hydrated = useHydrated();
	const [selected, setSelected] = useState(weeks.length - 1);
	const targets = useRef<(HTMLButtonElement | null)[]>([]);
	const active = weeks[selected] ?? weeks[weeks.length - 1];
	const handleWeekKey = (event: KeyboardEvent<HTMLButtonElement>) => {
		const index = targets.current.indexOf(event.currentTarget);
		let nextIndex: number;
		switch (event.key) {
			case "ArrowLeft":
				nextIndex = Math.max(0, index - 1);
				break;
			case "ArrowRight":
				nextIndex = Math.min(weeks.length - 1, index + 1);
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = weeks.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		setSelected(nextIndex);
		targets.current[nextIndex]?.focus();
	};

	return (
		<>
			<div className={styles.toolbar}>
				<p className={styles.periodLabel}>
					{growthDayLabel(Math.max(start, oldestDay))} 至 {growthDayLabel(end)}
				</p>
				{(previous || next) && (
					<nav aria-label="生长时段" className="flex flex-wrap gap-2">
						{previous ? (
							<Button variant="outline" size="sm" asChild>
								<Link to="/about" search={{ growth: previous }} resetScroll={false}>
									上一个时段
								</Link>
							</Button>
						) : (
							<Button variant="outline" size="sm" disabled>
								上一个时段
							</Button>
						)}
						{next ? (
							<Button variant="outline" size="sm" asChild>
								<Link to="/about" search={{ growth: next }} resetScroll={false}>
									下一个时段
								</Link>
							</Button>
						) : (
							<Button variant="outline" size="sm" disabled>
								下一个时段
							</Button>
						)}
					</nav>
				)}
			</div>
			<figure className={styles.figure}>
				<div className={styles.plotScroll}>
					<div
						className={styles.canvas}
						style={{ "--growth-weeks": weeks.length } as CSSProperties}
					>
						<GrowthPlot period={period} />
						<div
							className={styles.weekTargets}
							role="group"
							aria-label="选择一周"
							aria-describedby="growth-instructions"
						>
							<TooltipProvider delayDuration={150}>
								{weeks.map((week, index) => {
									const label = growthWeekLabel(week, today);
									const counts = `${growthNumber(week.commitCount)} 次提交，${growthNumber(week.releases.length)} 次发布`;
									return (
										<Tooltip key={week.start}>
											<TooltipTrigger asChild>
												<button
													ref={(node) => {
														targets.current[index] = node;
													}}
													type="button"
													disabled={!hydrated}
													className={styles.weekTarget}
													tabIndex={index === selected ? 0 : -1}
													aria-label={`${label}：${counts}`}
													aria-pressed={index === selected}
													aria-controls="growth-selection"
													onClick={() => setSelected(index)}
													onKeyDown={handleWeekKey}
												/>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<div>{label}</div>
												<div>{counts}</div>
											</TooltipContent>
										</Tooltip>
									);
								})}
							</TooltipProvider>
						</div>
					</div>
				</div>
				<figcaption className={styles.caption}>
					<span>上海时间 · 周一为一周起点</span>
					<span id="growth-instructions" className={styles.graphHelp}>
						可横划，点选或用方向键换周
					</span>
				</figcaption>
			</figure>
			<section id="growth-selection" className={styles.selection} aria-label="所选周进展">
				<p aria-live="polite">{growthWeekLabel(active, today)}</p>
				<div className={styles.stats}>
					<Stat label="提交" value={growthNumber(active.commitCount)} />
					<Stat label="发布" value={growthNumber(active.releases.length)} />
				</div>
				<ReleaseLinks releases={active.releases} />
			</section>
			<details className={styles.weekList}>
				<summary>逐周查看记录</summary>
				<ol aria-label="当前时段逐周记录">
					{weeks.map((week) => (
						<li key={week.start}>
							<strong>{growthWeekLabel(week, today)}</strong>
							<span>{growthNumber(week.commitCount)} 次提交</span>
							<ReleaseLinks releases={week.releases} />
						</li>
					))}
				</ol>
			</details>
		</>
	);
}

function ReleaseLinks({ releases }: { releases: GrowthRelease[] }) {
	if (releases.length === 0) return null;
	return (
		<ul className={styles.versionLinks} aria-label="该周发布的版本">
			{releases.map((release) => (
				<li key={release.url}>
					<a href={release.url}>{release.tag}</a>
					<time dateTime={release.occurred_at}>
						{growthDayLabel(growthDay(release.occurred_at))}
					</time>
				</li>
			))}
		</ul>
	);
}
