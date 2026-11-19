import { type GrowthPeriod, growthDate, growthDay } from "../model/growth";
import styles from "./GardenGrowth.module.css";

const width = 1120;
const height = 308;
const inset = 0.03 * width; // 与周命中层的 3% 左右边距一致。

/** 时间沿茎连续前进；叶片大小只比较提交量，花苞按实际发布日定位。 */
export function GrowthPlot({ period }: { period: GrowthPeriod }) {
	const { start, end, oldestDay, today, firstCommitDay, firstReleaseDay, weeks, maxCommitCount } =
		period;
	const chartDays = weeks.length * 7;
	const x = (day: number) => inset + ((day - start + 0.5) / chartDays) * (width - 2 * inset);
	const firstX = x(Math.max(start, oldestDay));
	const leafScale = Math.min(1, (width - 2 * inset) / weeks.length / 96);
	const lastX = x(end);
	const span = lastX - firstX;
	const fromY = 178;
	const toY = 146;
	const y = (at: number) => {
		if (span === 0) return fromY;
		const t = (at - firstX) / span;
		const u = 1 - t;
		return u ** 3 * fromY + 3 * u * u * t * 99 + 3 * u * t * t * 214 + t ** 3 * toY;
	};
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
					<line x1={x(day)} x2={x(day)} y1={22} y2={272} />
					<text x={x(day) + 5} y={292}>
						{label}
					</text>
				</g>
			))}
			{span > 0 && (
				<path
					className={styles.stem}
					d={`M ${firstX} ${fromY} C ${firstX + span / 3} 99 ${lastX - span / 3} 214 ${lastX} ${toY}`}
				/>
			)}
			{weeks.map((week, index) => {
				const mid = (Math.max(week.start, oldestDay) + Math.min(week.start + 6, end)) / 2;
				const baseX = x(mid);
				const length =
					week.commitCount > 0
						? 16 + 61 * Math.sqrt(week.commitCount / maxCommitCount)
						: 0;
				// 叶尖不伸入相邻周的触区；不足一周时朝该周内部生长。
				const center = week.start + 3;
				const leaningLeft = mid > center || (mid === center && index % 2 === 0);
				const tilt = leaningLeft ? -34 : 34;
				const angle = index % 2 === 0 ? tilt : 180 - tilt;
				const leafWidth = length * 0.3;
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
									d={`M 0 0 Q ${leafWidth} ${-length * 0.6} 0 ${-length} Q ${-leafWidth} ${-length * 0.55} 0 0 Z`}
								/>
								<path className={styles.vein} d={`M 0 0 L 0 ${-length * 0.83}`} />
							</g>
						)}
						{Array.from(releaseDays)
							.reverse()
							.map(([day, count], lane) => {
								const cx = x(day);
								const cy = y(cx) - 24 - lane * 15;
								const atRight = cx > width - 65;
								return (
									<g key={day} className={styles.bloom}>
										<line x1={cx} x2={cx} y1={y(cx)} y2={cy} />
										{day === firstReleaseDay ? (
											<path
												transform={`translate(${cx} ${cy})`}
												d="M0 5 C-15 0 -10 -8 -4 -6 C-3 -16 4 -16 5 -6 C14 -9 17 0 0 5Z"
											/>
										) : (
											<circle cx={cx} cy={cy} r={count > 1 ? 5 : 3.5} />
										)}
										{count > 1 && (
											<text
												x={cx + (atRight ? -7 : 7)}
												y={cy + 4}
												textAnchor={atRight ? "end" : "start"}
											>
												×{count}
											</text>
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
						x1={x(firstCommitDay)}
						x2={x(firstCommitDay)}
						y1={y(x(firstCommitDay)) + 8}
						y2={239}
					/>
					<text x={x(firstCommitDay) + 4} y={256}>
						首次提交
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
					<text x={lastX - 6} y={219} textAnchor="end">
						今天
					</text>
				</g>
			)}
		</svg>
	);
}
