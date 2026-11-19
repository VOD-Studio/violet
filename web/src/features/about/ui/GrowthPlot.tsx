import { type GrowthPeriod, growthDate, growthDay } from "../model/growth";
import styles from "./GardenGrowth.module.css";

const width = 1440;
const height = 440;
// 与周命中层的 1/6 和 1/12 边距一致，为里程碑标签留两端空间。
const inset = width / 6;
const timelineWidth = width * 0.75;
const stemSegments = [
	[245, 265, 247, 225],
	[225, 203, 235, 240],
	[240, 245, 221, 198],
] as const;

function dateLabel(day: number) {
	const date = growthDate(day);
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${month}.${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** 时间沿茎连续前进；叶片大小只比较提交量，花苞按实际发布日定位。 */
export function GrowthPlot({ period }: { period: GrowthPeriod }) {
	const { start, end, oldestDay, today, firstCommitDay, firstReleaseDay, weeks, maxCommitCount } =
		period;
	const chartDays = weeks.length * 7;
	const x = (day: number) => inset + ((day - start + 0.5) / chartDays) * timelineWidth;
	const firstX = x(Math.max(start, oldestDay));
	const halfWeek = timelineWidth / (weeks.length * 2);
	const lastX = x(end);
	const span = lastX - firstX;
	const step = span / stemSegments.length;
	const y = (at: number) => {
		if (span === 0) return stemSegments[0][0];
		const p = Math.min(stemSegments.length, Math.max(0, (at - firstX) / step));
		const segment = Math.min(Math.floor(p), stemSegments.length - 1);
		const [fromY, controlY1, controlY2, toY] = stemSegments[segment];
		const t = p - segment;
		const u = 1 - t;
		return (
			u ** 3 * fromY + 3 * u * u * t * controlY1 + 3 * u * t * t * controlY2 + t ** 3 * toY
		);
	};
	const curve = stemSegments
		.map(([, first, second, end], i) => {
			const x0 = firstX + i * step;
			return `C ${x0 + step / 3} ${first} ${x0 + (2 * step) / 3} ${second} ${x0 + step} ${end}`;
		})
		.join(" ");
	const months: { day: number; label: string }[] = [];
	const firstMonth = growthDate(start);
	const lastDate = growthDate(end);
	const tick = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth(), 1));
	for (; tick <= lastDate; tick.setUTCMonth(tick.getUTCMonth() + 1)) {
		const day = growthDay(tick.toISOString().slice(0, 10));
		if (day < start) continue;
		const month = tick.getUTCMonth() + 1;
		months.push({
			day,
			label: month === 1 ? `${tick.getUTCFullYear()} 年 1 月` : `${month} 月`,
		});
	}
	if (months.length === 0) {
		months.push({ day: start, label: `${firstMonth.getUTCMonth() + 1} 月` });
	}
	const visible = (day: number | null): day is number =>
		day !== null && day >= start && day <= end;

	return (
		<svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={styles.plot}>
			{months.map(({ day, label }) => (
				<g key={day} className={styles.monthTick}>
					<line x1={x(day)} x2={x(day)} y1={40} y2={405} />
					<text x={x(day) + 6} y={428}>
						{label}
					</text>
				</g>
			))}
			{span > 0 && (
				<path
					className={styles.stem}
					pathLength={1}
					d={`M ${firstX} ${stemSegments[0][0]} ${curve}`}
				/>
			)}
			{weeks.map((week, index) => {
				const mid = (Math.max(week.start, oldestDay) + Math.min(week.start + 6, end)) / 2;
				const baseX = x(mid);
				const length =
					week.commitCount > 0
						? 16 + 61 * Math.sqrt(week.commitCount / maxCommitCount)
						: 0;
				// 较长叶片横向收窄，仍以挂靠的周为命中区。
				const center = week.start + 3;
				const leaningLeft = mid > center || (mid === center && index % 2 === 0);
				const tilt = leaningLeft ? -34 : 34;
				const angle = index % 2 === 0 ? tilt : 180 - tilt;
				const leafWidth = length * 0.34;
				const leafScale = Math.min(1, (halfWeek - 1) / (length * 0.56 + leafWidth));
				const releaseDays = new Map<number, number>();
				for (const release of week.releases) {
					const day = growthDay(release.occurred_at);
					releaseDays.set(day, (releaseDays.get(day) ?? 0) + 1);
				}
				return (
					<g key={week.start}>
						{length > 0 && (
							<g
								transform={`translate(${baseX} ${y(baseX)}) scale(${leafScale} 1) rotate(${angle})`}
							>
								<path
									className={styles.leaf}
									d={`M 0 0 C ${leafWidth} ${-length * 0.25} ${leafWidth} ${-length * 0.7} 0 ${-length} C ${-leafWidth} ${-length * 0.7} ${-leafWidth} ${-length * 0.25} 0 0 Z`}
								/>
								<path className={styles.vein} d={`M 0 0 L 0 ${-length * 0.83}`} />
							</g>
						)}
						{Array.from(releaseDays, ([day, count]) => {
							const cx = x(day);
							const cy = y(cx);
							const first = day === firstReleaseDay;
							// 极密的发布日合并成一枚较大的花苞；精确版本仍列在周详情。
							const remaining = count - Number(first);
							const buds = Math.min(4, remaining);
							return (
								<g key={day} className={styles.bloom}>
									{Array.from({ length: buds }, (_, i) => (
										<circle
											key={i}
											cx={cx}
											cy={cy - 10 - 7 * i}
											r={i === buds - 1 && remaining > buds ? 4 : 2.7}
										/>
									))}
									{first && (
										<path
											transform={`translate(${cx} ${cy - 22 - 7 * buds})`}
											d="M0-4C-9-16 4-22 7-10 21-17 25-3 12 1 20 13 6 20 1 9-7 21-19 11-10 4-24-1-14-14 0-4Z"
										/>
									)}
								</g>
							);
						})}
					</g>
				);
			})}
			{visible(firstCommitDay) && (
				<g className={styles.milestone}>
					<circle cx={x(firstCommitDay)} cy={y(x(firstCommitDay))} r={4} />
					<line
						x1={x(firstCommitDay) - 82}
						x2={x(firstCommitDay) - 5}
						y1={y(x(firstCommitDay))}
						y2={y(x(firstCommitDay))}
					/>
					<text x={x(firstCommitDay) - 11} y={y(x(firstCommitDay)) - 11} textAnchor="end">
						{dateLabel(firstCommitDay)} · 首次提交
					</text>
				</g>
			)}
			{visible(firstReleaseDay) && (
				<g className={styles.milestone}>
					<line
						x1={x(firstReleaseDay)}
						x2={x(firstReleaseDay)}
						y1={62}
						y2={y(x(firstReleaseDay)) - 37}
					/>
					<text x={Math.min(x(firstReleaseDay) + 5, width - 78)} y={54}>
						首次发布
					</text>
				</g>
			)}
			{visible(today) && (
				<g className={styles.milestone}>
					<circle cx={lastX} cy={y(lastX)} r={5} />
					<text x={lastX + 12} y={y(lastX) + 4}>
						{dateLabel(today)} · 今天
					</text>
				</g>
			)}
		</svg>
	);
}
